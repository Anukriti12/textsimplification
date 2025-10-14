// v4 – robust prefs → prompt (no negations), parallel chunking, safe user parsing
import React, { useState, useEffect, useCallback } from "react";
import styles from "./styles.module.css";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import Footer from "../Footer";

pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.mjs`;

/** Safely parse user from localStorage (prevents white screen on JSON.parse error) */
const safeGetUser = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Build a plain-language preferences block from selected toggles ONLY (no negations) */
const prefsToPlain = (inputWordCount, outputLength, prefs, tone, addl) => {
  const sections = [];

  // Length target (kept simple and interpretable for the model)
  const ratios = { same: 1, shorter: 0.75, much_shorter: 0.5 };
  const ratio = ratios[outputLength] ?? 1;
  const target = Math.max(10, Math.round(inputWordCount * ratio));
  if (outputLength === "same") {
    sections.push(`• Keep the output about the same length (~${target} words).`);
  } else {
    sections.push(`• Aim for about ${target} words while preserving all meaning.`);
  }

  // Structure & formatting (include only checked)
  if (prefs.sectionHeadings) sections.push("• Add clear section headings that group related ideas.");
  if (prefs.bulletLists) sections.push("• Use bulleted or numbered lists for steps and key points.");
  if (prefs.shortParagraphs) sections.push("• Keep paragraphs short (2–3 sentences).");

  // Sentence style
  if (prefs.breakLongSentences) sections.push("• Break long sentences into one or two clear ideas.");
  if (prefs.activeVoice) sections.push("• Prefer active voice.");
  if (prefs.simplifyClauses) sections.push("• Simplify nested clauses and complex structures.");

  // Vocabulary & clarity
  if (prefs.useSimpleLanguage) sections.push("• Replace uncommon or technical words with everyday language.");
  if (prefs.defineTerms) sections.push("• Define complex terms in parentheses on first use.");
  if (prefs.expandAcronyms) sections.push("• Expand acronyms on first use.");
  if (prefs.avoidJargon) sections.push("• Avoid jargon, idioms, and metaphors; use literal language.");

  // Tone (omit neutral)
  if (tone && tone !== "neutral") {
    sections.push(`• Use a ${tone} tone while maintaining clarity and accessibility.`);
  }

  // Extra user instructions
  if (addl && addl.trim()) sections.push(`• ${addl.trim()}`);

  return sections.join("\n");
};

const Main = () => {
  // Core state
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Sidebar/History
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  // Upload / PDF parsing
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfPath, setPdfPath] = useState("");

  // UX metrics
  const [inputWordCount, setInputWordCount] = useState(0);
  const [inputCharCount, setInputCharCount] = useState(0);

  // Customization panel
  const [showCustom, setShowCustom] = useState(false);
  const lengthOptions = ["same", "shorter", "much_shorter"];
  const [outputLength, setOutputLength] = useState("same");

  const [prefs, setPrefs] = useState({
    // Structure & Formatting
    sectionHeadings: true,
    bulletLists: true,
    shortParagraphs: true,
    // Sentence Style
    breakLongSentences: true,
    activeVoice: true,
    simplifyClauses: true,
    // Vocabulary & Clarity
    useSimpleLanguage: true,
    defineTerms: true,
    expandAcronyms: true,
    avoidJargon: true,
  });

  const [tonePreference, setTonePreference] = useState("neutral");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  const navigate = useNavigate();

  const user = safeGetUser(); // ✅ robust
  const email = user?.email ?? null;

  /** Toggle a preference on/off */
  const togglePref = (key) => setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

  /** Logout (and keep it safe) */
  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/Login");
  };

  /** Fetch prior documents (if logged in) */
  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const response = await fetch(
          `https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/user/${email}`
        );
        const result = await response.json();
        if (response.ok) {
          const sortedDocs = result.data.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
          setDocuments(sortedDocs);
        } else {
          console.error("Error fetching documents:", result.message);
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
      }
    })();
  }, [email]);

  /** When a history doc is clicked, load it into Input */
  const handleDocumentClick = (doc) => {
    setSelectedDocument(doc);
    setInputText(doc.inputText);
  };

  /** PDF upload + extract text via pdf.js */
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPdfPath(`/uploads/${file.name}`);
    setIsUploading(true);
    setUploadedFileName(file.name);

    try {
      const fileReader = new FileReader();
      fileReader.onload = async function () {
        const typedArray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        setPdfPageCount(pdf.numPages);

        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          text += textContent.items.map((item) => item.str).join(" ");
        }
        setInputText(text);
      };
      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error reading PDF:", error);
      alert("Failed to extract text from the PDF.");
    } finally {
      setIsUploading(false);
    }
  };

  /** Live counts */
  useEffect(() => {
    const words = inputText.trim().split(/\s+/).filter(Boolean).length;
    const chars = inputText.length;
    setInputWordCount(words);
    setInputCharCount(chars);
  }, [inputText]);

  /** Persist the initial AI result */
  const saveInitialSimplification = async (trimmedInput, cleanedOutput) => {
    const u = safeGetUser();
    if (!u) return;
    try {
      await fetch(
        "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: u._id,
            email,
            inputText: trimmedInput,
            outputText: cleanedOutput,
            pdfName: uploadedFileName || null,
            pdfPath: pdfPath || null,
          }),
        }
      );
    } catch (e) {
      console.error("saveInitialSimplification failed:", e);
    }
  };

  /** Build the LLM prompt for each chunk – clean, plain-language, and strict */
  const generatePrompt = useCallback(
    (chunk) => {
      const prefsText = prefsToPlain(
        inputWordCount,
        outputLength,
        prefs,
        tonePreference,
        additionalInstructions
      );

      return `
You are an expert plain-language editor. Simplify the text so it is easy to read and understand **without losing meaning**.

Follow these core rules:
• Keep facts, intent, and sequence accurate. No hallucinations.
• Do not add external information.
• Use clear, concrete, inclusive language (gender-neutral when needed).
• Use consistent terms for the same concept; avoid double negatives.
• Return only the rewritten text (no headings like "Simplified:", no markdown, no emojis).

User preferences:
${prefsText}

Text to simplify:
"${chunk}"
      `.trim();
    },
    [inputWordCount, outputLength, prefs, tonePreference, additionalInstructions]
  );

  /** Split text on a length budget (coarse; uses char length of concatenated words) */
  const splitTextIntoChunks = (text, maxChars) => {
    const words = text.split(/\s+/);
    const chunks = [];
    let curr = [];
    for (const w of words) {
      const nextLen = (curr.join(" ") + " " + w).trim().length;
      if (nextLen <= maxChars) curr.push(w);
      else {
        if (curr.length) chunks.push(curr.join(" "));
        curr = [w];
      }
    }
    if (curr.length) chunks.push(curr.join(" "));
    return chunks;
  };

  /** Submit → parallelize chunk requests, persist to sessionStorage before navigating */
  const handleSubmit = async () => {
    const trimmedInput = (inputText || "").trim();
    if (!trimmedInput) return;

    setIsLoading(true);
    try {
      const chunks = splitTextIntoChunks(trimmedInput, 2000);

      // Fire all chunk requests in parallel for speed
      const requests = chunks.map(async (chunk) => {
        const prompt = generatePrompt(chunk);
        const res = await fetch(
          "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
          }
        );
        if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
        const data = await res.json();
        const text =
          (typeof data?.response === "string" ? data.response : null) ??
          (typeof data?.text === "string" ? data.text : null) ??
          "";
        return text.replace(/^"|"$/g, "");
      });

      const parts = await Promise.all(requests);
      const cleanedResponse = parts.join(" ").replace(/\s+\n/g, "\n").trim();

      setOutputText(cleanedResponse);
      setIsSubmitted(true);

      // Seed Review fallback so reload/direct-visit still shows content
      sessionStorage.setItem(
        "lastGenerated",
        JSON.stringify({ inputText: trimmedInput, outputText: cleanedResponse })
      );

      await saveInitialSimplification(trimmedInput, cleanedResponse);
      navigate("/review", { state: { inputText: trimmedInput, outputText: cleanedResponse } });
    } catch (error) {
      console.error("Simplify failed:", error);
      setOutputText("An error occurred while simplifying the text.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <nav className={styles.navbar}>
        <h1
          onClick={() =>
            (window.location.href =
              "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/")
          }
          style={{ cursor: "pointer" }}
        >
          Text Simplification Tool
        </h1>
        <button className={styles.white_btn} onClick={handleLogout}>
          Logout
        </button>
      </nav>

      <div className={styles.container}>
        {/* Sidebar / History */}
        <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
          <button
            className={styles.historyIcon}
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
          >
            🕒 <p style={{ fontSize: "15px" }}>History</p>
          </button>
          {isSidebarVisible && (
            <div className={styles.historyContent}>
              <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>
                ✖
              </button>
              <ul className={styles.historyList}>
                {documents.map((doc, index) => (
                  <li
                    key={doc._id}
                    onClick={() => handleDocumentClick(doc)}
                    className={`${styles.historyItem} ${
                      selectedDocument?._id === doc._id ? styles.activeDoc : ""
                    }`}
                  >
                    <strong>Document {documents.length - index}</strong> ({doc.inputText.substring(0, 20)}…)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
          <div className={styles.description}>
            <p>
              This tool helps make complex text easier to read while preserving its original meaning.
              Enter text manually or upload a PDF. Customize how the text should be simplified below.
            </p>
          </div>

          {/* Customization Panel */}
          <section className={styles.customPanel}>
            <button className={styles.customToggle} onClick={() => setShowCustom((s) => !s)}>
              {showCustom ? "▲ Hide Customisation Options" : "▼ Show Customisation Options"}
            </button>

            {showCustom && (
              <div className={styles.customBody}>
                {/* Output Length with visible labels */}
                <h3>Output Length</h3>
                <input
                  type="range"
                  min="0"
                  max={lengthOptions.length - 1}
                  value={lengthOptions.indexOf(outputLength)}
                  onChange={(e) => setOutputLength(lengthOptions[Number(e.target.value)])}
                  className={styles.sliderInput}
                />
                <div className={styles.sliderLabels}>
                  {["same", "shorter", "much_shorter"].map((v) => (
                    <span
                      key={v}
                      className={`${styles.sliderLabel ?? ""} ${
                        outputLength === v ? styles.activeLabel ?? "" : ""
                      }`}
                    >
                      {v === "same" ? "Same" : v === "shorter" ? "Shorter" : "Much shorter"}
                    </span>
                  ))}
                </div>

                {/* Structure & Formatting */}
                <h3>Structure &amp; Formatting</h3>
                {[
                  { key: "sectionHeadings", label: "Section headings" },
                  { key: "bulletLists", label: "Bullet/numbered lists" },
                  { key: "shortParagraphs", label: "Short paragraphs" },
                ].map((opt) => (
                  <label key={opt.key} className={styles.structureOption}>
                    <input
                      type="checkbox"
                      checked={prefs[opt.key]}
                      onChange={() => togglePref(opt.key)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}

                {/* Sentence Style */}
                <h3>Sentence Style</h3>
                {[
                  { key: "breakLongSentences", label: "Break long sentences" },
                  { key: "activeVoice", label: "Active voice" },
                  { key: "simplifyClauses", label: "Simplify nested clauses" },
                ].map((opt) => (
                  <label key={opt.key} className={styles.structureOption}>
                    <input
                      type="checkbox"
                      checked={prefs[opt.key]}
                      onChange={() => togglePref(opt.key)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}

                {/* Vocabulary & Clarity */}
                <h3>Vocabulary &amp; Clarity</h3>
                {[
                  { key: "useSimpleLanguage", label: "Use everyday language" },
                  { key: "defineTerms", label: "Define complex terms" },
                  { key: "expandAcronyms", label: "Expand acronyms" },
                  { key: "avoidJargon", label: "Avoid jargon & idioms" },
                ].map((opt) => (
                  <label key={opt.key} className={styles.structureOption}>
                    <input
                      type="checkbox"
                      checked={prefs[opt.key]}
                      onChange={() => togglePref(opt.key)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}

                {/* Tone */}
                <h3>Tone Preference</h3>
                <div className={styles.toneOptions}>
                  {[
                    { value: "neutral", label: "Neutral (default)" },
                    { value: "formal", label: "Formal" },
                    { value: "academic", label: "Academic" },
                    { value: "casual", label: "Casual" },
                    { value: "creative", label: "Creative" },
                  ].map((tone) => (
                    <label key={tone.value} className={styles.toneOption}>
                      <input
                        type="radio"
                        name="tonePreference"
                        value={tone.value}
                        checked={tonePreference === tone.value}
                        onChange={(e) => setTonePreference(e.target.value)}
                      />
                      <span>{tone.label}</span>
                    </label>
                  ))}
                </div>

                {/* Additional instructions */}
                <h3>Additional Instructions</h3>
                <textarea
                  className={styles.textarea}
                  placeholder="Any extra guidance, context, or constraints…"
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </section>

          {/* Input + Upload */}
          <div className={styles.form_container}>
            <div className={styles.input_area}>
              {/* Input box */}
              <div className={styles.text_container}>
                <label className={styles.label} htmlFor="inputText">
                  Input Text
                </label>
                <textarea
                  id="inputText"
                  className={`${styles.textarea} ${isLoading ? styles.disabled : ""}`}
                  placeholder="Write/Paste your text here or upload a PDF to extract content automatically."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isLoading}
                />
                <p className={styles.countText}>
                  Words: {inputWordCount} | Characters: {inputCharCount}
                  {pdfPageCount > 0 && ` | Pages: ${pdfPageCount}`}
                </p>
              </div>

              <div className={styles.or_divider}>OR</div>

              {/* Upload box */}
              <div
                className={`${styles.upload_area} ${isLoading ? styles.disabled : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileUpload({ target: { files: [file] } });
                }}
              >
                <label htmlFor="fileUpload" className={styles.upload_box}>
                  {isUploading ? (
                    <span className={styles.loadingText}>Extracting text, please wait...</span>
                  ) : uploadedFileName ? (
                    <>
                      File uploaded: <strong>{uploadedFileName}</strong>
                    </>
                  ) : (
                    <>
                      Click to Upload a PDF
                      <br />
                      <span>...or drag and drop a file.</span>
                    </>
                  )}
                </label>
                <input
                  type="file"
                  id="fileUpload"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className={styles.hidden_input}
                  disabled={isUploading || isLoading}
                />
              </div>
            </div>
          </div>

          <button
            className={styles.submit_btn}
            onClick={handleSubmit}
            disabled={!inputText.trim() || isLoading || isUploading}
            id="simplifyBtn"
          >
            {isLoading ? "Processing..." : "Simplify Text"}
          </button>

          <p className={styles.help_text}>
            Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a>
          </p>

          <Footer />
        </div>
      </div>
    </>
  );
};

export default Main;


// import React, { useState, useEffect, useCallback  } from "react";
// import styles from "./styles.module.css";
// import { useNavigate } from "react-router-dom";
// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
// // import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
// // import { jwtDecode } from "jwt-decode";
// import Footer from "../Footer";
// // import { calcMetrics } from "../../utils/textMetrics";
// // import StatsButton from "../StatsButton";

// pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.mjs`;

// const prefsToPlain = (
//   inputWordCount,
//   outputLength,
//   prefs,
//   tone,
//   additionalInstructions,
// ) => {
//   const sections = [];

//   // Calculate target word count based on slider selection
//   const lengthRatios = {
//     much_shorter: 0.5,
//     shorter: 0.75,
//     same: 1.0,
//   };
//   const ratio = lengthRatios[outputLength] ?? 1.0;
//   const target = Math.round(inputWordCount * ratio);
//   if (outputLength !== "same") {
//     sections.push(`• Limit output to about **${target} words**. Do not reduce the length of input text.`);
//   }

//   // Structure and formatting
//   if (prefs.sectionHeadings) {
//     sections.push("• Add clear section headings.");
//   } else {
//     sections.push("• Do not add section headings.");
//   }
//   if (prefs.bulletLists) {
//     sections.push("• Use bullet points or numbered lists for steps and key points.");
//   } else {
//     sections.push("• Avoid using bullet points or numbered lists.");
//   }
//   if (prefs.shortParagraphs) {
//     sections.push("• Keep paragraphs to 2–3 sentences.");
//   } else {
//     sections.push("• Paragraph length may remain as in the original text.");
//   }

//   // Sentence style
//   if (prefs.breakLongSentences) {
//     sections.push("• Break long sentences into shorter ones.");
//   } else {
//     sections.push("• Preserve original sentence lengths when possible.");
//   }
//   if (prefs.activeVoice) {
//     sections.push("• Use active voice instead of passive.");
//   } else {
//     sections.push("• Passive voice is acceptable.");
//   }
//   if (prefs.simplifyClauses) {
//     sections.push("• Simplify nested clauses and complex sentence structures.");
//   } else {
//     sections.push("• Do not simplify nested clauses.");
//   }

//   // Vocabulary and clarity
//   if (prefs.useSimpleLanguage) {
//     sections.push("• Replace complex words with simple, everyday language.");
//   } else {
//     sections.push("• Keep original vocabulary complexity.");
//   }
//   if (prefs.defineTerms) {
//     sections.push("• Define unavoidable complex terms in parentheses.");
//   } else {
//     sections.push("• Do not define complex terms.");
//   }
//   if (prefs.expandAcronyms) {
//     sections.push("• Expand acronyms and abbreviations.");
//   } else {
//     sections.push("• Leave acronyms and abbreviations unchanged.");
//   }
//   if (prefs.avoidJargon) {
//     sections.push("• Avoid jargon, idioms, and culturally specific references.");
//   } else {
//     sections.push("• Keep original jargon and idioms.");
//   }

//   // Tone
//   if (tone && tone !== "neutral") {
//     sections.push(`• Use a **${tone}** tone while maintaining accessibility.`);
//   }

//   // Additional user instructions
//   if (additionalInstructions && additionalInstructions.trim().length > 0) {
//     sections.push(`• ${additionalInstructions.trim()}`);
//   }

//   return sections.join("\n");
// };


  
// const Main = () => {

// 	const [inputText, setInputText] = useState("");
// 	const [outputText, setOutputText] = useState("");
// 	const [isLoading, setIsLoading] = useState(false);
// 	const [isSubmitted, setIsSubmitted] = useState(false);
// 	//const [isEditable, setIsEditable] = useState(false); // For toggling edit mode
// 	const [uploadedFileName, setUploadedFileName] = useState(""); // State for file name
// 	//const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);
// 	//const [showSurveyPrompt, setShowSurveyPrompt] = useState(false); // State for survey prompt

// 	const [documents, setDocuments] = useState([]); // Store user documents
// 	const [selectedDocument, setSelectedDocument] = useState(null); // Selected doc
// 	const [isSidebarVisible, setIsSidebarVisible] = useState(false); // Sidebar toggle

// 	const navigate = useNavigate();
// 	const [isUploading, setIsUploading] = useState(false); // State for showing buffer

// 	const user = JSON.parse(localStorage.getItem("user"));
// 	const email = user?.email;

// 	const [inputWordCount, setInputWordCount] = useState(0);
// 	const [inputCharCount, setInputCharCount] = useState(0);
// 	const [pdfPageCount, setPdfPageCount] = useState(0);
// 	const [showCustom,  setShowCustom]  = useState(false);  // accordion open/close

// 	//const inputTextSnapshot = useRef("");
// 	const [pdfPath, setPdfPath] = useState(""); 

// 	 // Output length

//   const lengthOptions = ["same", "shorter", "much_shorter"];

//   const [outputLength, setOutputLength] = useState("same");

// //   const [customWordCount, setCustomWordCount] = useState("");


//   const [prefs, setPrefs] = useState({
// 	// Structure & Formatting
// 	sectionHeadings: true,
// 	bulletLists: true,
// 	shortParagraphs: true,
// 	// Sentence Style
// 	breakLongSentences: true,
// 	activeVoice: true,
// 	simplifyClauses: true,
// 	// Vocabulary & Clarity
// 	useSimpleLanguage: true,
// 	defineTerms: true,
// 	expandAcronyms: true,
// 	avoidJargon: true,
//   });

//   const [tonePreference, setTonePreference] = useState("neutral");
//   const [additionalInstructions, setAdditionalInstructions] = useState("");

//   // Toggle a preference on/off
//   const togglePref = (key) => {
//     setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
//   };

// 	// Helper function to calculate word counts based on input
// 	// const calculateWordCount = (inputWordCount, type) => {
// 	//   switch(type) {
// 	// 	case "shorter": return Math.round(inputWordCount * 0.85);
// 	// 	case "much_shorter": return Math.round(inputWordCount * 0.65);
// 	// 	case "custom": return customWordCount;
// 	// 	default: return inputWordCount;
// 	//   }
// 	// };



//   const handleLogout = () => {
//     localStorage.removeItem("token");
//     navigate("/Login"); 
//   };

//     // Load user's past documents (original texts only)
// 	useEffect(() => {
// 		if (!email) return;
	
// 		const fetchDocuments = async () => {
// 		  try {
// 			const response = await fetch(
// 			  `https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/user/${email}`
// 			);
// 			const result = await response.json();
	
// 			if (response.ok) {
// 			  const sortedDocs = result.data.sort(
// 				(a, b) => new Date(b.createdAt) - new Date(a.createdAt)
// 			  );
// 			  setDocuments(sortedDocs);
// 			} else {
// 			  console.error("Error fetching documents:", result.message);
// 			}
// 		  } catch (error) {
// 			console.error("Error fetching documents:", error);
// 		  }
// 		};
	
// 		fetchDocuments();
// 	  }, [email]);

// 	  // Handle document selection from history
//   const handleDocumentClick = (doc) => {
//     setSelectedDocument(doc);
//     setInputText(doc.inputText);
//   };

//   	const handleFileUpload = async (event) => {
// 	  const file = event.target.files[0];
// 	  setPdfPath(`/uploads/${file.name}`);    

// 	  if (!file) return;
  
// 	  setIsUploading(true); // Show buffer while processing
// 	  setUploadedFileName(file.name); // Set file name

// 	  try {
// 		//setUploadedFileName(file.name); // Set the uploaded file name
// 		const fileReader = new FileReader();
// 		fileReader.onload = async function () {
// 		  const typedArray = new Uint8Array(this.result);
  
// 		  const pdf = await pdfjsLib.getDocument(typedArray).promise;

// 		  setPdfPageCount(pdf.numPages);

// 		  let text = "";
  
// 		  // Extract text from all pages
// 		  for (let i = 1; i <= pdf.numPages; i++) {
// 			const page = await pdf.getPage(i);
// 			const textContent = await page.getTextContent();
// 			text += textContent.items.map((item) => item.str).join(" ");
// 		  }
  
// 		  setInputText(text);
// 		};
// 		fileReader.readAsArrayBuffer(file);
// 	  } catch (error) {
// 		console.error("Error reading PDF:", error);
// 		alert("Failed to extract text from the PDF.");
// 	  } finally {
// 		setIsUploading(false); // Hide buffer once done
// 	  }
// 	};
 
// 	const countWordsAndChars = (text) => {
// 		const words = text.trim().split(/\s+/).filter(Boolean).length;
// 		const chars = text.length;
// 		return { words, chars };
// 	  };
	  
// 	    useEffect(() => {
// 		  const { words: inputWords, chars: inputChars } = countWordsAndChars(inputText);

// 		  setInputWordCount(inputWords);
// 		  setInputCharCount(inputChars);

// 		}, [inputText]);
	  
// 		const saveInitialSimplification = async (trimmedInput, cleanedOutput) => {
// 			const user = JSON.parse(localStorage.getItem("user"));
// 			if (!user) return;

// 			await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications", {
// 				method: "POST",
// 				headers: { "Content-Type": "application/json" },
// 				body: JSON.stringify({
// 				userId: user._id,
// 				email,
// 				inputText: trimmedInput,
// 				outputText: cleanedOutput,
// 				pdfName: uploadedFileName || null,
// 				pdfPath: pdfPath || null,
// 				}),
// 			});
// 		};

//   const generatePrompt = useCallback(
// 	(chunk) => {
// 	  const prefsText = prefsToPlain(
// 		inputWordCount,
// 		outputLength,
// 		prefs,
// 		tonePreference,
// 		additionalInstructions,
// 	  );
// 	  return `You are an expert in accessible communication.\n\n### USER‑SPECIFIC CUSTOMISATIONS\n${prefsText}\n\n Transform the input into clear, accessible language without losing information. Keep the length similar to the original and avoid hallucinations. Do not reduce the length or summarize. \n\n"${chunk}"`;
// 	},
// 	[inputWordCount, outputLength, prefs, tonePreference, additionalInstructions],
//   );

// 		// const generatePrompt = useCallback((inputText) => {
// 		// 	const prefsText = prefsToPlain(inputWordCount, outputLength, customWordCount, structurePrefs, tonePreference);
	
// 		// 	return `
// 		// ### USER‑SPECIFIC CUSTOMISATIONS (please follow **strictly**)
// 		// ${prefsText || "• No special preferences."}
		
// 		// You are an expert in accessible communication, tasked with transforming complex text into clear, accessible plain language for individuals with Intellectual and Developmental Disabilities (IDD) or those requiring simplified content. Retain all essential information and intent while prioritizing readability, comprehension, and inclusivity.

// 		// Text simplification refers to rewriting or adapting text to make it easier to read and understand while keeping the same level of detail and precision. Make sure you focus on simplification and not summarization. The length of generated output text must be similar to that of input text.

// 		// Stick to the provided input text and only simplify the language. Don't provide the answer or hallucinate or provide any irrelevant information, not mentioned in the input text. 

// 		// Guidelines for Simplification:
// 		// Vocabulary and Terminology:
// 		// Replace uncommon, technical, or abstract words with simple, everyday language.
// 		// Define unavoidable complex terms in plain language within parentheses upon first use (example: "cardiologist (heart doctor)").
// 		// Avoid idioms, metaphors, sarcasm, or culturally specific references.

// 		// Sentence Structure:
// 		// Use short sentences (10--15 words max). Break long sentences into 1–2 ideas each.
// 		// Prefer active voice (example: "The doctor examined the patient" vs. "The patient was examined by the doctor").
// 		// Avoid nested clauses, passive voice, and ambiguous pronouns (example: "they," "it").

// 		// Clarity and Flow:
// 		// Organize content logically, using headings/subheadings to group related ideas.
// 		// Use bullet points or numbered lists for steps, options, or key points.
// 		// Ensure each paragraph focuses on one main idea.

// 		// Tone and Engagement:
// 		// Write in a neutral, conversational tone (avoid formal or academic language).
// 		// Address the reader directly with "you" or "we" where appropriate.
// 		// Use consistent terms for concepts (avoid synonyms that may confuse).

// 		// Avoid Exclusionary Elements:
// 		// Remove jargon, acronyms (unless defined), and expand abbreviations if needed (example: "ASAP" → "as soon as possible").
// 		// Eliminate metaphors, idioms, or implied meanings (example: "hit the books" → "study").
// 		// Avoid double negatives (example: "not uncommon" → "common").

// 		// Structural Support:
// 		// Add clear headings to label sections (example: "How to Apply for Benefits").
// 		// Use formatting tools like bold for key terms or warnings.
// 		// Chunk information into short paragraphs with line breaks for visual ease.

// 		// Inclusivity Checks:
// 		// Ensure content is free of bias, stereotypes, or assumptions about the reader.
// 		// Use gender-neutral language (example: "they" instead of "he/she").


// 		// Output Requirements:
// 		// Return only the simplified text, without markdown, emojis, or images.
// 		// Preserve original context, facts, and intent. Do not omit critical details.
// 		// Prioritize clarity over brevity; focus on simplification and not summarization. The length of generated output text should be same or similar to that of input text.
// 		// Do not simplify already simple text.

// 		// Example Transformation:
// 		// Original: "Individuals experiencing adverse climatic conditions may necessitate relocation to mitigate health risks."
// 		// Simplified: "If weather conditions become dangerous, people might need to move to stay safe."

// 		// For the provided input text, apply the above guidelines rigorously. Ensure the output is accessible to readers with varied cognitive abilities, emphasizing clarity, simplicity, and logical structure. Verify that the simplified text aligns with plain language standards like WCAG and PlainLanguage.gov.

// 		// "${inputText}"
// 		// `;
// 		//   }, [inputWordCount, outputLength, customWordCount, structurePrefs, tonePreference]);

//   const splitTextIntoChunks = (text, maxTokens) => {
// 	const words = text.split(" ");
// 	let chunks = [];
// 	let currentChunk = [];
  
// 	for (let word of words) {
// 	  if (currentChunk.join(" ").length + word.length < maxTokens) {
// 		currentChunk.push(word);
// 	  } else {
// 		chunks.push(currentChunk.join(" "));
// 		currentChunk = [word];
// 	  }
// 	}
// 	if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));
// 	return chunks;
//   };


//   const handleSubmit = async () => {

// 	// const inputText = document.getElementById('inputText').value;
// 	const trimmedInput = inputText.trim();
// 	if (!trimmedInput) return;

// 	// inputTextSnapshot.current = inputText; 
// 	setIsLoading(true);
  
// 	try {
// 	  const chunks = splitTextIntoChunks(trimmedInput, 2000);
// 	  let combinedOutput = "";
  
// 	  for (let chunk of chunks) {
// 		const prompt = generatePrompt(chunk);
// 		const response = await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4", {
// 		  method: "POST",
// 		  headers: { "Content-Type": "application/json" },
// 		  body: JSON.stringify({ prompt }),
// 		});
		
// 		if (!response.ok) {
// 			console.error(`API request failed with status: ${response.status}`);
// 			continue; // Skip this chunk if the API request failed
// 		  }

// 		const data = await response.json();
// 		console.log("Full API Response: ", data);


// 		const data1 = data?.response?.replace(/^"|"$/g, "") || "No response received."; // Append results
// 		combinedOutput += data1 + " ";
// 	}
// 	  console.log("Final Combined Output: ", combinedOutput);

// 	console.log("Data: ", combinedOutput);

// 	const cleanedResponse = combinedOutput.trim();
// 	setOutputText(cleanedResponse);
// 	setIsSubmitted(true);

// 	await saveInitialSimplification(trimmedInput, cleanedResponse);
// 	navigate("/review", { state: { inputText: trimmedInput, outputText: cleanedResponse } });
// 	// navigate("/review", { state: { inputText: trimmedInput, outputText: cleanedResponse } });
	
// 	} catch (error) {
// 	  console.error("Error fetching GPT-4o response:", error);
// 	  setOutputText("An error occurred while simplifying the text.");
// 	}
  
// 	setIsLoading(false);
//   };

//     return (
// 	  <>
// 		<nav className={styles.navbar}>
// 		  <h1
// 			onClick={() => (window.location.href = "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/")}
// 			style={{ cursor: "pointer" }}
// 		  >
// 			Text Simplification Tool
// 		  </h1>
// 		  <button className={styles.white_btn} onClick={handleLogout}>
// 			Logout
// 		  </button>
// 		</nav>
// 		<div className={styles.container}>
// 		  {/* Sidebar for document history */}
// 		  <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
// 			<button
// 			  className={styles.historyIcon}
// 			  onClick={() => setIsSidebarVisible(!isSidebarVisible)}
// 			>
// 			  🕒 <p style={{ fontSize: "15px" }}>History</p>
// 			</button>
// 			{isSidebarVisible && (
// 			  <div className={styles.historyContent}>
// 				<button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>
// 				  ✖
// 				</button>
// 				<ul className={styles.historyList}>
// 				  {documents.map((doc, index) => (
// 					<li
// 					  key={doc._id}
// 					  onClick={() => handleDocumentClick(doc)}
// 					  className={`${styles.historyItem} ${selectedDocument?._id === doc._id ? styles.activeDoc : ""}`}
// 					>
// 					  <strong>Document {documents.length - index}</strong>(
// 					  {doc.inputText.substring(0, 20)}...)
// 					</li>
// 				  ))}
// 				</ul>
// 			  </div>
// 			)}
// 		  </div>
// 		  {/* Main content area */}
// 		  <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
// 			<div className={styles.description}>
// 			  <p>
// 				This tool helps make complex text easier to read while preserving its original meaning.
// 				Enter text manually or upload a PDF to get started. You can customise the simplification
// 				guidelines below.
// 			  </p>
// 			</div>
// 			{/* Customisation panel */}
// 			<section className={styles.customPanel}>
// 			  <button className={styles.customToggle} onClick={() => setShowCustom((s) => !s)}>
// 				{showCustom ? "▲ Hide Customisation Options" : "▼ Show Customisation Options"}
// 			  </button>
// 			  {showCustom && (
// 				<div className={styles.customBody}>
// 				  {/* Output length slider */}
// 				  <h3>Output Length</h3>
// 				  <input
// 					type="range"
// 					min="0"
// 					max={lengthOptions.length - 1}
// 					value={lengthOptions.indexOf(outputLength)}
// 					onChange={(e) => setOutputLength(lengthOptions[e.target.value])}
// 					className={styles.sliderInput}
// 				  />
// 				  <div className={styles.sliderLabels}>
// 					{/* Ensure the order matches the slider positions */}

// 					<span>Same</span>		
// 					<span>Shorter</span>
// 					<span>Much shorter</span>
// 				  </div>
// 				  {/* Structure & Formatting */}
// 				  <h3>Structure & Formatting</h3>
// 				  {[
// 					{ key: "sectionHeadings", label: "Section headings" },
// 					{ key: "bulletLists", label: "Bullet/numbered lists" },
// 					{ key: "shortParagraphs", label: "Short paragraphs" },
// 				  ].map((opt) => (
// 					<label key={opt.key} className={styles.structureOption}>
// 					  <input
// 						type="checkbox"
// 						checked={prefs[opt.key]}
// 						onChange={() => togglePref(opt.key)}
// 					  />
// 					  <span>{opt.label}</span>
// 					</label>
// 				  ))}
// 				  {/* Sentence Style */}
// 				  <h3>Sentence Style</h3>
// 				  {[
// 					{ key: "breakLongSentences", label: "Break long sentences" },
// 					{ key: "activeVoice", label: "Active voice" },
// 					{ key: "simplifyClauses", label: "Simplify nested clauses" },
// 				  ].map((opt) => (
// 					<label key={opt.key} className={styles.structureOption}>
// 					  <input
// 						type="checkbox"
// 						checked={prefs[opt.key]}
// 						onChange={() => togglePref(opt.key)}
// 					  />
// 					  <span>{opt.label}</span>
// 					</label>
// 				  ))}
// 				  {/* Vocabulary & Clarity */}
// 				  <h3>Vocabulary & Clarity</h3>
// 				  {[
// 					{ key: "useSimpleLanguage", label: "Use everyday language" },
// 					{ key: "defineTerms", label: "Define complex terms" },
// 					{ key: "expandAcronyms", label: "Expand acronyms" },
// 					{ key: "avoidJargon", label: "Avoid jargon & idioms" },
// 				  ].map((opt) => (
// 					<label key={opt.key} className={styles.structureOption}>
// 					  <input
// 						type="checkbox"
// 						checked={prefs[opt.key]}
// 						onChange={() => togglePref(opt.key)}
// 					  />
// 					  <span>{opt.label}</span>
// 					</label>
// 				  ))}
// 				  {/* Tone preferences */}
// 				  <h3>Tone Preference</h3>
// 				  <div className={styles.toneOptions}>
// 					{[
// 					  { value: "neutral", label: "Neutral (default)" },
// 					  { value: "formal", label: "Formal" },
// 					  { value: "academic", label: "Academic" },
// 					  { value: "casual", label: "Casual" },
// 					  { value: "creative", label: "Creative" },
// 					].map((tone) => (
// 					  <label key={tone.value} className={styles.toneOption}>
// 						<input
// 						  type="radio"
// 						  name="tonePreference"
// 						  value={tone.value}
// 						  checked={tonePreference === tone.value}
// 						  onChange={(e) => setTonePreference(e.target.value)}
// 						/>
// 						<span>{tone.label}</span>
// 					  </label>
// 					))}
// 				  </div>
// 				  {/* Additional instructions */}
// 				  <h3>Additional Instructions</h3>
// 				  <textarea
// 					className={styles.textarea}
// 					placeholder="Enter any additional instructions or context here..."
// 					value={additionalInstructions}
// 					onChange={(e) => setAdditionalInstructions(e.target.value)}
// 					rows={3}
// 				  ></textarea>
// 				</div>
// 			  )}
// 			</section>
// 			{/* Input area and upload */}
// 			<div className={styles.form_container}>
// 			  <div className={styles.input_area}>
// 				<div className={styles.text_container}>
// 				  <label className={styles.label} htmlFor="inputText">
// 					Input Text
// 				  </label>
// 				  <textarea
// 					id="inputText"
// 					className={`${styles.textarea} ${isLoading ? styles.disabled : ""}`}
// 					placeholder="Write/Paste your text here or upload a PDF document to extract content automatically."
// 					value={inputText}
// 					onChange={(e) => setInputText(e.target.value)}
// 					disabled={isLoading}
// 				  ></textarea>
// 				  <p className={styles.countText}>
// 					Words: {inputWordCount} | Characters: {inputCharCount}
// 					{pdfPageCount > 0 && ` | Pages: ${pdfPageCount}`}
// 				  </p>
// 				</div>
// 				<div className={styles.or_divider}>OR</div>
// 				<div
// 				  className={`${styles.upload_area} ${isLoading ? styles.disabled : ""}`}
// 				  onDragOver={(e) => e.preventDefault()}
// 				  onDrop={(e) => {
// 					e.preventDefault();
// 					const file = e.dataTransfer.files[0];
// 					if (file) handleFileUpload({ target: { files: [file] } });
// 				  }}
// 				>
// 				  <label htmlFor="fileUpload" className={styles.upload_box}>
// 					{isUploading ? (
// 					  <span className={styles.loadingText}>Extracting text, please wait...</span>
// 					) : uploadedFileName ? (
// 					  <>
// 						File uploaded: <strong>{uploadedFileName}</strong>
// 					  </>
// 					) : (
// 					  <>
// 						Click to Upload a PDF
// 						<br />
// 						<span>...or drag and drop a file.</span>
// 					  </>
// 					)}
// 				  </label>
// 				  <input
// 					type="file"
// 					id="fileUpload"
// 					accept="application/pdf"
// 					onChange={handleFileUpload}
// 					className={styles.hidden_input}
// 					disabled={isUploading || isLoading}
// 				  />
// 				</div>
// 			  </div>
// 			</div>
// 			<button
// 			  className={styles.submit_btn}
// 			  onClick={handleSubmit}
// 			  disabled={!inputText.trim() || isLoading || isUploading}
// 			  id="simplifyBtn"
// 			>
// 			  {isLoading ? "Processing..." : "Simplify Text"}
// 			</button>
// 			<p className={styles.help_text}>
// 			  Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a>
// 			</p>
// 			<Footer />
// 		  </div>
// 		</div>
// 	  </>
// 	);

// 		};

// 		export default Main;