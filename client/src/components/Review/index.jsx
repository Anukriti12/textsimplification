import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DiffMatchPatch from "diff-match-patch";
import { saveAs } from "file-saver";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MDEditor from "@uiw/react-md-editor";
import styles from "./styles.module.css";
import Footer from "../Footer";
import StatsButton from "../StatsButton";
import { coerceGFM } from "../../utils/markdown";

/* ---------- helpers ---------- */
const safeGetUser = () => {
  try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; }
};

const dmp = new DiffMatchPatch();
const diffHTML = (a = "", b = "") => {
  const diffs = dmp.diff_main(a ?? "", b ?? "");
  dmp.diff_cleanupSemantic(diffs);
  return diffs.map(([op, txt]) => {
    if (op === DiffMatchPatch.DIFF_INSERT) return `<span style="background:#d4fcdc;color:#08660f;">${txt}</span>`;
    if (op === DiffMatchPatch.DIFF_DELETE) return `<span style="background:#ffecec;color:#8f1d1d;text-decoration:line-through;">${txt}</span>`;
    return txt;
  }).join("");
};

const wordChar = (s="") => ({
  words: String(s).trim().split(/\s+/).filter(Boolean).length,
  chars: String(s).length
});

/* ---------- component ---------- */
export default function Review() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const surveyRef = useRef(null);

  // seed from router OR sessionStorage
  const fallback = (() => {
    try { return JSON.parse(sessionStorage.getItem("lastGenerated")) || null; } catch { return null; }
  })();
  const initialInput  = state?.inputText  ?? fallback?.inputText  ?? "";
  const initialOutput = state?.outputText ?? fallback?.outputText ?? "";

  const user = safeGetUser();
  const email = user?.email ?? null;

  // --------- data ----------
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);

  // main texts
  const [inputText, setInputText] = useState(initialInput);
  const [outputText, setOutputText] = useState(coerceGFM(initialOutput));

  // keep a stable baseline for diff even after regenerations
  const [diffBaseline, setDiffBaseline] = useState(coerceGFM(initialOutput));

  // metrics
  const [{words:inW, chars:inC}, setInStats]   = useState(wordChar(initialInput));
  const [{words:outW, chars:outC}, setOutStats] = useState(wordChar(initialOutput));
  const [diffHtml, setDiffHtml] = useState(diffHTML(inputText, outputText));

  // UI
  const [showDifference, setShowDifference] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  // quick controls ABOVE output
  const lengthOptions = ["same", "shorter", "much_shorter"];
  const [lengthChoice, setLengthChoice] = useState("same");
  const [tone, setTone] = useState("neutral");

  // keep last saved draft to avoid dup writes
  const lastDraftRef = useRef("");

  /* ---------- effects ---------- */

  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const res = await fetch(`/api/simplifications/user/${email}`);
        const json = await res.json();
        if (res.ok) {
          const sorted = json.data.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
          setDocuments(sorted);
          if (!state && sorted.length) {
            const first = sorted[0];
            setSelectedDocId(first._id);
            setSelectedVersionIdx(0);
            setInputText(first.inputText);
            setOutputText(coerceGFM(first.outputText));
            setDiffBaseline(coerceGFM(first.outputText));
          }
        }
      } catch(e) { console.error("fetch docs", e); }
    })();
  }, [email, state]);

  useEffect(() => setInStats(wordChar(inputText)), [inputText]);
  useEffect(() => {
    setOutStats(wordChar(outputText));
    setDiffHtml(diffHTML(diffBaseline, outputText)); // diff vs baseline (sticky)
  }, [outputText, diffBaseline]);

  // autosave draft edits every 1.5s when dirty
  useEffect(() => {
    if (!isDirty) return;
    const id = setTimeout(async () => {
      if (lastDraftRef.current === outputText) return;
      lastDraftRef.current = outputText;
      setIsDirty(false);
      try {
        await fetch("/api/simplifications/edit", {
          method: "PUT",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ email, inputText, editedText: outputText })
        });
      } catch(e){ console.error("autosave edit", e); }
    }, 1500);
    return () => clearTimeout(id);
  }, [isDirty, outputText, email, inputText]);

  // “are you sure?” when leaving with dirty edits
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  /* ---------- regenerate with controls ---------- */
  const buildPrefsText = () => {
    const ratios = { same: 1, shorter: 0.75, much_shorter: 0.5 };
    const target = Math.max(10, Math.round(inW * (ratios[lengthChoice] ?? 1)));
    const toneInstr = tone !== "neutral" ? `• Use a ${tone} tone.\n` : "";
    return `• Aim for ~${target} words while preserving meaning.\n${toneInstr}`;
  };

  const buildPrompt = (text) => `
You are an expert plain-language editor.
Rewrite the text in clear **GitHub-Flavored Markdown**.

Rules:
• Keep facts, intent, and sequence accurate. No hallucinations.
• Use headings, lists, short paragraphs. Start sections at **##** (H2). Never use H1 inside the body.
• Do not skip heading levels (no H3 before H2).
• Replace jargon with everyday words. Define acronyms on first use.
• Return **only** valid Markdown (no extra commentary).

Preferences:
${buildPrefsText()}

Text:
"${text}"
`.trim();

  const splitChunks = (txt, max = 3500) => {
    const words = String(txt).split(/\s+/);
    const chunks = [];
    let cur = [];
    for (const w of words) {
      const next = (cur.join(" ") + " " + w).trim();
      if (next.length <= max) cur.push(w);
      else { if (cur.length) chunks.push(cur.join(" ")); cur = [w]; }
    }
    if (cur.length) chunks.push(cur.join(" "));
    return chunks;
  };

  const regenerate = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    try {
      // keep the "Show Difference" baseline pinned to the *previous* text
      setDiffBaseline(outputText);

      const chunks = splitChunks(inputText, 3500);
      const reqs = chunks.map(async (ch) => {
        const res = await fetch("/api/gpt4", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ prompt: buildPrompt(ch) })
        });
        const data = await res.json();
        // normalize across shapes
        let t = "";
        if (typeof data?.response === "string") t = data.response;
        else if (Array.isArray(data?.choices)) t = data.choices.map(c => c?.message?.content || "").join(" ");
        else if (typeof data?.text === "string") t = data.text;
        else if (data?.response?.content) t = data.response.content.map(c => c?.text || "").join(" ");
        return coerceGFM(t);
      });
      const combined = coerceGFM((await Promise.all(reqs)).join("\n\n"));

      // update screen
      setOutputText(combined);
      setIsDirty(true); // so it autosaves as an edit

      // also persist a "version" row (even if user never saves)
      await fetch("/api/simplifications/version", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          email,
          inputText,
          producedText: combined,
          source: "resimplify",
          prefsSnapshot: { lengthChoice, tone },
        })
      });
    } catch(e) {
      console.error("regenerate", e);
    } finally { setIsLoading(false); }
  };

  /* ---------- actions ---------- */
  const saveFinal = async () => {
    try {
      const res = await fetch("/api/simplifications/final", {
        method: "PUT",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ email, inputText, finalText: outputText })
      });
      if (res.ok) {
        setIsDirty(false);
        setShowSurveyPrompt(true);
        setTimeout(() => surveyRef.current?.scrollIntoView({ behavior:"smooth" }), 250);
        // send both generated (baseline) and final to survey page
        navigate("/survey", {
          state: {
            email,
            inputText,
            generatedText: diffBaseline, // Version used for diff baseline
            finalText: outputText
          }
        });
      }
    } catch(e){ console.error("save final", e); }
  };

  const handleLogout = () => { localStorage.removeItem("token"); navigate("/Login"); };

  /* ---------- render ---------- */
  return (
    <>
      <nav className={styles.navbar}>
        <h1 onClick={() => (window.location.href = "/")} style={{cursor:"pointer"}}>Text Simplification Tool</h1>
        <button className={styles.white_btn} onClick={handleLogout}>Logout</button>
      </nav>

      <div className={styles.container}>
        {/* Sidebar */}
        <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
          <button className={styles.historyIcon} onClick={() => setIsSidebarVisible(s=>!s)}>🕒 <p style={{fontSize:15}}> History </p></button>
          {isSidebarVisible && (
            <div className={styles.historyContent}>
              <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>✖</button>
              <ul className={styles.historyList}>
                {documents.map((doc, idx) => (
                  <li key={doc._id} className={styles.historyItem} onClick={() => {
                    setSelectedDocId(doc._id); setSelectedVersionIdx(0);
                    setInputText(doc.inputText);
                    setOutputText(coerceGFM(doc.outputText));
                    setDiffBaseline(coerceGFM(doc.outputText));
                  }}>
                    <strong>Document {documents.length - idx}</strong> ({doc.inputText.slice(0,20)}…)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Main */}
        <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
          <div className={styles.description}>
            <p>Please review the simplified text. You can edit inline or regenerate with the controls above the output. {isDirty && <strong style={{marginLeft:8,color:"#9a6700"}}>Unsaved changes</strong>}</p>
          </div>

          <div className={styles.textareas_container}>
            {/* Input (readonly) */}
            <div className={styles.text_container}>
              <div className={styles.labelWrapper}>
                <label className={styles.label}>Input Text</label>
                <div className={styles.actions}>
                  <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(inputText)}>📋 <span className={styles.iconLabel}>Copy</span></button>
                  <button className={styles.actionButton} onClick={() => saveAs(new Blob([inputText],{type:"text/plain;charset=utf-8"}), "InputText.txt")}>📥 <span className={styles.iconLabel}>Download</span></button>
                  <StatsButton text={inputText} />
                </div>
              </div>
              <p className={styles.countText}>Words: {inW} | Characters: {inC}</p>
              <textarea className={`${styles.textarea} ${styles.side_by_side}`} value={inputText} readOnly />
            </div>

            {/* Output with controls (slider + tone) */}
            <div className={styles.text_container} data-color-mode="light">
              <div className={styles.labelWrapper}>
                <label className={styles.label}>AI-generated Text (Markdown)</label>
                <div className={styles.actions}>
                  <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(outputText)}>📋 <span className={styles.iconLabel}>Copy</span></button>
                  <button className={styles.actionButton} onClick={() => saveAs(new Blob([outputText],{type:"text/markdown;charset=utf-8"}), "Generated.md")}>📥 <span className={styles.iconLabel}>Download</span></button>
                  <StatsButton text={outputText} />
                  <button className={styles.toggleDiffBtn} onClick={() => setShowDifference(s=>!s)}>{showDifference ? "Hide Difference" : "Show Difference"}</button>
                </div>
              </div>

              {/* quick prefs above editor */}
              <div className={styles.quickPrefs}>
                <div className={styles.sliderRow}>
                  <span>Output length:</span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    value={["same","shorter","much_shorter"].indexOf(lengthChoice)}
                    onChange={(e)=>setLengthChoice(["same","shorter","much_shorter"][Number(e.target.value)])}
                    className={styles.sliderInput}
                    aria-label="Output length"
                  />
                  <div className={styles.sliderLabels}>
                    <span className={lengthChoice==="same"?styles.activeLabel:""}>Same</span>
                    <span className={lengthChoice==="shorter"?styles.activeLabel:""}>Shorter</span>
                    <span className={lengthChoice==="much_shorter"?styles.activeLabel:""}>Much shorter</span>
                  </div>
                </div>

                <div className={styles.toneRow}>
                  <label> Tone: </label>
                  <select value={tone} onChange={(e)=>setTone(e.target.value)}>
                    <option value="neutral">Neutral</option>
                    <option value="formal">Formal</option>
                    <option value="academic">Academic</option>
                    <option value="casual">Casual</option>
                    <option value="creative">Creative</option>
                  </select>

                  <button className={styles.actionButton} onClick={regenerate} disabled={isLoading} title="Re-generate with the selected options">
                    🔄 <span className={styles.iconLabel}>{isLoading ? "Regenerating…" : "Re-generate"}</span>
                  </button>

                  <button className={styles.actionButton} onClick={()=>setDiffBaseline(outputText)} title="Set current output as new diff baseline">📌 <span className={styles.iconLabel}>Pin as baseline</span></button>
                </div>
              </div>

              <p className={styles.countText}>Words: {outW} | Characters: {outC}</p>

              {/* Markdown editor (editable preview) */}
              <div className={`${styles.output_box} ${styles.side_by_side}`}>
                <MDEditor
                  value={outputText}
                  onChange={(val) => { setOutputText(coerceGFM(val || "")); setIsDirty(true); }}
                  preview="live"
                  hideToolbar={false}
                  visiableDragbar={false}
                  previewOptions={{ remarkPlugins: [remarkGfm] }}
                />
              </div>
            </div>

            {/* Diff vs baseline */}
            {showDifference && (
              <div className={styles.text_container}>
                <div className={styles.labelWrapper}>
                  <label className={styles.label}>Difference (vs pinned baseline)</label>
                </div>
                <div className={`${styles.output_box} ${styles.side_by_side}`} dangerouslySetInnerHTML={{ __html: diffHtml }} />
              </div>
            )}
          </div>

          {/* Save */}
          <div className={styles.button_container}>
            <button className={styles.submit_btn} onClick={saveFinal} disabled={isLoading}>Save</button>
          </div>

          {showSurveyPrompt && (
            <div className={styles.survey_prompt} ref={surveyRef}>
              <p className={styles.survey_text}>
                Please take the short survey.
                <button
                  className={styles.survey_btn}
                  onClick={() => navigate("/survey", { state: { email, inputText, generatedText: diffBaseline, finalText: outputText } })}
                >
                  📑 Take the Survey
                </button>
              </p>
            </div>
          )}

          <p className={styles.help_text}>Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a></p>
          <Footer />
        </div>
      </div>
    </>
  );
}

// // v4 – safe localStorage parsing + sessionStorage fallback, stable rendering
// import React, { useState, useEffect, useRef } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import { saveAs } from "file-saver";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
// import styles from "./styles.module.css";
// import Footer from "../Footer";
// import StatsButton from "../StatsButton";

// /** Safe reader to prevent JSON.parse crashes on direct reloads */
// const safeGetUser = () => {
//   try {
//     const raw = localStorage.getItem("user");
//     return raw ? JSON.parse(raw) : null;
//   } catch {
//     return null;
//   }
// };

// const Review = () => {
//   // 1) INITIAL STATE (navigation + fallback to sessionStorage)
//   const { state } = useLocation();
//   const { inputText: navInputText = "", outputText: navOutputText = "", editHistory: restoredEditHistory = [] } =
//     state || {};

//   // Fallback for direct visits or refresh (seeded by Main on submit)
//   const fallback = (() => {
//     try {
//       const raw = sessionStorage.getItem("lastGenerated");
//       return raw ? JSON.parse(raw) : null;
//     } catch {
//       return null;
//     }
//   })();

//   const [inputText, setInputText] = useState(navInputText || fallback?.inputText || "");
//   const [outputText, setOutputText] = useState(navOutputText || fallback?.outputText || "");
//   const initialOutputText = navOutputText || fallback?.outputText || ""; // for survey comparison if needed
//   const [editHistory] = useState(restoredEditHistory);
//   const [saveHistory, setSaveHistory] = useState([]);

//   // UI state
//   const [diffHtml, setDiffHtml] = useState("");
//   const [isSaveButtonEnabled, setIsSaveButtonEnabled] = useState(true);
//   const [isEditable, setIsEditable] = useState(false);
//   const [isSidebarVisible, setIsSidebarVisible] = useState(false);
//   const [showDifference, setShowDifference] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);

//   // Metrics
//   const [inputWordCount, setInputWordCount] = useState(0);
//   const [inputCharCount, setInputCharCount] = useState(0);
//   const [outputWordCount, setOutputWordCount] = useState(0);
//   const [outputCharCount, setOutputCharCount] = useState(0);

//   // Sidebar/Docs
//   const [documents, setDocuments] = useState([]);
//   const [selectedDocId, setSelectedDocId] = useState(null);
//   const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
//   const [expandedDocs, setExpandedDocs] = useState({});

//   const navigate = useNavigate();
//   const surveyRef = useRef(null);

//   const user = safeGetUser();
//   const email = user?.email ?? null;

//   // 2) HELPERS
//   const countWordsAndChars = (txt = "") => {
//     const safe = typeof txt === "string" ? txt : "";
//     return {
//       words: safe.trim().split(/\s+/).filter(Boolean).length,
//       chars: safe.length,
//     };
//   };

//   const generateDiff = (a = "", b = "") => {
//     const dmp = new DiffMatchPatch();
//     const diffs = dmp.diff_main(a ?? "", b ?? "");
//     dmp.diff_cleanupSemantic(diffs);
//     return diffs
//       .map(([op, txt]) => {
//         if (op === DiffMatchPatch.DIFF_INSERT)
//           return `<span style="background:#d4fcdc;color:green;">${txt}</span>`;
//         if (op === DiffMatchPatch.DIFF_DELETE)
//           return `<span style="background:#ffecec;color:red;text-decoration:line-through;">${txt}</span>`;
//         return txt;
//       })
//       .join("");
//   };

//   const splitTextIntoChunks = (txt, maxChars) => {
//     const words = txt.split(" ");
//     const chunks = [];
//     let chunk = [];
//     words.forEach((w) => {
//       const nextLen = (chunk.join(" ") + " " + w).trim().length;
//       if (nextLen < maxChars) chunk.push(w);
//       else {
//         chunks.push(chunk.join(" "));
//         chunk = [w];
//       }
//     });
//     if (chunk.length) chunks.push(chunk.join(" "));
//     return chunks;
//   };

//   const generatePrompt = (inputText) => {
//     // Keep this aligned with Main’s stricter rules
//     return `
// You are an expert plain-language editor. Simplify the text so it is easy to read and understand without losing meaning.
// • Keep facts, intent, and sequence accurate. No hallucinations.
// • Do not add external information.
// • Use clear, concrete, inclusive language.
// • Use consistent terms; avoid double negatives.
// • Return only the rewritten text (no markdown, headings, emojis).
// "${inputText}"
// `.trim();
//   };

//   // 3) NETWORK HELPERS
//   const saveEditToHistory = async (txt) => {
//     const u = safeGetUser();
//     if (!u) return;
//     const { words, chars } = countWordsAndChars(txt);
//     try {
//       await fetch(
//         "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/edit",
//         {
//           method: "PUT",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ email: u.email, inputText, editedText: txt, numWords: words, numChars: chars }),
//         }
//       );
//     } catch (e) {
//       console.error("saveEditToHistory failed:", e);
//     }
//   };

//   // 4) EFFECTS – fetch docs, diff, counters, persist page snapshot
//   useEffect(() => {
//     if (!email) return; // no crash on direct page load
//     (async () => {
//       try {
//         const res = await fetch(
//           `https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/user/${email}`
//         );
//         const result = await res.json();
//         if (res.ok) {
//           const sorted = result.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//           setDocuments(sorted);
//           if (!state && sorted.length) {
//             // default: newest doc + generated version
//             const first = sorted[0];
//             setSelectedDocId(first._id);
//             setSelectedVersionIdx(0);
//             setInputText(first.inputText);
//             setOutputText(first.outputText);
//           }
//         }
//       } catch (err) {
//         console.error("fetch docs", err);
//       }
//     })();
//   }, [email, state]);

//   useEffect(() => setDiffHtml(generateDiff(inputText, outputText)), [inputText, outputText]);

//   useEffect(() => {
//     const { words: wIn, chars: cIn } = countWordsAndChars(inputText);
//     const { words: wOut, chars: cOut } = countWordsAndChars(outputText);
//     setInputWordCount(wIn);
//     setInputCharCount(cIn);
//     setOutputWordCount(wOut);
//     setOutputCharCount(cOut);
//   }, [inputText, outputText]);

//   useEffect(() => {
//     localStorage.setItem("reviewPageState", JSON.stringify({ inputText, outputText, editHistory }));
//   }, [inputText, outputText, editHistory]);

//   // 5) HANDLERS – sidebar, versions, edit, resimplify, save
//   const handleDocumentClick = (doc) => {
//     setSelectedDocId(doc._id);
//     setSelectedVersionIdx(0);
//     setInputText(doc.inputText);
//     setOutputText(doc.outputText);
//   };

//   const handleVersionChange = (docId, idx) => {
//     const doc = documents.find((d) => d._id === docId);
//     if (!doc) return;
//     const txt = idx === 0 ? doc.outputText : (doc.saveHistory ?? [])[idx - 1]?.finalText ?? doc.outputText;
//     setSelectedDocId(docId);
//     setSelectedVersionIdx(idx);
//     setInputText(doc.inputText);
//     setOutputText(txt);
//   };

//   const handleEditChange = (e) => {
//     const txt = e.target.value;
//     setOutputText(txt);
//     setIsSaveButtonEnabled(true);
//     saveEditToHistory(txt);
//   };

//   const handleResimplify = async () => {

//       if (!inputText.trim()) return;
//       setIsLoading(true);
//       try {
//         const chunks = splitTextIntoChunks(inputText, 2000);
//         const requests = chunks.map(async (ch) => {
//           const res = await fetch(
//             "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4",
//             {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({ prompt: generatePrompt(ch) }),
//             }
//           );
//           if (!res.ok) return "";
//           const data = await res.json();

//           // same normalization as Main
//           let text = "";
//           if (typeof data?.response === "string") {
//             text = data.response;
//           } else if (data?.response?.content && Array.isArray(data.response.content)) {
//             text = data.response.content.map((c) => c?.text || "").join(" ").trim();
//           } else if (Array.isArray(data?.choices)) {
//             text = data.choices.map((c) => c?.message?.content || "").join(" ").trim();
//           } else if (typeof data?.text === "string") {
//             text = data.text;
//           }
//           if (!text) {
//             try { text = JSON.stringify(data); } catch { text = String(data); }
//           }
//           return text.replace(/^"|"$/g, "");
//         });
//         const combo = (await Promise.all(requests)).join(" ").trim();
//         setOutputText(combo);
//       } catch (e) {
//         console.error("resimplify failed:", e);
//       } finally {
//         setIsLoading(false);
//       }
// };

//   // const handleResimplify = async () => {
//   //   if (!inputText.trim()) return;
//   //   setIsLoading(true);
//   //   try {
//   //     const chunks = splitTextIntoChunks(inputText, 2000); // match Main’s chunk size
//   //     const requests = chunks.map(async (ch) => {
//   //       const res = await fetch(
//   //         "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4",
//   //         {
//   //           method: "POST",
//   //           headers: { "Content-Type": "application/json" },
//   //           body: JSON.stringify({ prompt: generatePrompt(ch) }),
//   //         }
//   //       );
//   //       if (!res.ok) return "";
//   //       const data = await res.json();
//   //       return (data?.response || data?.text || "").replace(/^"|"$/g, "");
//   //     });
//   //     const combo = (await Promise.all(requests)).join(" ").trim();
//   //     setOutputText(combo);
//   //   } catch (e) {
//   //     console.error("resimplify failed:", e);
//   //   } finally {
//   //     setIsLoading(false);
//   //   }
//   // };

//   const saveFinalOutput = async () => {
//     setIsLoading(true);
//     try {
//       const u = safeGetUser();
//       if (!u) return;
//       const { words, chars } = countWordsAndChars(outputText);
//       const res = await fetch(
//         "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/final",
//         {
//           method: "PUT",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             email: u.email,
//             inputText,
//             finalText: outputText,
//             numWords: words,
//             numChars: chars,
//             readability: 4, // keep your placeholders if your API expects them
//             accuracy: 5,
//             comments: "Looks good.",
//           }),
//         }
//       );
//       if (res.ok) {
//         setIsSaveButtonEnabled(false);
//         setShowSurveyPrompt(true);
//         setSaveHistory((p) => [...p, { timestamp: new Date().toISOString(), finalText: outputText }]);
//         setTimeout(() => surveyRef.current?.scrollIntoView({ behavior: "smooth" }), 300);

//         const currentDoc = documents.find((d) => d._id === selectedDocId);
//         const generatedText = currentDoc ? currentDoc.outputText : initialOutputText;
//         navigate("/survey", {
//           state: {
//             email,
//             inputText,
//             generatedText, // Version-1 (AI)
//             finalText: outputText, // current screen (may include edits)
//             editHistory,
//             saveHistory: [...saveHistory, { timestamp: new Date().toISOString(), finalText: outputText }],
//           },
//         });
//       }
//     } catch (e) {
//       console.error("saveFinalOutput failed:", e);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleLogout = () => {
//     localStorage.removeItem("token");
//     localStorage.removeItem("reviewPageState");
//     navigate("/Login");
//   };

//   const handleCopy = (txt) => navigator.clipboard.writeText(txt);
//   const handleDownload = (txt, name) =>
//     saveAs(new Blob([txt], { type: "text/plain;charset=utf-8" }), `${name}.txt`);

//   // 6) RENDER
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
//         {/* Sidebar */}
//         <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
//           <button className={styles.historyIcon} onClick={() => setIsSidebarVisible((s) => !s)}>
//             🕒 <p style={{ fontSize: 15 }}> History </p>
//           </button>
//           {isSidebarVisible && (
//             <div className={styles.historyContent}>
//               <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>
//                 ✖
//               </button>
//               <ul className={styles.historyList}>
//                 {documents.map((doc, idx) => (
//                   <li key={doc._id} className={styles.historyItem}>
//                     <div
//                       onClick={() => {
//                         setExpandedDocs((p) => ({ ...p, [doc._id]: !p[doc._id] }));
//                         handleDocumentClick(doc);
//                       }}
//                       className={`${styles.docHeader} ${
//                         selectedDocId === doc._id ? styles.activeDoc : ""
//                       }`}
//                     >
//                       <strong>Document {documents.length - idx}</strong> ({doc.inputText.slice(0, 20)}…)
//                     </div>
//                     {expandedDocs[doc._id] && (
//                       <ul className={styles.versionList}>
//                         <li
//                           key="0"
//                           onClick={() => handleVersionChange(doc._id, 0)}
//                           className={
//                             selectedDocId === doc._id && selectedVersionIdx === 0
//                               ? styles.activeVersion
//                               : ""
//                           }
//                         >
//                           Version 1 (Generated)
//                         </li>
//                         {(doc.saveHistory ?? []).map((v, vIdx) => (
//                           <li
//                             key={vIdx + 1}
//                             onClick={() => handleVersionChange(doc._id, vIdx + 1)}
//                             className={
//                               selectedDocId === doc._id && selectedVersionIdx === vIdx + 1
//                                 ? styles.activeVersion
//                                 : ""
//                             }
//                           >
//                             Version {vIdx + 2} ({new Date(v.timestamp).toLocaleDateString()})
//                           </li>
//                         ))}
//                       </ul>
//                     )}
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>

//         {/* Main */}
//         <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
//           <div className={styles.description}>
//             <p>
//               Please review the simplified text, edit if necessary, then save and complete the short
//               survey to help us improve.
//             </p>
//           </div>

//           <div className={styles.textareas_container}>
//             {/* Input */}
//             <div className={styles.text_container}>
//               <div className={styles.labelWrapper}>
//                 <label className={styles.label}>Input Text</label>
//                 <div className={styles.actions}>
//                   <button className={styles.actionButton} onClick={() => handleCopy(inputText)} aria-label="Copy input text">
//                     📋 <span className={styles.iconLabel}>Copy</span>
//                   </button>
//                   <button className={styles.actionButton} onClick={() => handleDownload(inputText, "InputText")} aria-label="Download input text">
//                     📥 <span className={styles.iconLabel}>Download</span>
//                   </button>
//                   <StatsButton text={inputText} />
//                   <button className={styles.actionButton} onClick={handleResimplify} aria-label="Re-simplify input">
//                     🔄 <span className={styles.iconLabel}>Re-simplify</span>
//                   </button>
//                 </div>
//               </div>
//               <p className={styles.countText}>Words: {inputWordCount} | Characters: {inputCharCount}</p>
//               <textarea className={`${styles.textarea} ${styles.side_by_side}`} value={inputText} readOnly />
//             </div>

//             {/* Output */}
//             <div className={styles.text_container}>
//               <div className={styles.labelWrapper}>
//                 <label className={styles.label}>AI-generated Text</label>
//                 <div className={styles.actions}>
//                   <button className={styles.actionButton} onClick={() => handleCopy(outputText)} aria-label="Copy AI-generated text">
//                     📋 <span className={styles.iconLabel}>Copy</span>
//                   </button>
//                   <button className={styles.actionButton} onClick={() => handleDownload(outputText, "GeneratedText")} aria-label="Download AI-generated text">
//                     📥 <span className={styles.iconLabel}>Download</span>
//                   </button>
//                   <StatsButton text={outputText} />
//                   <button className={styles.toggleDiffBtn} onClick={() => setShowDifference((s) => !s)}>
//                     {showDifference ? "Hide Difference" : "Show Difference"}
//                   </button>
//                   <button
//                     className={styles.actionButton}
//                     onClick={() => setIsEditable((s) => !s)}
//                     aria-pressed={isEditable}
//                     aria-label={isEditable ? "Show rendered output" : "Edit the output text"}
//                     title={isEditable ? "Rendered View" : "AI-generated Output"}
//                   >
//                     {isEditable ? "Show Rendered Output" : "Edit Output"}
//                   </button>
//                 </div>
//               </div>
//               <p className={styles.countText}>Words: {outputWordCount} | Characters: {outputCharCount}</p>

//               {isEditable ? (
//                 <textarea
//                   className={`${styles.textarea} ${styles.side_by_side} ${styles.editable}`}
//                   // value={outputText}
//                   value={String(outputText ?? "")}
//                   onChange={handleEditChange}
//                   aria-label="Edit AI-generated text"
//                 />
//               ) : (
//                 <textarea
//                   className={`${styles.textarea} ${styles.side_by_side} ${styles.editable}`}
//                   // value={outputText}
//                   value={String(outputText ?? "")}
//                   onChange={handleEditChange}
//                   aria-label="Edit AI-generated text"
//                 />
//                 // <div className={`${styles.output_box} ${styles.side_by_side}`}>
//                 //   {/* <ReactMarkdown remarkPlugins={[remarkGfm]}>{outputText}</ReactMarkdown> */}
//                 //   <ReactMarkdown remarkPlugins={[remarkGfm]}>{String(outputText ?? "")}</ReactMarkdown>
//                 // </div>
//               )}
//             </div>

//             {/* Diff */}
//             {showDifference && (
//               <div className={styles.text_container}>
//                 <label className={styles.label}>Difference from input</label>
//                 <div
//                   className={`${styles.output_box} ${styles.side_by_side}`}
//                   dangerouslySetInnerHTML={{ __html: diffHtml }}
//                 />
//               </div>
//             )}
//           </div>

//           {/* Save */}
//           <div className={styles.button_container}>
//             <button
//               className={styles.submit_btn}
//               onClick={saveFinalOutput}
//               disabled={!isSaveButtonEnabled || isLoading}
//               title={!isSaveButtonEnabled ? "Make an edit before saving." : ""}
//             >
//               Save
//             </button>
//           </div>

//           {/* Survey Prompt */}
//           {showSurveyPrompt && (
//             <div className={styles.survey_prompt} ref={surveyRef}>
//               <p className={styles.survey_text}>
//                 Please take the survey to help us improve.
//                 <button
//                   className={styles.survey_btn}
//                   onClick={() => {
//                     const doc = documents.find((d) => d._id === selectedDocId);
//                     const generatedText = doc ? doc.outputText : initialOutputText;
//                     navigate("/survey", {
//                       state: {
//                         email,
//                         inputText,
//                         generatedText, // AI v1
//                         finalText: outputText, // current
//                         editHistory,
//                         saveHistory: [
//                           ...saveHistory,
//                           { timestamp: new Date().toISOString(), finalText: outputText },
//                         ],
//                       },
//                     });
//                   }}
//                 >
//                   📑 Take the Survey
//                 </button>
//               </p>
//             </div>
//           )}

//           <p className={styles.help_text}>
//             Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a>
//           </p>
//           <Footer />
//         </div>
//       </div>
//     </>
//   );
// };

// export default Review;


