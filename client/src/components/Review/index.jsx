import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DiffMatchPatch from "diff-match-patch";
import { saveAs } from "file-saver";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from "./styles.module.css";
import Footer from "../Footer";
import StatsButton from "../StatsButton";

// -----------------------------------------------------------------------------
// REVIEW PAGE – keeps input/output/version history perfectly in-sync
// -----------------------------------------------------------------------------
const Review = () => {
  /* -------------------------------------------------------------------------
  * 1. INITIAL NAVIGATION STATE
  * ---------------------------------------------------------------------- */
  const { state } = useLocation();
  const {
    inputText: navInputText = "",
    outputText: navOutputText = "",
    editHistory: restoredEditHistory = [],
  } = state || {};
  /* Local editable copies – we never mutate nav* directly */
  const [inputText, setInputText] = useState(navInputText);
  const [outputText, setOutputText] = useState(navOutputText);
  const initialOutputText = navOutputText; // still needed for survey redirect
  const [editHistory] = useState(restoredEditHistory);
  const [saveHistory, setSaveHistory] = useState([]);
  /* UI-state */
  const [diffHtml, setDiffHtml] = useState("");
  // Enable the save button by default since there is no longer in-place editing
  const [isSaveButtonEnabled, setIsSaveButtonEnabled] = useState(true);
  const [isEditable, setIsEditable] = useState(false); // <-- used to toggle textarea vs rendered markdown
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showDifference, setShowDifference] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);
  /* Word / char counters */
  const [inputWordCount, setInputWordCount] = useState(0);
  const [inputCharCount, setInputCharCount] = useState(0);
  const [outputWordCount, setOutputWordCount] = useState(0);
  const [outputCharCount, setOutputCharCount] = useState(0);
  /* Sidebar – docs & versions */
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const [expandedDocs, setExpandedDocs] = useState({});
  /* Misc */
  const navigate = useNavigate();
  const surveyRef = useRef(null);
  const email = JSON.parse(localStorage.getItem("user"))?.email;

  /* -------------------------------------------------------------------------
  * 2. HELPERS
  * ---------------------------------------------------------------------- */
  const countWordsAndChars = (txt = "") => {
    const safe = typeof txt === "string" ? txt : "";
    return {
      words: safe.trim().split(/\s+/).filter(Boolean).length,
      chars: safe.length,
    };
  };
  /** pretty diff → HTML */
  const generateDiff = (a = "", b = "") => {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(a ?? "", b ?? "");
    dmp.diff_cleanupSemantic(diffs);
    return diffs
      .map(([op, txt]) => {
        if (op === DiffMatchPatch.DIFF_INSERT)
          return `<span style="background:#d4fcdc;color:green;">${txt}</span>`;
        if (op === DiffMatchPatch.DIFF_DELETE)
          return `<span style="background:#ffecec;color:red;text-decoration:line-through;">${txt}</span>`;
        return txt;
      })
      .join("");
  };
  /** chunker for long prompts */
  const splitTextIntoChunks = (txt, maxTokens) => {
    const words = txt.split(" ");
    const chunks = [];
    let chunk = [];
    words.forEach((w) => {
      if (chunk.join(" ").length + w.length < maxTokens) chunk.push(w);
      else {
        chunks.push(chunk.join(" "));
        chunk = [w];
      }
    });
    if (chunk.length) chunks.push(chunk.join(" "));
    return chunks;
  };
  const generatePrompt = (inputText) => {
    return `
You are an expert in accessible communication, tasked with transforming complex text into clear, accessible plain language for individuals with Intellectual and Developmental Disabilities (IDD) or those requiring simplified content. Retain all essential information and intent while prioritizing readability, comprehension, and inclusivity.
Text simplification refers to rewriting or adapting text to make it easier to read and understand while keeping the same level of detail and precision. Make sure you focus on simplification and not summarization. The length of generated output text must be similar to that of input text.
Guidelines for Simplification:
Vocabulary and Terminology:
Replace uncommon, technical, or abstract words with simple, everyday language.
Define unavoidable complex terms in plain language within parentheses upon first use (example: “cardiologist (heart doctor)”).
Avoid idioms, metaphors, sarcasm, or culturally specific references.
Sentence Structure:
Use short sentences (10--15 words max). Break long sentences into 1–2 ideas each.
Prefer active voice (example: “The doctor examined the patient” vs. “The patient was examined by the doctor”).
Avoid nested clauses, passive voice, and ambiguous pronouns (example: “they,” “it”).
Clarity and Flow:
Organize content logically, using headings/subheadings to group related ideas.
Use bullet points or numbered lists for steps, options, or key points.
Ensure each paragraph focuses on one main idea.
Tone and Engagement:
Write in a neutral, conversational tone (avoid formal or academic language).
Address the reader directly with “you” or “we” where appropriate.
Use consistent terms for concepts (avoid synonyms that may confuse).
Avoid Exclusionary Elements:
Remove jargon, acronyms (unless defined), and expand abbreviations if needed (example: “ASAP” → “as soon as possible”).
Eliminate metaphors, idioms, or implied meanings (example: “hit the books” → “study”).
Avoid double negatives (example: “not uncommon” → “common”).
Structural Support:
Add clear headings to label sections (example: “How to Apply for Benefits”).
Use formatting tools like bold for key terms or warnings.
Chunk information into short paragraphs with line breaks for visual ease.
Inclusivity Checks:
Ensure content is free of bias, stereotypes, or assumptions about the reader.
Use gender-neutral language (example: “they” instead of “he/she”).
Output Requirements:
Return only the simplified text, without markdown, emojis, or images.
Preserve original context, facts, and intent. Do not omit critical details.
Prioritize clarity over brevity; focus on simplification and not summarization. The length of generated output text should be same or similar to that of input text.
Do not simplify already simple text.
Example Transformation:
Original: “Individuals experiencing adverse climatic conditions may necessitate relocation to mitigate health risks.”
Simplified: “If weather conditions become dangerous, people might need to move to stay safe.”
For the provided input text, apply the above guidelines rigorously. Ensure the output is accessible to readers with varied cognitive abilities, emphasizing clarity, simplicity, and logical structure. Verify that the simplified text aligns with plain language standards like WCAG and PlainLanguage.gov.
"${inputText}"
`;
  };
  /* -------------------------------------------------------------------------
  * 3. NETWORK HELPERS (save / resimplify)
  * ---------------------------------------------------------------------- */
  // const saveSimplification = async () => {
  //   const user = JSON.parse(localStorage.getItem("user"));
  //   if (!user) return;
  //   const { words: wIn, chars: cIn } = countWordsAndChars(inputText);
  //   const { words: wOut, chars: cOut } = countWordsAndChars(outputText);
  //   await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({
  //       userId: user._id,
  //       inputText,
  //       outputText,
  //       metrics: { numWordsInput: wIn, numCharsInput: cIn, numWordsOutput: wOut, numCharsOutput: cOut },
  //     }),
  //   }).catch((err) => console.error(err));
  // };
  
  const saveEditToHistory = async (txt) => {
    // With read-only markdown, edits are not recorded; keep for backward compatibility
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;
    const { words, chars } = countWordsAndChars(txt);
    await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/edit", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, inputText, editedText: txt, numWords: words, numChars: chars }),
    });
  };
  /* -------------------------------------------------------------------------
  * 4. EFFECTS – fetch docs, sync diff, counters, localStorage state
  * ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const res = await fetch(
          `https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/user/${email}`
        );
        const result = await res.json();
        if (res.ok) {
          const sorted = result.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setDocuments(sorted);
          if (!state && sorted.length) {
            // default selection: newest doc, generated version
            const first = sorted[0];
            setSelectedDocId(first._id);
            setSelectedVersionIdx(0);
            setInputText(first.inputText);
            setOutputText(first.outputText);
          }
        }
      } catch (err) {
        console.error("fetch docs", err);
      }
    })();
  }, [email, state]);
  // diff when either side changes
  useEffect(() => setDiffHtml(generateDiff(inputText, outputText)), [inputText, outputText]);
  // word/char counters
  useEffect(() => {
    const { words: wIn, chars: cIn } = countWordsAndChars(inputText);
    const { words: wOut, chars: cOut } = countWordsAndChars(outputText);
    setInputWordCount(wIn);
    setInputCharCount(cIn);
    setOutputWordCount(wOut);
    setOutputCharCount(cOut);
  }, [inputText, outputText]);
  // persist review page snapshot (so back/refresh is safe)
  useEffect(() => {
    localStorage.setItem("reviewPageState", JSON.stringify({ inputText, outputText, editHistory }));
  }, [inputText, outputText, editHistory]);
  /* -------------------------------------------------------------------------
  * 5. HANDLERS – sidebar, editing, resimplify, save, etc.
  * ---------------------------------------------------------------------- */
  const handleDocumentClick = (doc) => {
    setSelectedDocId(doc._id);
    setSelectedVersionIdx(0); // generated text
    setInputText(doc.inputText);
    setOutputText(doc.outputText);
  };
  const handleVersionChange = (docId, idx) => {
    const doc = documents.find((d) => d._id === docId);
    if (!doc) return;
    const txt = idx === 0 ? doc.outputText : (doc.saveHistory ?? [])[idx - 1]?.finalText ?? doc.outputText;
    setSelectedDocId(docId);
    setSelectedVersionIdx(idx);
    setInputText(doc.inputText);
    setOutputText(txt);
  };
  // Now used by editable textarea toggle
  const handleEditChange = (e) => {
    const txt = e.target.value;
    setOutputText(txt);
    setIsSaveButtonEnabled(true);
    saveEditToHistory(txt);
  };
  const handleResimplify = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    try {
      const chunks = splitTextIntoChunks(inputText, 10000);
      let combo = "";
      for (const ch of chunks) {
        const res = await fetch(
          "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: generatePrompt(ch) }),
          }
        );
        if (!res.ok) continue;
        const data = await res.json();
        combo += (data?.response || "").replace(/^"|"$/g, "") + " ";
      }
      setOutputText(combo.trim());
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };
  const saveFinalOutput = async () => {
    setIsLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) return;
      const { words, chars } = countWordsAndChars(outputText);
      const res = await fetch(
        "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/final",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            inputText,
            finalText: outputText,
            numWords: words,
            numChars: chars,
            readability: 4,
            accuracy: 5,
            comments: "Looks good.",
          }),
        }
      );
      if (res.ok) {
        /* keep UI changes … */
        setIsSaveButtonEnabled(false);
        setShowSurveyPrompt(true);
        setSaveHistory((p) => [...p, { timestamp: new Date().toISOString(), finalText: outputText }]);
        setTimeout(() => surveyRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
        /* -------- prepare data for Survey page -------- */
        const currentDoc = documents.find((d) => d._id === selectedDocId);
        const generatedText = currentDoc ? currentDoc.outputText : initialOutputText; // version-1 text
        navigate("/survey", {
          state: {
            email,
            inputText, // original input
            generatedText, // **AI-generated version-1 text**
            finalText: outputText, // what’s currently on screen (may be edited)
            editHistory,
            saveHistory: [...saveHistory, { timestamp: new Date().toISOString(), finalText: outputText }],
          },
        });
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("reviewPageState");
    navigate("/Login");
  };
  const handleCopy = (txt) => navigator.clipboard.writeText(txt);
  const handleDownload = (txt, name) =>
    saveAs(new Blob([txt], { type: "text/plain;charset=utf-8" }), `${name}.txt`);
  /* -------------------------------------------------------------------------
  * 6. RENDER
  * ---------------------------------------------------------------------- */
  return (
    <>
      <nav className={styles.navbar}>
        <h1
          onClick={() => (window.location.href = "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/")}
          style={{ cursor: "pointer" }}
        >
          Text Simplification Tool
        </h1>
        <button className={styles.white_btn} onClick={handleLogout}>
          Logout
        </button>
      </nav>
      <div className={styles.container}>
        {/* ---------------- SIDEBAR ---------------- */}
        <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
          <button
            className={styles.historyIcon}
            onClick={() => setIsSidebarVisible((s) => !s)}
          >
            🕒 <p style={{ fontSize: 15 }}> History </p>
          </button>
          {isSidebarVisible && (
            <div className={styles.historyContent}>
              <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>
                ✖
              </button>
              <ul className={styles.historyList}>
                {documents.map((doc, idx) => (
                  <li key={doc._id} className={styles.historyItem}>
                    <div
                      onClick={() => {
                        setExpandedDocs((p) => ({ ...p, [doc._id]: !p[doc._id] }));
                        handleDocumentClick(doc);
                      }}
                      className={`${styles.docHeader} ${selectedDocId === doc._id ? styles.activeDoc : ""}`}
                    >
                      <strong>Document {documents.length - idx}</strong> ({doc.inputText.slice(0, 20)}...)
                    </div>
                    {expandedDocs[doc._id] && (
                      <ul className={styles.versionList}>
                        <li
                          key="0"
                          onClick={() => handleVersionChange(doc._id, 0)}
                          className={selectedDocId === doc._id && selectedVersionIdx === 0 ? styles.activeVersion : ""}
                        >
                          Version 1 (Generated)
                        </li>
                        {(doc.saveHistory ?? []).map((v, vIdx) => (
                          <li
                            key={vIdx + 1}
                            onClick={() => handleVersionChange(doc._id, vIdx + 1)}
                            className={selectedDocId === doc._id && selectedVersionIdx === vIdx + 1 ? styles.activeVersion : ""}
                          >
                            Version {vIdx + 2} ({new Date(v.timestamp).toLocaleDateString()})
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {/* ---------------- MAIN ---------------- */}
        <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
          <div className={styles.description}>
            <p>
              Please review the simplified text, edit if necessary, then save and complete the short survey to help us improve.
            </p>
          </div>
          <div className={styles.textareas_container}>
            {/* Input */}
            <div className={styles.text_container}>
              <div className={styles.labelWrapper}>
                <label className={styles.label}>Input Text</label>
                <div className={styles.actions}>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleCopy(inputText)}
                    aria-label="Copy input text"
                  >
                    📋 <span className={styles.iconLabel}>Copy</span>
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleDownload(inputText, "InputText")}
                    aria-label="Download input text"
                  >
                    📥 <span className={styles.iconLabel}>Download</span>
                  </button>
                  <StatsButton text={inputText} />
                  <button
                    className={styles.actionButton}
                    onClick={handleResimplify}
                    aria-label="Re-simplify input"
                  >
                    🔄 <span className={styles.iconLabel}>Re-simplify</span>
                  </button>
                </div>
              </div>
              <p className={styles.countText}>
                Words: {inputWordCount} | Characters: {inputCharCount}
              </p>
              <textarea className={`${styles.textarea} ${styles.side_by_side}`} value={inputText} readOnly />
            </div>
            {/* Output */}
            <div className={styles.text_container}>
              <div className={styles.labelWrapper}>
                <label className={styles.label}>AI-generated Text</label>
                <div className={styles.actions}>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleCopy(outputText)}
                    aria-label="Copy AI-generated text"
                  >
                    📋 <span className={styles.iconLabel}>Copy</span>
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleDownload(outputText, "GeneratedText")}
                    aria-label="Download AI-generated text"
                  >
                    📥 <span className={styles.iconLabel}>Download</span>
                  </button>
                  <StatsButton text={outputText} />
                  <button
                    className={styles.toggleDiffBtn}
                    onClick={() => setShowDifference((s) => !s)}
                  >
                    {showDifference ? "Hide Difference" : "Show Difference"}
                  </button>
                  {/* NEW: Toggle editable vs rendered */}
                  <button
                    className={styles.actionButton}
                    onClick={() => setIsEditable((s) => !s)}
                    aria-pressed={isEditable}
                    aria-label={isEditable ? "Show rendered output" : "Edit the output text"}
                    title={isEditable ? "Rendered View" : "AI-generated Output"}
                  >
                    {isEditable ? "Show Rendered Output" : "Edit Output"}
                  </button>
                </div>
              </div>
              <p className={styles.countText}>
                Words: {outputWordCount} | Characters: {outputCharCount}
              </p>
              {/* Render Markdown OR editable textarea based on toggle */}
              {isEditable ? (
                <textarea
                  className={`${styles.textarea} ${styles.side_by_side} ${styles.editable}`}
                  value={outputText}
                  onChange={handleEditChange}
                  aria-label="Edit AI-generated text"
                />
              ) : (
                <div className={`${styles.output_box} ${styles.side_by_side}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{outputText}</ReactMarkdown>
                </div>
              )}
            </div>
            {/* Diff */}
            {showDifference && (
              <div className={styles.text_container}>
                <label className={styles.label}>Difference from input</label>
                <div className={`${styles.output_box} ${styles.side_by_side}`} dangerouslySetInnerHTML={{ __html: diffHtml }} />
              </div>
            )}
          </div>
          {/* Save Button */}
          <div className={styles.button_container}>
            <button
              className={styles.submit_btn}
              onClick={saveFinalOutput}
              disabled={!isSaveButtonEnabled || isLoading}
              title={!isSaveButtonEnabled ? "Make an edit before saving." : ""}
            >
              Save
            </button>
          </div>
          {/* Survey Prompt */}
          {showSurveyPrompt && (
            <div className={styles.survey_prompt} ref={surveyRef}>
              <p className={styles.survey_text}>
                Please take the survey to help us improve.
                <button
                  className={styles.survey_btn}
                  onClick={() => {
                    const doc = documents.find((d) => d._id === selectedDocId);
                    const generatedText = doc ? doc.outputText : initialOutputText; // fallback
                    navigate("/survey", {
                      state: {
                        email,
                        inputText, // original user input
                        generatedText, // ► AI-generated Version-1 text
                        finalText: outputText, // ► whatever is in the box NOW
                        editHistory,
                        saveHistory: [
                          ...saveHistory,
                          { timestamp: new Date().toISOString(), finalText: outputText },
                        ],
                      },
                    });
                  }}
                >
                  📑 Take the Survey
                </button>
              </p>
            </div>
          )}
          <p className={styles.help_text}>
            Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a>
          </p>
          <Footer />
        </div>
      </div>
    </>
  );
};

export default Review;