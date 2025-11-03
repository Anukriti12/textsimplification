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
  if (prefs.sectionHeadings) sections.push("• Add clear section headings that group related ideas (start at **##**).");
  if (prefs.bulletLists) sections.push("• Use bulleted or numbered lists for steps and key points.");
  if (prefs.shortParagraphs) sections.push("• Keep paragraphs short (2–3 sentences).");

  // Sentence style
  if (prefs.breakLongSentences) sections.push("• Break long sentences into one or two clear ideas (≈10–15 words).");
  if (prefs.activeVoice) sections.push("• Use active voice.");
  if (prefs.simplifyClauses) sections.push("• Avoid nested clauses and unclear pronouns.");

  // Vocabulary & clarity
  if (prefs.useSimpleLanguage) sections.push("• Replace uncommon or technical words with everyday language.");
  if (prefs.defineTerms) sections.push("• Define complex terms in parentheses on first use.");
  if (prefs.expandAcronyms) sections.push("• Expand acronyms on first use.");
  if (prefs.avoidJargon) sections.push("• Avoid jargon, idioms, and metaphors; use literal language.");

  // Tone (omit neutral)
  if (tone && tone !== "neutral") {
    sections.push(`• Use a **${tone}** tone while maintaining clarity and accessibility.`);
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
    // Headings & Formatting
    sectionHeadings: true,
    bulletLists: true,
    shortParagraphs: true,
    // Sentence Style
    breakLongSentences: true,
    activeVoice: true,
    simplifyClauses: true,
    // Words & Clarity
    useSimpleLanguage: true,
    defineTerms: true,
    expandAcronyms: true,
    avoidJargon: true,
  });

  const [tonePreference, setTonePreference] = useState("neutral");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  const navigate = useNavigate();

  const user = safeGetUser();
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

  /** Persist the initial AI result (optionally include prefsSnapshot if your schema supports it) */
  const saveInitialSimplification = async (trimmedInput, cleanedOutput, customization) => {
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
            customization,
            // prefsSnapshot: customization, // ← uncomment if the model supports/needs storing prefs
          }),
        }
      );
    } catch (e) {
      console.error("saveInitialSimplification failed:", e);
    }
  };

  /** Build the LLM prompt for each chunk – now asks for GFM so headings/lists render */
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
You are an expert plain-language editor. Rewrite the text in clear **GitHub-Flavored Markdown** so it is easy to read and understand **without losing meaning**.

Follow these core rules:
• Keep facts, intent, and sequence accurate. No hallucinations.
• Do not add external information.
• Use inclusive, gender-neutral language when needed.
• Use consistent terms for the same concept; avoid double negatives.
• Start headings at **#**. Do not skip levels.
• Return **only** the rewritten Markdown (no extra commentary).
• Provide appropriate spacing between each heading.

1) Vocabulary & Tone
- Replace technical or abstract words with simpler alternatives.
- Define complex but necessary terms in parentheses on first use.
- Remove idioms, metaphors, and jargon.
- Use inclusive, gender-neutral language.

2) Sentence Structure
- Aim for sentences of 10–15 words.
- Prefer active voice; avoid nested clauses and unclear pronouns.

3) Structure & Flow
- Organize with clear headings/subheadings (start at heading level 1 (#); do not skip levels).
- Use lists for steps or key points.
- Keep paragraphs short; one idea per paragraph.

4) Final Checks
- Preserve facts, order, and intent.
- Use consistent terminology; avoid double negatives.

User preferences (prioritize these over above):
${prefsText}

Text:
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

  /** Submit → parallelize chunk requests, persist to sessionStorage, pass customization to Review */
  const handleSubmit = async () => {
    const trimmedInput = (inputText || "").trim();
    if (!trimmedInput) return;

    // Build a single customization object to persist + pass forward
    const customization = {
      length: outputLength,
      tone: tonePreference,
      structure: {
        headings: prefs.sectionHeadings,
        lists: prefs.bulletLists,
        shortParagraphs: prefs.shortParagraphs,
      },
      sentence: {
        breakLong: prefs.breakLongSentences,
        activeVoice: prefs.activeVoice,
        simplifyNested: prefs.simplifyClauses,
      },
      vocab: {
        everyday: prefs.useSimpleLanguage,
        defineTerms: prefs.defineTerms,
        expandAcronyms: prefs.expandAcronyms,
        avoidJargon: prefs.avoidJargon,
      },
      extra: additionalInstructions || "",
    };

    // Persist prefs so refresh survives
    sessionStorage.setItem("customizationPrefs", JSON.stringify(customization));

    setIsLoading(true);
    try {
      const chunks = splitTextIntoChunks(trimmedInput, 4000);

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

        // ---- NORMALIZE TO STRING (handles multiple API shapes) ----
        let text = "";
        if (typeof data?.response === "string") {
          text = data.response;
        } else if (data?.response?.content && Array.isArray(data.response.content)) {
          text = data.response.content.map((c) => c?.text || "").join(" ").trim();
        } else if (Array.isArray(data?.choices)) {
          text = data.choices.map((c) => c?.message?.content || "").join(" ").trim();
        } else if (typeof data?.text === "string") {
          text = data.text;
        }
        if (!text) {
          try { text = JSON.stringify(data); } catch { text = String(data); }
        }
        return text.replace(/^"|"$/g, "");
      });

      const parts = await Promise.all(requests);
      const cleanedResponse = parts.join("\n\n").replace(/\s+\n/g, "\n").trim();

      setOutputText(cleanedResponse);
      setIsSubmitted(true);

      // Seed Review fallback so reload/direct-visit still shows content
      sessionStorage.setItem(
        "lastGenerated",
        JSON.stringify({
          inputText: trimmedInput,
          outputText: cleanedResponse,
          customization,
        })
      );

      await saveInitialSimplification(trimmedInput, cleanedResponse, customization);

      navigate("/review", {
        state: {
          inputText: trimmedInput,
          outputText: cleanedResponse,
          customization, // <-- pass prefs to Review so it can re-generate consistently
        },
      });
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
                {/* Output Length with visible labels (larger slider + spacing) */}
                <h3>Output Length</h3>
                <div style={{ padding: "8px 0 12px" }}>
                  <input
                    type="range"
                    min="0"
                    max={lengthOptions.length - 1}
                    value={lengthOptions.indexOf(outputLength)}
                    onChange={(e) => setOutputLength(lengthOptions[Number(e.target.value)])}
                    className={styles.sliderInput}
                    style={{ width: "100%", height: 12 }}
                    aria-label="Output length"
                  />
                  <div className={styles.sliderLabels} style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    {["same", "shorter", "much_shorter"].map((v) => (
                      <span
                        key={v}
                        style={{ fontWeight: outputLength === v ? 700 : 400 }}
                      >
                        {v === "same" ? "Same" : v === "shorter" ? "Shorter" : "Much shorter"}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Headings & Formatting */}
                <h3>Headings &amp; Formatting</h3>
                {[
                  { key: "sectionHeadings", label: "Add clear section headings" },
                  { key: "bulletLists", label: "Use bullet/numbered lists" },
                  { key: "shortParagraphs", label: "Keep paragraphs short" },
                ].map((opt) => (
                  <label key={opt.key} className={styles.structureOption} style={{ display: "block", marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={prefs[opt.key]}
                      onChange={() => togglePref(opt.key)}
                    />
                    <span style={{ marginLeft: 8 }}>{opt.label}</span>
                  </label>
                ))}

                {/* Sentence Style */}
                <h3>Sentence Style</h3>
                {[
                  { key: "breakLongSentences", label: "Break long sentences (≈10–15 words)" },
                  { key: "activeVoice", label: "Use active voice" },
                  { key: "simplifyClauses", label: "Avoid nested clauses" },
                ].map((opt) => (
                  <label key={opt.key} className={styles.structureOption} style={{ display: "block", marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={prefs[opt.key]}
                      onChange={() => togglePref(opt.key)}
                    />
                    <span style={{ marginLeft: 8 }}>{opt.label}</span>
                  </label>
                ))}

                {/* Words & Clarity */}
                <h3>Words &amp; Clarity</h3>
                {[
                  { key: "useSimpleLanguage", label: "Use everyday words" },
                  { key: "defineTerms", label: "Define complex terms (first mention)" },
                  { key: "expandAcronyms", label: "Expand acronyms on first use" },
                  { key: "avoidJargon", label: "Avoid jargon & idioms" },
                ].map((opt) => (
                  <label key={opt.key} className={styles.structureOption} style={{ display: "block", marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={prefs[opt.key]}
                      onChange={() => togglePref(opt.key)}
                    />
                    <span style={{ marginLeft: 8 }}>{opt.label}</span>
                  </label>
                ))}

                {/* Tone */}
                <h3>Tone</h3>
                <div className={styles.toneOptions} style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  {[
                    { value: "neutral", label: "Neutral (default)" },
                    { value: "formal", label: "Formal" },
                    { value: "academic", label: "Academic" },
                    { value: "casual", label: "Casual" },
                    { value: "creative", label: "Creative" },
                  ].map((tone) => (
                    <label key={tone.value} className={styles.toneOption} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
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
                <h3>Additional instructions</h3>
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

// // v4 – robust prefs → prompt (no negations), parallel chunking, safe user parsing
// import React, { useState, useEffect, useCallback } from "react";
// import styles from "./styles.module.css";
// import { useNavigate } from "react-router-dom";
// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
// import Footer from "../Footer";

// pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.mjs`;

// /** Safely parse user from localStorage (prevents white screen on JSON.parse error) */
// const safeGetUser = () => {
//   try {
//     const raw = localStorage.getItem("user");
//     return raw ? JSON.parse(raw) : null;
//   } catch {
//     return null;
//   }
// };

// /** Build a plain-language preferences block from selected toggles ONLY (no negations) */
// const prefsToPlain = (inputWordCount, outputLength, prefs, tone, addl) => {
//   const sections = [];

//   // Length target (kept simple and interpretable for the model)
//   const ratios = { same: 1, shorter: 0.75, much_shorter: 0.5 };
//   const ratio = ratios[outputLength] ?? 1;
//   const target = Math.max(10, Math.round(inputWordCount * ratio));
//   if (outputLength === "same") {
//     sections.push(`• Keep the output about the same length (~${target} words).`);
//   } else {
//     sections.push(`• Aim for about ${target} words while preserving all meaning.`);
//   }

//   // Structure & formatting (include only checked)
//   if (prefs.sectionHeadings) sections.push("• Add clear section headings that group related ideas.");
//   if (prefs.bulletLists) sections.push("• Use bulleted or numbered lists for steps and key points.");
//   if (prefs.shortParagraphs) sections.push("• Keep paragraphs short (2–3 sentences).");

//   // Sentence style
//   if (prefs.breakLongSentences) sections.push("• Break long sentences into one or two clear ideas.");
//   if (prefs.activeVoice) sections.push("• Prefer active voice.");
//   if (prefs.simplifyClauses) sections.push("• Simplify nested clauses and complex structures.");

//   // Vocabulary & clarity
//   if (prefs.useSimpleLanguage) sections.push("• Replace uncommon or technical words with everyday language.");
//   if (prefs.defineTerms) sections.push("• Define complex terms in parentheses on first use.");
//   if (prefs.expandAcronyms) sections.push("• Expand acronyms on first use.");
//   if (prefs.avoidJargon) sections.push("• Avoid jargon, idioms, and metaphors; use literal language.");

//   // Tone (omit neutral)
//   if (tone && tone !== "neutral") {
//     sections.push(`• Use a ${tone} tone while maintaining clarity and accessibility.`);
//   }

//   // Extra user instructions
//   if (addl && addl.trim()) sections.push(`• ${addl.trim()}`);

//   return sections.join("\n");
// };

// const Main = () => {
//   // Core state
//   const [inputText, setInputText] = useState("");
//   const [outputText, setOutputText] = useState("");
//   const [isLoading, setIsLoading] = useState(false);
//   const [isSubmitted, setIsSubmitted] = useState(false);

//   // Sidebar/History
//   const [documents, setDocuments] = useState([]);
//   const [selectedDocument, setSelectedDocument] = useState(null);
//   const [isSidebarVisible, setIsSidebarVisible] = useState(false);

//   // Upload / PDF parsing
//   const [isUploading, setIsUploading] = useState(false);
//   const [uploadedFileName, setUploadedFileName] = useState("");
//   const [pdfPageCount, setPdfPageCount] = useState(0);
//   const [pdfPath, setPdfPath] = useState("");

//   // UX metrics
//   const [inputWordCount, setInputWordCount] = useState(0);
//   const [inputCharCount, setInputCharCount] = useState(0);

//   // Customization panel
//   const [showCustom, setShowCustom] = useState(false);
//   const lengthOptions = ["same", "shorter", "much_shorter"];
//   const [outputLength, setOutputLength] = useState("same");

//   const [prefs, setPrefs] = useState({
//     // Structure & Formatting
//     sectionHeadings: true,
//     bulletLists: true,
//     shortParagraphs: true,
//     // Sentence Style
//     breakLongSentences: true,
//     activeVoice: true,
//     simplifyClauses: true,
//     // Vocabulary & Clarity
//     useSimpleLanguage: true,
//     defineTerms: true,
//     expandAcronyms: true,
//     avoidJargon: true,
//   });

//   const [tonePreference, setTonePreference] = useState("neutral");
//   const [additionalInstructions, setAdditionalInstructions] = useState("");

//   const navigate = useNavigate();

//   const user = safeGetUser(); // ✅ robust
//   const email = user?.email ?? null;

//   /** Toggle a preference on/off */
//   const togglePref = (key) => setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

//   /** Logout (and keep it safe) */
//   const handleLogout = () => {
//     localStorage.removeItem("token");
//     navigate("/Login");
//   };

//   /** Fetch prior documents (if logged in) */
//   useEffect(() => {
//     if (!email) return;
//     (async () => {
//       try {
//         const response = await fetch(
//           `https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/user/${email}`
//         );
//         const result = await response.json();
//         if (response.ok) {
//           const sortedDocs = result.data.sort(
//             (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
//           );
//           setDocuments(sortedDocs);
//         } else {
//           console.error("Error fetching documents:", result.message);
//         }
//       } catch (error) {
//         console.error("Error fetching documents:", error);
//       }
//     })();
//   }, [email]);

//   /** When a history doc is clicked, load it into Input */
//   const handleDocumentClick = (doc) => {
//     setSelectedDocument(doc);
//     setInputText(doc.inputText);
//   };

//   /** PDF upload + extract text via pdf.js */
//   const handleFileUpload = async (event) => {
//     const file = event.target.files?.[0];
//     if (!file) return;

//     setPdfPath(`/uploads/${file.name}`);
//     setIsUploading(true);
//     setUploadedFileName(file.name);

//     try {
//       const fileReader = new FileReader();
//       fileReader.onload = async function () {
//         const typedArray = new Uint8Array(this.result);
//         const pdf = await pdfjsLib.getDocument(typedArray).promise;
//         setPdfPageCount(pdf.numPages);

//         let text = "";
//         for (let i = 1; i <= pdf.numPages; i++) {
//           const page = await pdf.getPage(i);
//           const textContent = await page.getTextContent();
//           text += textContent.items.map((item) => item.str).join(" ");
//         }
//         setInputText(text);
//       };
//       fileReader.readAsArrayBuffer(file);
//     } catch (error) {
//       console.error("Error reading PDF:", error);
//       alert("Failed to extract text from the PDF.");
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   /** Live counts */
//   useEffect(() => {
//     const words = inputText.trim().split(/\s+/).filter(Boolean).length;
//     const chars = inputText.length;
//     setInputWordCount(words);
//     setInputCharCount(chars);
//   }, [inputText]);

//   /** Persist the initial AI result */
//   const saveInitialSimplification = async (trimmedInput, cleanedOutput) => {
//     const u = safeGetUser();
//     if (!u) return;
//     try {
//       await fetch(
//         "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             userId: u._id,
//             email,
//             inputText: trimmedInput,
//             outputText: cleanedOutput,
//             pdfName: uploadedFileName || null,
//             pdfPath: pdfPath || null,
//           }),
//         }
//       );
//     } catch (e) {
//       console.error("saveInitialSimplification failed:", e);
//     }
//   };

//   /** Build the LLM prompt for each chunk – clean, plain-language, and strict */
//   const generatePrompt = useCallback(
//     (chunk) => {
//       const prefsText = prefsToPlain(
//         inputWordCount,
//         outputLength,
//         prefs,
//         tonePreference,
//         additionalInstructions
//       );

//       return `
// You are an expert plain-language editor. Simplify the text so it is easy to read and understand **without losing meaning**.

// Follow these core rules:
// • Keep facts, intent, and sequence accurate. No hallucinations.
// • Do not add external information.
// • Use clear, concrete, inclusive language (gender-neutral when needed).
// • Use consistent terms for the same concept; avoid double negatives.
// • Return only the rewritten text (no headings like "Simplified:", no markdown, no emojis).

// User preferences:
// ${prefsText}

// Text to simplify:
// "${chunk}"
//       `.trim();
//     },
//     [inputWordCount, outputLength, prefs, tonePreference, additionalInstructions]
//   );

//   /** Split text on a length budget (coarse; uses char length of concatenated words) */
//   const splitTextIntoChunks = (text, maxChars) => {
//     const words = text.split(/\s+/);
//     const chunks = [];
//     let curr = [];
//     for (const w of words) {
//       const nextLen = (curr.join(" ") + " " + w).trim().length;
//       if (nextLen <= maxChars) curr.push(w);
//       else {
//         if (curr.length) chunks.push(curr.join(" "));
//         curr = [w];
//       }
//     }
//     if (curr.length) chunks.push(curr.join(" "));
//     return chunks;
//   };

//   /** Submit → parallelize chunk requests, persist to sessionStorage before navigating */
//   const handleSubmit = async () => {
//     const trimmedInput = (inputText || "").trim();
//     if (!trimmedInput) return;

//     setIsLoading(true);
//     try {
//       const chunks = splitTextIntoChunks(trimmedInput, 4000);

// 	  const requests = chunks.map(async (chunk) => {
// 		const prompt = generatePrompt(chunk);
// 		const res = await fetch(
// 			"https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4",
// 			{
// 			method: "POST",
// 			headers: { "Content-Type": "application/json" },
// 			body: JSON.stringify({ prompt }),
// 			}
// 		);
// 		if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
// 		const data = await res.json();

// 		// ---- NORMALIZE TO STRING (common OpenAI/SDK shapes + fallbacks) ----
// 		let text = "";
// 		if (typeof data?.response === "string") {
// 			text = data.response;
// 		} else if (data?.response?.content && Array.isArray(data.response.content)) {
// 			// e.g., {response:{content:[{type:'output_text', text:'...'}]}}
// 			text = data.response.content.map((c) => c?.text || "").join(" ").trim();
// 		} else if (Array.isArray(data?.choices)) {
// 			// e.g., OpenAI chat format
// 			text = data.choices.map((c) => c?.message?.content || "").join(" ").trim();
// 		} else if (typeof data?.text === "string") {
// 			text = data.text;
// 		}

// 		if (!text) {
// 			try { text = JSON.stringify(data); } catch { text = String(data); }
// 		}

// 		return text.replace(/^"|"$/g, "");
// 		});

//     //   // Fire all chunk requests in parallel for speed
//     //   const requests = chunks.map(async (chunk) => {
//     //     const prompt = generatePrompt(chunk);
//     //     const res = await fetch(
//     //       "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4",
//     //       {
//     //         method: "POST",
//     //         headers: { "Content-Type": "application/json" },
//     //         body: JSON.stringify({ prompt }),
//     //       }
//     //     );
//     //     if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
//     //     const data = await res.json();
//     //     const text =
//     //       (typeof data?.response === "string" ? data.response : null) ??
//     //       (typeof data?.text === "string" ? data.text : null) ??
//     //       "";
//     //     return text.replace(/^"|"$/g, "");
//     //   });

//       const parts = await Promise.all(requests);
//       const cleanedResponse = parts.join(" ").replace(/\s+\n/g, "\n").trim();

//       setOutputText(cleanedResponse);
//       setIsSubmitted(true);

//       // Seed Review fallback so reload/direct-visit still shows content
//       sessionStorage.setItem(
//         "lastGenerated",
//         JSON.stringify({ inputText: trimmedInput, outputText: cleanedResponse })
//       );

//       await saveInitialSimplification(trimmedInput, cleanedResponse);
//       navigate("/review", { state: { inputText: trimmedInput, outputText: cleanedResponse } });
//     } catch (error) {
//       console.error("Simplify failed:", error);
//       setOutputText("An error occurred while simplifying the text.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <>
//       <nav className={styles.navbar}>
//         <h1
//           onClick={() =>
//             (window.location.href =
//               "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/")
//           }
//           style={{ cursor: "pointer" }}
//         >
//           Text Simplification Tool
//         </h1>
//         <button className={styles.white_btn} onClick={handleLogout}>
//           Logout
//         </button>
//       </nav>

//       <div className={styles.container}>
//         {/* Sidebar / History */}
//         <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
//           <button
//             className={styles.historyIcon}
//             onClick={() => setIsSidebarVisible(!isSidebarVisible)}
//           >
//             🕒 <p style={{ fontSize: "15px" }}>History</p>
//           </button>
//           {isSidebarVisible && (
//             <div className={styles.historyContent}>
//               <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>
//                 ✖
//               </button>
//               <ul className={styles.historyList}>
//                 {documents.map((doc, index) => (
//                   <li
//                     key={doc._id}
//                     onClick={() => handleDocumentClick(doc)}
//                     className={`${styles.historyItem} ${
//                       selectedDocument?._id === doc._id ? styles.activeDoc : ""
//                     }`}
//                   >
//                     <strong>Document {documents.length - index}</strong> ({doc.inputText.substring(0, 20)}…)
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>

//         {/* Main content */}
//         <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
//           <div className={styles.description}>
//             <p>
//               This tool helps make complex text easier to read while preserving its original meaning.
//               Enter text manually or upload a PDF. Customize how the text should be simplified below.
//             </p>
//           </div>

//           {/* Customization Panel */}
//           <section className={styles.customPanel}>
//             <button className={styles.customToggle} onClick={() => setShowCustom((s) => !s)}>
//               {showCustom ? "▲ Hide Customisation Options" : "▼ Show Customisation Options"}
//             </button>

//             {showCustom && (
//               <div className={styles.customBody}>
//                 {/* Output Length with visible labels */}
//                 <h3>Output Length</h3>
//                 <input
//                   type="range"
//                   min="0"
//                   max={lengthOptions.length - 1}
//                   value={lengthOptions.indexOf(outputLength)}
//                   onChange={(e) => setOutputLength(lengthOptions[Number(e.target.value)])}
//                   className={styles.sliderInput}
//                 />
//                 <div className={styles.sliderLabels}>
//                   {["same", "shorter", "much_shorter"].map((v) => (
//                     <span
//                       key={v}
//                       className={`${styles.sliderLabel ?? ""} ${
//                         outputLength === v ? styles.activeLabel ?? "" : ""
//                       }`}
//                     >
//                       {v === "same" ? "Same" : v === "shorter" ? "Shorter" : "Much shorter"}
//                     </span>
//                   ))}
//                 </div>

//                 {/* Structure & Formatting */}
//                 <h3>Structure &amp; Formatting</h3>
//                 {[
//                   { key: "sectionHeadings", label: "Section headings" },
//                   { key: "bulletLists", label: "Bullet/numbered lists" },
//                   { key: "shortParagraphs", label: "Short paragraphs" },
//                 ].map((opt) => (
//                   <label key={opt.key} className={styles.structureOption}>
//                     <input
//                       type="checkbox"
//                       checked={prefs[opt.key]}
//                       onChange={() => togglePref(opt.key)}
//                     />
//                     <span>{opt.label}</span>
//                   </label>
//                 ))}

//                 {/* Sentence Style */}
//                 <h3>Sentence Style</h3>
//                 {[
//                   { key: "breakLongSentences", label: "Break long sentences" },
//                   { key: "activeVoice", label: "Prefer active voice instead of passive voice" },
//                   { key: "simplifyClauses", label: "Simplify nested clauses" },
//                 ].map((opt) => (
//                   <label key={opt.key} className={styles.structureOption}>
//                     <input
//                       type="checkbox"
//                       checked={prefs[opt.key]}
//                       onChange={() => togglePref(opt.key)}
//                     />
//                     <span>{opt.label}</span>
//                   </label>
//                 ))}

//                 {/* Vocabulary & Clarity */}
//                 <h3>Vocabulary &amp; Clarity</h3>
//                 {[
//                   { key: "useSimpleLanguage", label: "Use everyday language" },
//                   { key: "defineTerms", label: "Define complex terms" },
//                   { key: "expandAcronyms", label: "Expand acronyms" },
//                   { key: "avoidJargon", label: "Avoid jargon & idioms" },
//                 ].map((opt) => (
//                   <label key={opt.key} className={styles.structureOption}>
//                     <input
//                       type="checkbox"
//                       checked={prefs[opt.key]}
//                       onChange={() => togglePref(opt.key)}
//                     />
//                     <span>{opt.label}</span>
//                   </label>
//                 ))}

//                 {/* Tone */}
//                 <h3>Tone Preference</h3>
//                 <div className={styles.toneOptions}>
//                   {[
//                     { value: "neutral", label: "Neutral (default)" },
//                     { value: "formal", label: "Formal" },
//                     { value: "academic", label: "Academic" },
//                     { value: "casual", label: "Casual" },
//                     { value: "creative", label: "Creative" },
//                   ].map((tone) => (
//                     <label key={tone.value} className={styles.toneOption}>
//                       <input
//                         type="radio"
//                         name="tonePreference"
//                         value={tone.value}
//                         checked={tonePreference === tone.value}
//                         onChange={(e) => setTonePreference(e.target.value)}
//                       />
//                       <span>{tone.label}</span>
//                     </label>
//                   ))}
//                 </div>

//                 {/* Additional instructions */}
//                 <h3>Additional Instructions</h3>
//                 <textarea
//                   className={styles.textarea}
//                   placeholder="Any extra guidance, context, or constraints…"
//                   value={additionalInstructions}
//                   onChange={(e) => setAdditionalInstructions(e.target.value)}
//                   rows={3}
//                 />
//               </div>
//             )}
//           </section>

//           {/* Input + Upload */}
//           <div className={styles.form_container}>
//             <div className={styles.input_area}>
//               {/* Input box */}
//               <div className={styles.text_container}>
//                 <label className={styles.label} htmlFor="inputText">
//                   Input Text
//                 </label>
//                 <textarea
//                   id="inputText"
//                   className={`${styles.textarea} ${isLoading ? styles.disabled : ""}`}
//                   placeholder="Write/Paste your text here or upload a PDF to extract content automatically."
//                   value={inputText}
//                   onChange={(e) => setInputText(e.target.value)}
//                   disabled={isLoading}
//                 />
//                 <p className={styles.countText}>
//                   Words: {inputWordCount} | Characters: {inputCharCount}
//                   {pdfPageCount > 0 && ` | Pages: ${pdfPageCount}`}
//                 </p>
//               </div>

//               <div className={styles.or_divider}>OR</div>

//               {/* Upload box */}
//               <div
//                 className={`${styles.upload_area} ${isLoading ? styles.disabled : ""}`}
//                 onDragOver={(e) => e.preventDefault()}
//                 onDrop={(e) => {
//                   e.preventDefault();
//                   const file = e.dataTransfer.files?.[0];
//                   if (file) handleFileUpload({ target: { files: [file] } });
//                 }}
//               >
//                 <label htmlFor="fileUpload" className={styles.upload_box}>
//                   {isUploading ? (
//                     <span className={styles.loadingText}>Extracting text, please wait...</span>
//                   ) : uploadedFileName ? (
//                     <>
//                       File uploaded: <strong>{uploadedFileName}</strong>
//                     </>
//                   ) : (
//                     <>
//                       Click to Upload a PDF
//                       <br />
//                       <span>...or drag and drop a file.</span>
//                     </>
//                   )}
//                 </label>
//                 <input
//                   type="file"
//                   id="fileUpload"
//                   accept="application/pdf"
//                   onChange={handleFileUpload}
//                   className={styles.hidden_input}
//                   disabled={isUploading || isLoading}
//                 />
//               </div>
//             </div>
//           </div>

//           <button
//             className={styles.submit_btn}
//             onClick={handleSubmit}
//             disabled={!inputText.trim() || isLoading || isUploading}
//             id="simplifyBtn"
//           >
//             {isLoading ? "Processing..." : "Simplify Text"}
//           </button>

//           <p className={styles.help_text}>
//             Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a>
//           </p>

//           <Footer />
//         </div>
//       </div>
//     </>
//   );
// };

// export default Main;