import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DiffMatchPatch from "diff-match-patch";
import { saveAs } from "file-saver";
import StatsButton from "../StatsButton";
import styles from "./styles.module.css";
import Footer from "../Footer";

/* -------- ErrorBoundary -------- */
class PageBoundary extends React.Component {
  constructor(p){ super(p); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(err){ return { hasError: true, error: err }; }
  componentDidCatch(err, info){ console.error("Review crashed:", err, info); }
  render(){
    if(this.state.hasError){
      return (
        <div style={{padding:16}}>
          <h2>Something went wrong while rendering.</h2>
          <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* -------- Utils -------- */
const dmp = new DiffMatchPatch();
const safeGetUser = () => { try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; } };
const count = (s="") => ({ words: String(s).trim().split(/\s+/).filter(Boolean).length, chars: String(s).length });

const normalizeHeadings = (md="") => {
  const lines = String(md || "").split(/\r?\n/);
  let lastLevel = 1;
  const out = lines.map((line) => {
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (!m) return line;
    let lvl = m[1].length;
    if (lvl < 2) lvl = 2;
    if (lvl > lastLevel + 1) lvl = lastLevel + 1;
    lastLevel = lvl;
    return `${"#".repeat(lvl)} ${m[2].trim()}`;
  });
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

const coerceGFM = (md="") =>
  normalizeHeadings(
    String(md)
      .replace(/^\s*[\*\+]\s/gm, "- ")
      .replace(/^\s*(\d+)\)\s/gm, "$1. ")
      .replace(/[ \t]+$/gm, "")
  );

const diffHTML = (a="", b="") => {
  const diffs = dmp.diff_main(a ?? "", b ?? "");
  dmp.diff_cleanupSemantic(diffs);
  return diffs.map(([op, txt]) => {
    if (op === DiffMatchPatch.DIFF_INSERT) return `<span style="background:#d4fcdc;color:#08660f;">${txt}</span>`;
    if (op === DiffMatchPatch.DIFF_DELETE) return `<span style="background:#ffecec;color:#8f1d1d;text-decoration:line-through;">${txt}</span>`;
    return txt;
  }).join("");
};

/* -------- Minimal Markdown Renderer -------- */
const RenderMD = ({ text }) => {
  const src = String(text || "");
  const lines = src.split(/\r?\n/);
  const nodes = [];
  let list = null;

  const flushList = () => {
    if (list && list.items.length) {
      nodes.push(
        React.createElement(
          list.ordered ? "ol" : "ul",
          { key: `list-${nodes.length}`, style: { margin: "0 0 1rem 1.25rem" } },
          list.items.map((t, i) => <li key={i}>{t}</li>)
        )
      );
    }
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimRight();

    const m = line.match(/^(#{2,6})\s+(.*)$/);
    if (m) {
      flushList();
      const level = m[1].length;
      const Tag = `h${level}`;
      nodes.push(<Tag key={`h-${nodes.length}`}>{m[2]}</Tag>);
      continue;
    }

    const ul = line.match(/^-\s+(.*)$/);
    const ol = line.match(/^(\d+)\.\s+(.*)$/);
    if (ul || ol) {
      if (!list) list = { ordered: !!ol, items: [] };
      list.items.push((ul ? ul[1] : ol[2]).trim());
      continue;
    }

    if (!line.trim()) { flushList(); continue; }

    flushList();
    nodes.push(<p key={`p-${nodes.length}`}>{line}</p>);
  }
  flushList();
  return <div>{nodes}</div>;
};

/* -------- Component -------- */
function ReviewInner(){
  const navigate = useNavigate();
  const { state } = useLocation();
  const surveyRef = useRef(null);

  const fallback = (() => { try { return JSON.parse(sessionStorage.getItem("lastGenerated")) || null; } catch { return null; } })();
  const initialInput  = state?.inputText  ?? fallback?.inputText  ?? "";
  const initialOutput = state?.outputText ?? fallback?.outputText ?? "";

  const user = safeGetUser();
  const email = user?.email ?? null;

  // History / sidebar
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [documents, setDocuments] = useState([]);

  // Main texts
  const [inputText, setInputText] = useState(initialInput);
  const [outputText, setOutputText] = useState(coerceGFM(initialOutput));
  const [originalOutputText, setOriginalOutputText] = useState(coerceGFM(initialOutput));

  // UI/UX
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDifference, setShowDifference] = useState(false);
  const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);

  // Stats + diff
  const [{words:inW, chars:inC}, setInStats]   = useState(count(initialInput));
  const [{words:outW, chars:outC}, setOutStats] = useState(count(initialOutput));
  const [diffHtml, setDiffHtml] = useState(diffHTML(initialInput, initialOutput));

  // Quick prefs
  const [lengthChoice, setLengthChoice] = useState("same");
  const [tone, setTone] = useState("neutral");

  useEffect(() => setInStats(count(inputText)), [inputText]);
  useEffect(() => { setOutStats(count(outputText)); setDiffHtml(diffHTML(inputText, outputText)); }, [inputText, outputText]);

  /* Fetch history list (for sidebar) */
  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const res = await fetch(`/api/simplifications/user/${email}`);
        const json = await res.json();
        if (res.ok && Array.isArray(json?.data)) {
          const sorted = json.data.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
          setDocuments(sorted);
        }
      } catch (e) {
        console.error("fetch history failed", e);
      }
    })();
  }, [email]);

  const loadDocument = (doc) => {
    const gen = coerceGFM(doc?.outputText || "");
    const final = coerceGFM(doc?.finalOutput?.text || gen);
    setInputText(doc?.inputText || "");
    setOriginalOutputText(gen);
    setOutputText(final);
    setIsEditing(false);
    setShowDifference(false);
    setIsDirty(false);
  };

  const buildPrefsSnapshot = useCallback(() => ({ lengthChoice, tone }), [lengthChoice, tone]);

  useEffect(() => {
    if (!inputText.trim()) return;
    const t = setTimeout(() => regenerate(), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lengthChoice, tone]);

  const buildPrefsText = useCallback(() => {
    const ratios = { same: 1, shorter: 0.75, much_shorter: 0.5 };
    const target = Math.max(10, Math.round(inW * (ratios[lengthChoice] ?? 1)));
    const toneLine = tone !== "neutral" ? `• Use a ${tone} tone.\n` : "";
    return `• Aim for ~${target} words while preserving meaning.\n${toneLine}`;
  }, [inW, lengthChoice, tone]);

  const buildPrompt = useCallback(
    (text) => `

You are an expert plain-language editor. Rewrite the text in clear **GitHub-Flavored Markdown** so it is easy to read and understand **without losing meaning**.

  Follow these core rules:
• Keep facts, intent, and sequence accurate. No hallucinations.
• Do not add external information.
• Use inclusive, gender-neutral language when needed.
• Use consistent terms for the same concept; avoid double negatives.
• Start headings at **#** (heading 1). Do not skip levels.
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

User Preferences:
${buildPrefsText()}

Text:
"${text}"
`.trim(),
    [buildPrefsText]
  );

  const splitChunks = (txt, max=3500) => {
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
      const chunks = splitChunks(inputText);
      const reqs = chunks.map(async (ch) => {
        const res = await fetch("/api/gpt4", {
          method: "POST",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ prompt: buildPrompt(ch) })
        });
        const data = await res.json();
        let t = "";
        if (typeof data?.response === "string") t = data.response;
        else if (Array.isArray(data?.choices)) t = data.choices.map(c => c?.message?.content || "").join(" ");
        else if (typeof data?.text === "string") t = data.text;
        else if (data?.response?.content) t = data.response.content.map(c => c?.text || "").join(" ");
        return coerceGFM(t);
      });

      const combined = coerceGFM((await Promise.all(reqs)).join("\n\n"));
      setOutputText(combined);
      setIsDirty(true);

      if (email) {
        try {
          await fetch("/api/simplifications/version", {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({
              email,
              inputText,
              producedText: combined,
              source: "resimplify",
              prefsSnapshot: buildPrefsSnapshot(),
            })
          });
        } catch (e) {
          console.error("version save failed", e);
        }
      }
    } catch (e) {
      console.error("regenerate", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFinal = async () => {
    navigate("/survey", {
      state: {
        email,
        inputText,
        generatedText: originalOutputText,
        finalText: outputText,
      },
    });
  };

  const onEditChange = (e) => { setOutputText(coerceGFM(e.target.value)); setIsDirty(true); };

  /* -------- Render -------- */
  return (
    <>
      <nav className={styles.navbar}>
        <h1 onClick={() => (window.location.href = "/")} style={{ cursor: "pointer" }}>
          Text Simplification Tool
        </h1>
        <button className={styles.white_btn} onClick={() => navigate("/Login")}>Logout</button>
      </nav>

      {/* Floating history button */}
      <div className={styles.historyFabWrap}>
        <button
          onClick={() => setIsSidebarVisible(s => !s)}
          title="History"
          className={styles.historyFab}
        >
          🕓
        </button>
      </div>

      {/* Slide-in history panel */}
      {isSidebarVisible && (
        <div className={styles.historyPanel}>
          <div className={styles.historyHeader}>
            <h3>History</h3>
            <button onClick={() => setIsSidebarVisible(false)} className={styles.historyClose}>✖</button>
          </div>
          <ul className={styles.historyList}>
            {documents.map((doc, idx) => (
              <li
                key={doc._id}
                onClick={() => { loadDocument(doc); setIsSidebarVisible(false); }}
                className={styles.historyItem}
              >
                <div style={{ fontWeight:600 }}>Document {documents.length - idx}</div>
                <div style={{ fontSize:12, color:"#666" }}>
                  {new Date(doc.createdAt).toLocaleString()}
                </div>
                <div style={{ fontSize:13, color:"#444", marginTop:4 }}>
                  {(doc.inputText || "").slice(0, 60)}…
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ===== Centered content wrapper (matches CSS names) ===== */}
      <div className={styles.container}>
        <div className={styles.textareas_container}>
          {/* Input column */}
          <div className={styles.text_container}>
            <div className={styles.labelWrapper}>
              <label className={styles.label}>Input Text</label>
              <div className={styles.actions}>
                <StatsButton text={inputText}/>
                <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(inputText)}>📋 Copy</button>
                <button className={styles.actionButton} onClick={() => saveAs(new Blob([inputText],{type:"text/plain;charset=utf-8"}), "InputText.txt")}>📥 Download</button>
              </div>
            </div>
            <p className={styles.countText}>Words: {inW} | Characters: {inC}</p>
            <textarea className={styles.textarea} value={inputText} readOnly />
          </div>

          {/* Output column */}
          <div className={styles.text_container}>
            <div className={styles.labelWrapper}>
              <label className={styles.label}>AI-generated Text (Markdown)</label>
              <div className={styles.actions}>
                <StatsButton text={outputText}/>
                <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(outputText)}>📋 Copy</button>
                <button className={styles.actionButton} onClick={() => saveAs(new Blob([outputText],{type:"text/markdown;charset=utf-8"}), "Generated.md")}>📥 Download</button>
                <button className={styles.toggleDiffBtn} onClick={() => setShowDifference(s => !s)}>
                  {showDifference ? "Hide Difference" : "Show Difference"}
                </button>
                <button
                  className={styles.editButton}
                  onClick={() => setIsEditing(s => !s)}
                  style={{ background:"#0078d4", color:"#fff", fontWeight:600, borderRadius:6, padding:"6px 12px" }}
                >
                  {isEditing ? "Show Rendered" : "✏️ Edit Output"}
                </button>
              </div>
            </div>

            {isDirty && (
              <div className={styles.unsavedBanner}>⚠️ Unsaved changes</div>
            )}

            {/* Quick Prefs (unchanged placement) */}
            <div className={styles.quickPrefs} style={{ margin: "20px 0" }}>
              <div style={{ marginBottom: 16 }}>
                <span style={{ display:"block", marginBottom:8, fontWeight:600 }}>Output length</span>
                <input
                  type="range" min="0" max="2"
                  value={["same","shorter","much_shorter"].indexOf(lengthChoice)}
                  onChange={(e)=>setLengthChoice(["same","shorter","much_shorter"][Number(e.target.value)])}
                  style={{ width:"100%", height: "14px" }}
                />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                  <span>Same</span><span>Shorter</span><span>Much shorter</span>
                </div>
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <label style={{ fontWeight:600 }}>Tone</label>
                <select value={tone} onChange={(e)=>setTone(e.target.value)} style={{ padding:"6px 10px", fontSize:15 }}>
                  <option value="neutral">Neutral</option>
                  <option value="formal">Formal</option>
                  <option value="academic">Academic</option>
                  <option value="casual">Casual</option>
                  <option value="creative">Creative</option>
                </select>
              </div>
            </div>

            <p className={styles.countText}>Words: {outW} | Characters: {outC}</p>

            {isEditing ? (
              <textarea
                className={`${styles.textarea} ${styles.editable}`}
                value={outputText}
                onChange={onEditChange}
                aria-label="Edit AI-generated markdown"
              />
            ) : (
              <div className={styles.output_box}>
                <RenderMD text={outputText}/>
              </div>
            )}
          </div>
        </div>

        {showDifference && (
          <div className={styles.text_container} style={{ maxWidth: "1400px", width: "100%" }}>
            <div className={styles.labelWrapper}>
              <label className={styles.label}>Difference (vs input)</label>
            </div>
            <div className={styles.output_box} dangerouslySetInnerHTML={{ __html: diffHtml }} />
          </div>
        )}

        <div className={styles.button_container}>
          <button className={styles.submit_btn} onClick={saveFinal}>Save & Continue</button>
        </div>
      </div>

      {/* Footer is BELOW everything */}
      <Footer />
    </>
  );
}

export default function Review(){
  return (
    <PageBoundary>
      <ReviewInner />
    </PageBoundary>
  );
}

// import React, { useEffect, useRef, useState, useCallback } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import { saveAs } from "file-saver";
// import StatsButton from "../StatsButton";
// import styles from "./styles.module.css";
// import Footer from "../Footer";

// /* -------- ErrorBoundary -------- */
// class PageBoundary extends React.Component {
//   constructor(p){ super(p); this.state = { hasError: false, error: null }; }
//   static getDerivedStateFromError(err){ return { hasError: true, error: err }; }
//   componentDidCatch(err, info){ console.error("Review crashed:", err, info); }
//   render(){
//     if(this.state.hasError){
//       return (
//         <div style={{padding:16}}>
//           <h2>Something went wrong while rendering.</h2>
//           <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.error)}</pre>
//         </div>
//       );
//     }
//     return this.props.children;
//   }
// }

// /* -------- Utils -------- */
// const dmp = new DiffMatchPatch();
// const safeGetUser = () => { try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; } };
// const count = (s="") => ({ words: String(s).trim().split(/\s+/).filter(Boolean).length, chars: String(s).length });

// const normalizeHeadings = (md="") => {
//   const lines = String(md || "").split(/\r?\n/);
//   let lastLevel = 1;
//   const out = lines.map((line) => {
//     const m = line.match(/^(#{1,6})\s+(.*)$/);
//     if (!m) return line;
//     let lvl = m[1].length;
//     if (lvl < 2) lvl = 2;
//     if (lvl > lastLevel + 1) lvl = lastLevel + 1;
//     lastLevel = lvl;
//     return `${"#".repeat(lvl)} ${m[2].trim()}`;
//   });
//   return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
// };

// const coerceGFM = (md="") =>
//   normalizeHeadings(
//     String(md)
//       .replace(/^\s*[\*\+]\s/gm, "- ")
//       .replace(/^\s*(\d+)\)\s/gm, "$1. ")
//       .replace(/[ \t]+$/gm, "")
//   );

// const diffHTML = (a="", b="") => {
//   const diffs = dmp.diff_main(a ?? "", b ?? "");
//   dmp.diff_cleanupSemantic(diffs);
//   return diffs.map(([op, txt]) => {
//     if (op === DiffMatchPatch.DIFF_INSERT) return `<span style="background:#d4fcdc;color:#08660f;">${txt}</span>`;
//     if (op === DiffMatchPatch.DIFF_DELETE) return `<span style="background:#ffecec;color:#8f1d1d;text-decoration:line-through;">${txt}</span>`;
//     return txt;
//   }).join("");
// };

// /* -------- Minimal Markdown Renderer -------- */
// const RenderMD = ({ text }) => {
//   const src = String(text || "");
//   const lines = src.split(/\r?\n/);
//   const nodes = [];
//   let list = null;

//   const flushList = () => {
//     if (list && list.items.length) {
//       nodes.push(
//         React.createElement(
//           list.ordered ? "ol" : "ul",
//           { key: `list-${nodes.length}`, style: { margin: "0 0 1rem 1.25rem" } },
//           list.items.map((t, i) => <li key={i}>{t}</li>)
//         )
//       );
//     }
//     list = null;
//   };

//   for (const raw of lines) {
//     const line = raw.trimRight();

//     const m = line.match(/^(#{2,6})\s+(.*)$/);
//     if (m) {
//       flushList();
//       const level = m[1].length;
//       const Tag = `h${level}`;
//       nodes.push(<Tag key={`h-${nodes.length}`}>{m[2]}</Tag>);
//       continue;
//     }

//     const ul = line.match(/^-\s+(.*)$/);
//     const ol = line.match(/^(\d+)\.\s+(.*)$/);
//     if (ul || ol) {
//       if (!list) list = { ordered: !!ol, items: [] };
//       list.items.push((ul ? ul[1] : ol[2]).trim());
//       continue;
//     }

//     if (!line.trim()) { flushList(); continue; }

//     flushList();
//     nodes.push(<p key={`p-${nodes.length}`}>{line}</p>);
//   }
//   flushList();
//   return <div>{nodes}</div>;
// };

// /* -------- Component -------- */
// function ReviewInner(){
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const surveyRef = useRef(null);

//   const fallback = (() => { try { return JSON.parse(sessionStorage.getItem("lastGenerated")) || null; } catch { return null; } })();
//   const initialInput  = state?.inputText  ?? fallback?.inputText  ?? "";
//   const initialOutput = state?.outputText ?? fallback?.outputText ?? "";

//   const user = safeGetUser();
//   const email = user?.email ?? null;

//   // History / sidebar
//   const [isSidebarVisible, setIsSidebarVisible] = useState(false);
//   const [documents, setDocuments] = useState([]);

//   // Main texts
//   const [inputText, setInputText] = useState(initialInput);
//   const [outputText, setOutputText] = useState(coerceGFM(initialOutput));
//   const [originalOutputText, setOriginalOutputText] = useState(coerceGFM(initialOutput));

//   // UI/UX
//   const [isLoading, setIsLoading] = useState(false);
//   const [isEditing, setIsEditing] = useState(false);
//   const [isDirty, setIsDirty] = useState(false);
//   const [showDifference, setShowDifference] = useState(false);
//   const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);

//   // Stats + diff
//   const [{words:inW, chars:inC}, setInStats]   = useState(count(initialInput));
//   const [{words:outW, chars:outC}, setOutStats] = useState(count(initialOutput));
//   const [diffHtml, setDiffHtml] = useState(diffHTML(initialInput, initialOutput));

//   // Quick prefs (unchanged)
//   const [lengthChoice, setLengthChoice] = useState("same");
//   const [tone, setTone] = useState("neutral");

//   useEffect(() => setInStats(count(inputText)), [inputText]);
//   useEffect(() => { setOutStats(count(outputText)); setDiffHtml(diffHTML(inputText, outputText)); }, [inputText, outputText]);

//   /* Fetch history list (for sidebar) */
//   useEffect(() => {
//     if (!email) return;
//     (async () => {
//       try {
//         const res = await fetch(`/api/simplifications/user/${email}`);
//         const json = await res.json();
//         if (res.ok && Array.isArray(json?.data)) {
//           const sorted = json.data.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
//           setDocuments(sorted);
//         }
//       } catch (e) {
//         console.error("fetch history failed", e);
//       }
//     })();
//   }, [email]);

//   const loadDocument = (doc) => {
//     const gen = coerceGFM(doc?.outputText || "");
//     const final = coerceGFM(doc?.finalOutput?.text || gen);
//     setInputText(doc?.inputText || "");
//     setOriginalOutputText(gen);
//     setOutputText(final);
//     setIsEditing(false);
//     setShowDifference(false);
//     setIsDirty(false);
//   };

//   const buildPrefsSnapshot = useCallback(() => ({ lengthChoice, tone }), [lengthChoice, tone]);

//   useEffect(() => {
//     if (!inputText.trim()) return;
//     const t = setTimeout(() => regenerate(), 800);
//     return () => clearTimeout(t);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [lengthChoice, tone]);

//   const buildPrefsText = useCallback(() => {
//     const ratios = { same: 1, shorter: 0.75, much_shorter: 0.5 };
//     const target = Math.max(10, Math.round(inW * (ratios[lengthChoice] ?? 1)));
//     const toneLine = tone !== "neutral" ? `• Use a ${tone} tone.\n` : "";
//     return `• Aim for ~${target} words while preserving meaning.\n${toneLine}`;
//   }, [inW, lengthChoice, tone]);

//   const buildPrompt = useCallback(
//     (text) => `
// You are an expert plain-language editor. Rewrite the text in clear **GitHub-Flavored Markdown** so it is easy to read and understand **without losing meaning**.

// Follow these core rules:
// • Keep facts, intent, and sequence accurate. No hallucinations.
// • Do not add external information.
// • Use inclusive, gender-neutral language when needed.
// • Use consistent terms for the same concept; avoid double negatives.
// • Start content headings at **#** (start from H1 in body). Do not skip levels.
// • Return **only** the rewritten Markdown (no extra commentary).

// 1) Vocabulary & Tone
// - Replace technical or abstract words with simpler alternatives.
// - Define complex but necessary terms in parentheses on first use.
// - Remove idioms, metaphors, and jargon.

// 2) Sentence Structure
// - Aim for sentences of 10–15 words.
// - Prefer active voice; avoid nested clauses and unclear pronouns.

// 3) Structure & Flow
// - Organize with clear headings/subheadings (start at ##; no level skips).
// - Use lists for steps or key points.
// - Keep paragraphs short; one idea per paragraph.

// User Preferences:
// ${buildPrefsText()}

// Text:
// "${text}"
// `.trim(),
//     [buildPrefsText]
//   );

//   const splitChunks = (txt, max=3500) => {
//     const words = String(txt).split(/\s+/);
//     const chunks = [];
//     let cur = [];
//     for (const w of words) {
//       const next = (cur.join(" ") + " " + w).trim();
//       if (next.length <= max) cur.push(w);
//       else { if (cur.length) chunks.push(cur.join(" ")); cur = [w]; }
//     }
//     if (cur.length) chunks.push(cur.join(" "));
//     return chunks;
//   };

//   const regenerate = async () => {
//     if (!inputText.trim()) return;
//     setIsLoading(true);
//     try {
//       const chunks = splitChunks(inputText);
//       const reqs = chunks.map(async (ch) => {
//         const res = await fetch("/api/gpt4", {
//           method: "POST",
//           headers: { "Content-Type":"application/json" },
//           body: JSON.stringify({ prompt: buildPrompt(ch) })
//         });
//         const data = await res.json();
//         let t = "";
//         if (typeof data?.response === "string") t = data.response;
//         else if (Array.isArray(data?.choices)) t = data.choices.map(c => c?.message?.content || "").join(" ");
//         else if (typeof data?.text === "string") t = data.text;
//         else if (data?.response?.content) t = data.response.content.map(c => c?.text || "").join(" ");
//         return coerceGFM(t);
//       });

//       const combined = coerceGFM((await Promise.all(reqs)).join("\n\n"));
//       setOutputText(combined);
//       setIsDirty(true);

//       if (email) {
//         try {
//           await fetch("/api/simplifications/version", {
//             method: "POST",
//             headers: { "Content-Type":"application/json" },
//             body: JSON.stringify({
//               email,
//               inputText,
//               producedText: combined,
//               source: "resimplify",
//               prefsSnapshot: buildPrefsSnapshot(),
//             })
//           });
//         } catch (e) {
//           console.error("version save failed", e);
//         }
//       }
//     } catch (e) {
//       console.error("regenerate", e);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const saveFinal = async () => {
//     navigate("/survey", {
//       state: {
//         email,
//         inputText,
//         generatedText: originalOutputText,
//         finalText: outputText,
//       },
//     });
//   };

//   const onEditChange = (e) => { setOutputText(coerceGFM(e.target.value)); setIsDirty(true); };

//   /* -------- Render -------- */
//   return (
//     <>
//       <nav className={styles.navbar}>
//         <h1 onClick={() => (window.location.href = "/")} style={{ cursor: "pointer" }}>
//           Text Simplification Tool
//         </h1>
//         <button className={styles.white_btn} onClick={() => navigate("/Login")}>Logout</button>
//       </nav>

//       {/* Floating history button */}
//       <div className={styles.historyFabWrap}>
//         <button
//           onClick={() => setIsSidebarVisible(s => !s)}
//           title="History"
//           className={styles.historyFab}
//         >
//           🕓
//         </button>
//       </div>

//       {/* Slide-in history panel */}
//       {isSidebarVisible && (
//         <div className={styles.historyPanel}>
//           <div className={styles.historyHeader}>
//             <h3>History</h3>
//             <button onClick={() => setIsSidebarVisible(false)} className={styles.historyClose}>✖</button>
//           </div>
//           <ul className={styles.historyList}>
//             {documents.map((doc, idx) => (
//               <li
//                 key={doc._id}
//                 onClick={() => { loadDocument(doc); setIsSidebarVisible(false); }}
//                 className={styles.historyItem}
//               >
//                 <div style={{ fontWeight:600 }}>Document {documents.length - idx}</div>
//                 <div style={{ fontSize:12, color:"#666" }}>
//                   {new Date(doc.createdAt).toLocaleString()}
//                 </div>
//                 <div style={{ fontSize:13, color:"#444", marginTop:4 }}>
//                   {(doc.inputText || "").slice(0, 60)}…
//                 </div>
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}

//       {/* ===== Centered content wrapper ===== */}
//       <main className={styles.centerWrap}>
//         <section className={styles.twoCols}>
//           {/* Input column */}
//           <div className={styles.text_container}>
//             <div className={styles.labelWrapper}>
//               <label className={styles.label}>Input Text</label>
//               <div className={styles.actions}>
//                 <StatsButton text={inputText}/>
//                 <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(inputText)}>📋 Copy</button>
//                 <button className={styles.actionButton} onClick={() => saveAs(new Blob([inputText],{type:"text/plain;charset=utf-8"}), "InputText.txt")}>📥 Download</button>
//               </div>
//             </div>
//             <p className={styles.countText}>Words: {inW} | Characters: {inC}</p>
//             <textarea className={`${styles.textarea}`} value={inputText} readOnly />
//           </div>

//           {/* Output column */}
//           <div className={styles.text_container}>
//             <div className={styles.labelWrapper}>
//               <label className={styles.label}>AI-generated Text (Markdown)</label>
//               <div className={styles.actions}>
//                 <StatsButton text={outputText}/>
//                 <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(outputText)}>📋 Copy</button>
//                 <button className={styles.actionButton} onClick={() => saveAs(new Blob([outputText],{type:"text/markdown;charset=utf-8"}), "Generated.md")}>📥 Download</button>
//                 <button className={styles.toggleDiffBtn} onClick={() => setShowDifference(s => !s)}>
//                   {showDifference ? "Hide Difference" : "Show Difference"}
//                 </button>
//                 <button
//                   className={styles.editButton}
//                   onClick={() => setIsEditing(s => !s)}
//                   style={{ background:"#0078d4", color:"#fff", fontWeight:600, borderRadius:6, padding:"6px 12px" }}
//                 >
//                   {isEditing ? "Show Rendered" : "✏️ Edit Output"}
//                 </button>
//               </div>
//             </div>

//             {isDirty && (
//               <div className={styles.unsavedBanner}>
//                 ⚠️ Unsaved changes
//               </div>
//             )}

//             {/* Quick Prefs (unchanged placement) */}
//             <div className={styles.quickPrefs} style={{ margin: "20px 0" }}>
//               <div style={{ marginBottom: 16 }}>
//                 <span style={{ display:"block", marginBottom:8, fontWeight:600 }}>Output length</span>
//                 <input
//                   type="range" min="0" max="2"
//                   value={["same","shorter","much_shorter"].indexOf(lengthChoice)}
//                   onChange={(e)=>setLengthChoice(["same","shorter","much_shorter"][Number(e.target.value)])}
//                   style={{ width:"100%", height: "14px" }}
//                 />
//                 <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
//                   <span>Same</span><span>Shorter</span><span>Much shorter</span>
//                 </div>
//               </div>

//               <div style={{ display:"flex", alignItems:"center", gap:12 }}>
//                 <label style={{ fontWeight:600 }}>Tone</label>
//                 <select value={tone} onChange={(e)=>setTone(e.target.value)} style={{ padding:"6px 10px", fontSize:15 }}>
//                   <option value="neutral">Neutral</option>
//                   <option value="formal">Formal</option>
//                   <option value="academic">Academic</option>
//                   <option value="casual">Casual</option>
//                   <option value="creative">Creative</option>
//                 </select>
//               </div>
//             </div>

//             <p className={styles.countText}>Words: {outW} | Characters: {outC}</p>

//             {isEditing ? (
//               <textarea
//                 className={`${styles.textarea} ${styles.editable}`}
//                 value={outputText}
//                 onChange={onEditChange}
//                 aria-label="Edit AI-generated markdown"
//               />
//             ) : (
//               <div className={styles.output_box}>
//                 <RenderMD text={outputText}/>
//               </div>
//             )}
//           </div>
//         </section>

//         {showDifference && (
//           <section className={styles.diffSection}>
//             <div className={styles.labelWrapper}>
//               <label className={styles.label}>Difference (vs input)</label>
//             </div>
//             <div className={styles.output_box} dangerouslySetInnerHTML={{ __html: diffHtml }} />
//           </section>
//         )}

//         <div className={styles.button_container}>
//           <button className={styles.submit_btn} onClick={saveFinal}>Save & Continue</button>
//         </div>
//       </main>

//       {/* Footer is BELOW everything */}
//       <Footer />
//     </>
//   );
// }

// export default function Review(){
//   return (
//     <PageBoundary>
//       <ReviewInner />
//     </PageBoundary>
//   );
// }

// import React, { useEffect, useRef, useState, useCallback } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import { saveAs } from "file-saver";
// import StatsButton from "../StatsButton";
// import styles from "./styles.module.css";
// import Footer from "../Footer";

// /* -------- ErrorBoundary -------- */
// class PageBoundary extends React.Component {
//   constructor(p){ super(p); this.state = { hasError: false, error: null }; }
//   static getDerivedStateFromError(err){ return { hasError: true, error: err }; }
//   componentDidCatch(err, info){ console.error("Review crashed:", err, info); }
//   render(){
//     if(this.state.hasError){
//       return (
//         <div style={{padding:16}}>
//           <h2>Something went wrong while rendering.</h2>
//           <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.error)}</pre>
//         </div>
//       );
//     }
//     return this.props.children;
//   }
// }

// /* -------- Utils -------- */
// const dmp = new DiffMatchPatch();
// const safeGetUser = () => { try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; } };
// const count = (s="") => ({ words: String(s).trim().split(/\s+/).filter(Boolean).length, chars: String(s).length });

// const normalizeHeadings = (md="") => {
//   const lines = String(md || "").split(/\r?\n/);
//   let lastLevel = 1;
//   const out = lines.map((line) => {
//     const m = line.match(/^(#{1,6})\s+(.*)$/);
//     if (!m) return line;
//     let lvl = m[1].length;
//     if (lvl < 2) lvl = 2;               // start at H2 in body
//     if (lvl > lastLevel + 1) lvl = lastLevel + 1; // no level skips
//     lastLevel = lvl;
//     return `${"#".repeat(lvl)} ${m[2].trim()}`;
//   });
//   return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
// };

// const coerceGFM = (md="") =>
//   normalizeHeadings(
//     String(md)
//       .replace(/^\s*[\*\+]\s/gm, "- ")
//       .replace(/^\s*(\d+)\)\s/gm, "$1. ")
//       .replace(/[ \t]+$/gm, "")
//   );

// const diffHTML = (a="", b="") => {
//   const diffs = dmp.diff_main(a ?? "", b ?? "");
//   dmp.diff_cleanupSemantic(diffs);
//   return diffs.map(([op, txt]) => {
//     if (op === DiffMatchPatch.DIFF_INSERT) return `<span style="background:#d4fcdc;color:#08660f;">${txt}</span>`;
//     if (op === DiffMatchPatch.DIFF_DELETE) return `<span style="background:#ffecec;color:#8f1d1d;text-decoration:line-through;">${txt}</span>`;
//     return txt;
//   }).join("");
// };

// /* -------- Minimal Markdown Renderer -------- */
// const RenderMD = ({ text }) => {
//   const src = String(text || "");
//   const lines = src.split(/\r?\n/);
//   const nodes = [];
//   let list = null;

//   const flushList = () => {
//     if (list && list.items.length) {
//       nodes.push(
//         React.createElement(
//           list.ordered ? "ol" : "ul",
//           { key: `list-${nodes.length}`, style: { margin: "0 0 1rem 1.25rem" } },
//           list.items.map((t, i) => <li key={i}>{t}</li>)
//         )
//       );
//     }
//     list = null;
//   };

//   for (const raw of lines) {
//     const line = raw.trimRight();

//     const m = line.match(/^(#{2,6})\s+(.*)$/);
//     if (m) {
//       flushList();
//       const level = m[1].length;
//       const Tag = `h${level}`;
//       nodes.push(<Tag key={`h-${nodes.length}`}>{m[2]}</Tag>);
//       continue;
//     }

//     const ul = line.match(/^-\s+(.*)$/);
//     const ol = line.match(/^(\d+)\.\s+(.*)$/);
//     if (ul || ol) {
//       if (!list) list = { ordered: !!ol, items: [] };
//       list.items.push((ul ? ul[1] : ol[2]).trim());
//       continue;
//     }

//     if (!line.trim()) { flushList(); continue; }

//     flushList();
//     nodes.push(<p key={`p-${nodes.length}`}>{line}</p>);
//   }
//   flushList();
//   return <div>{nodes}</div>;
// };

// /* -------- Component -------- */
// function ReviewInner(){
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const surveyRef = useRef(null);

//   const fallback = (() => { try { return JSON.parse(sessionStorage.getItem("lastGenerated")) || null; } catch { return null; } })();
//   const initialInput  = state?.inputText  ?? fallback?.inputText  ?? "";
//   const initialOutput = state?.outputText ?? fallback?.outputText ?? "";

//   const user = safeGetUser();
//   const email = user?.email ?? null;

//   // History / sidebar
//   const [isSidebarVisible, setIsSidebarVisible] = useState(false);
//   const [documents, setDocuments] = useState([]);

//   // Main texts
//   const [inputText, setInputText] = useState(initialInput);
//   const [outputText, setOutputText] = useState(coerceGFM(initialOutput));
//   const [originalOutputText, setOriginalOutputText] = useState(coerceGFM(initialOutput)); // frozen first AI result

//   // UI/UX
//   const [isLoading, setIsLoading] = useState(false);
//   const [isEditing, setIsEditing] = useState(false);
//   const [isDirty, setIsDirty] = useState(false);
//   const [showDifference, setShowDifference] = useState(false);
//   const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);

//   // Stats + diff
//   const [{words:inW, chars:inC}, setInStats]   = useState(count(initialInput));
//   const [{words:outW, chars:outC}, setOutStats] = useState(count(initialOutput));
//   const [diffHtml, setDiffHtml] = useState(diffHTML(initialInput, initialOutput));

//   // Quick prefs (keep placement as-is)
//   const [lengthChoice, setLengthChoice] = useState("same");
//   const [tone, setTone] = useState("neutral");

//   useEffect(() => setInStats(count(inputText)), [inputText]);
//   useEffect(() => { setOutStats(count(outputText)); setDiffHtml(diffHTML(inputText, outputText)); }, [inputText, outputText]);

//   /* Fetch history list (for sidebar) */
//   useEffect(() => {
//     if (!email) return;
//     (async () => {
//       try {
//         const res = await fetch(`/api/simplifications/user/${email}`);
//         const json = await res.json();
//         if (res.ok && Array.isArray(json?.data)) {
//           const sorted = json.data.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
//           setDocuments(sorted);
//         }
//       } catch (e) {
//         console.error("fetch history failed", e);
//       }
//     })();
//   }, [email]);

//   /* Load a historical doc into the page */
//   const loadDocument = (doc) => {
//     const gen = coerceGFM(doc?.outputText || "");
//     const final = coerceGFM(doc?.finalOutput?.text || gen);
//     setInputText(doc?.inputText || "");
//     setOriginalOutputText(gen); // what model produced originally
//     setOutputText(final);       // latest user-edited or same as gen
//     setIsEditing(false);
//     setShowDifference(false);
//     setIsDirty(false);
//   };

//   /* Build a snapshot we will save with each regenerate */
//   const buildPrefsSnapshot = useCallback(() => ({
//     lengthChoice,
//     tone,
//   }), [lengthChoice, tone]);

//   /* Auto-regenerate when length/tone change (debounced) */
//   useEffect(() => {
//     if (!inputText.trim()) return;
//     const t = setTimeout(() => regenerate(), 800);
//     return () => clearTimeout(t);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [lengthChoice, tone]);

//   /* Human-readable prefs block for the prompt */
//   const buildPrefsText = useCallback(() => {
//     const ratios = { same: 1, shorter: 0.75, much_shorter: 0.5 };
//     const target = Math.max(10, Math.round(inW * (ratios[lengthChoice] ?? 1)));
//     const toneLine = tone !== "neutral" ? `• Use a ${tone} tone.\n` : "";
//     return `• Aim for ~${target} words while preserving meaning.\n${toneLine}`;
//   }, [inW, lengthChoice, tone]);

//   const buildPrompt = useCallback(
//     (text) => `
// You are an expert plain-language editor. Rewrite the text in clear **GitHub-Flavored Markdown** so it is easy to read and understand **without losing meaning**.

// Follow these core rules:
// • Keep facts, intent, and sequence accurate. No hallucinations.
// • Do not add external information.
// • Use inclusive, gender-neutral language when needed.
// • Use consistent terms for the same concept; avoid double negatives.
// • Start content headings at **##** (no H1 in body). Do not skip levels.
// • Return **only** the rewritten Markdown (no extra commentary).

// 1) Vocabulary & Tone
// - Replace technical or abstract words with simpler alternatives.
// - Define complex but necessary terms in parentheses on first use.
// - Remove idioms, metaphors, and jargon.

// 2) Sentence Structure
// - Aim for sentences of 10–15 words.
// - Prefer active voice; avoid nested clauses and unclear pronouns.

// 3) Structure & Flow
// - Organize with clear headings/subheadings (start at ##; no level skips).
// - Use lists for steps or key points.
// - Keep paragraphs short; one idea per paragraph.

// User Preferences:
// ${buildPrefsText()}

// Text:
// "${text}"
// `.trim(),
//     [buildPrefsText]
//   );

//   const splitChunks = (txt, max=3500) => {
//     const words = String(txt).split(/\s+/);
//     const chunks = [];
//     let cur = [];
//     for (const w of words) {
//       const next = (cur.join(" ") + " " + w).trim();
//       if (next.length <= max) cur.push(w);
//       else { if (cur.length) chunks.push(cur.join(" ")); cur = [w]; }
//     }
//     if (cur.length) chunks.push(cur.join(" "));
//     return chunks;
//   };

//   const regenerate = async () => {
//     if (!inputText.trim()) return;
//     setIsLoading(true);
//     try {
//       const chunks = splitChunks(inputText);
//       const reqs = chunks.map(async (ch) => {
//         const res = await fetch("/api/gpt4", {
//           method: "POST",
//           headers: { "Content-Type":"application/json" },
//           body: JSON.stringify({ prompt: buildPrompt(ch) })
//         });
//         const data = await res.json();
//         let t = "";
//         if (typeof data?.response === "string") t = data.response;
//         else if (Array.isArray(data?.choices)) t = data.choices.map(c => c?.message?.content || "").join(" ");
//         else if (typeof data?.text === "string") t = data.text;
//         else if (data?.response?.content) t = data.response.content.map(c => c?.text || "").join(" ");
//         return coerceGFM(t);
//       });

//       const combined = coerceGFM((await Promise.all(reqs)).join("\n\n"));
//       setOutputText(combined);
//       setIsDirty(true);

//       // Persist a version row with prefsSnapshot (if your backend route exists)
//       if (email) {
//         try {
//           await fetch("/api/simplifications/version", {
//             method: "POST",
//             headers: { "Content-Type":"application/json" },
//             body: JSON.stringify({
//               email,
//               inputText,
//               producedText: combined,
//               source: "resimplify",
//               prefsSnapshot: buildPrefsSnapshot(),
//             })
//           });
//         } catch (e) {
//           console.error("version save failed", e);
//         }
//       }
//     } catch (e) {
//       console.error("regenerate", e);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const saveFinal = async () => {
//     navigate("/survey", {
//       state: {
//         email,
//         inputText,
//         generatedText: originalOutputText, // frozen first AI output
//         finalText: outputText,             // current edited
//       },
//     });
//   };

//   const onEditChange = (e) => { setOutputText(coerceGFM(e.target.value)); setIsDirty(true); };

//   /* -------- Render -------- */
//   return (
//     <>
//       <nav className={styles.navbar}>
//         <h1 onClick={() => (window.location.href = "/")} style={{ cursor: "pointer" }}>
//           Text Simplification Tool
//         </h1>
//         <button className={styles.white_btn} onClick={() => navigate("/Login")}>Logout</button>
//       </nav>

//       {/* Floating history button (always visible) */}
//       <div style={{ position:"fixed", left:12, top:96, zIndex: 15 }}>
//         <button
//           onClick={() => setIsSidebarVisible(s => !s)}
//           title="History"
//           style={{
//             background:"#0078d4", color:"#fff", border:"none", width:44, height:44,
//             borderRadius:"50%", fontSize:20, cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,.2)"
//           }}
//         >
//           🕓
//         </button>
//       </div>

//       {/* Slide-in history panel */}
//       {isSidebarVisible && (
//         <div
//           style={{
//             position:"fixed", top:0, left:0, height:"100vh", width:320, background:"#fff",
//             borderRight:"1px solid #ddd", padding:16, overflowY:"auto", zIndex: 20
//           }}
//         >
//           <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
//             <h3 style={{ margin:0 }}>History</h3>
//             <button onClick={() => setIsSidebarVisible(false)} style={{ background:"transparent", border:"none", fontSize:20, cursor:"pointer" }}>✖</button>
//           </div>
//           <ul style={{ listStyle:"none", padding:0, marginTop:12 }}>
//             {documents.map((doc, idx) => (
//               <li
//                 key={doc._id}
//                 onClick={() => { loadDocument(doc); setIsSidebarVisible(false); }}
//                 style={{
//                   padding:"10px 8px", borderRadius:6, cursor:"pointer",
//                   border:"1px solid #eee", marginBottom:8
//                 }}
//               >
//                 <div style={{ fontWeight:600 }}>Document {documents.length - idx}</div>
//                 <div style={{ fontSize:12, color:"#666" }}>
//                   {new Date(doc.createdAt).toLocaleString()}
//                 </div>
//                 <div style={{ fontSize:13, color:"#444", marginTop:4 }}>
//                   {(doc.inputText || "").slice(0, 60)}…
//                 </div>
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}

//       <div className={styles.container}>
//         {/* Two-column feel is preserved by your CSS `side_by_side` classes */}
//         {/* Input */}
//         <div className={styles.text_container}>
//           <div className={styles.labelWrapper}>
//             <label className={styles.label}>Input Text</label>
//             <div className={styles.actions}>
//               <StatsButton text={inputText}/>
//               <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(inputText)}>📋 Copy</button>
//               <button className={styles.actionButton} onClick={() => saveAs(new Blob([inputText],{type:"text/plain;charset=utf-8"}), "InputText.txt")}>📥 Download</button>
//             </div>
//           </div>
//           <p className={styles.countText}>Words: {inW} | Characters: {inC}</p>
//           <textarea className={`${styles.textarea} ${styles.side_by_side}`} value={inputText} readOnly />
//         </div>

//         {/* Output */}
//         <div className={styles.text_container}>
//           <div className={styles.labelWrapper}>
//             <label className={styles.label}>AI-generated Text (Markdown)</label>
//             <div className={styles.actions}>
//               <StatsButton text={outputText}/>
//               <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(outputText)}>📋 Copy</button>
//               <button className={styles.actionButton} onClick={() => saveAs(new Blob([outputText],{type:"text/markdown;charset=utf-8"}), "Generated.md")}>📥 Download</button>
//               <button className={styles.toggleDiffBtn} onClick={() => setShowDifference(s => !s)}>
//                 {showDifference ? "Hide Difference" : "Show Difference"}
//               </button>
//               <button
//                 className={styles.editButton}
//                 onClick={() => setIsEditing(s => !s)}
//                 style={{ background:"#0078d4", color:"#fff", fontWeight:600, borderRadius:6, padding:"6px 12px" }}
//               >
//                 {isEditing ? "Show Rendered" : "✏️ Edit Output"}
//               </button>
//             </div>
//           </div>

//           {/* Unsaved banner (kept just above AI box) */}
//           {isDirty && (
//             <div style={{margin:"8px 0 12px", color:"#9a6700", background:"#fff3cd", padding:8, borderRadius:6, fontWeight:600}}>
//               ⚠️ Unsaved changes
//             </div>
//           )}

//           {/* Quick Prefs (unchanged placement) */}
//           <div className={styles.quickPrefs} style={{ margin: "20px 0" }}>
//             <div style={{ marginBottom: 16 }}>
//               <span style={{ display:"block", marginBottom:8, fontWeight:600 }}>Output length</span>
//               <input
//                 type="range" min="0" max="2"
//                 value={["same","shorter","much_shorter"].indexOf(lengthChoice)}
//                 onChange={(e)=>setLengthChoice(["same","shorter","much_shorter"][Number(e.target.value)])}
//                 style={{ width:"100%", height: "14px" }}
//               />
//               <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
//                 <span>Same</span><span>Shorter</span><span>Much shorter</span>
//               </div>
//             </div>

//             <div style={{ display:"flex", alignItems:"center", gap:12 }}>
//               <label style={{ fontWeight:600 }}>Tone</label>
//               <select value={tone} onChange={(e)=>setTone(e.target.value)} style={{ padding:"6px 10px", fontSize:15 }}>
//                 <option value="neutral">Neutral</option>
//                 <option value="formal">Formal</option>
//                 <option value="academic">Academic</option>
//                 <option value="casual">Casual</option>
//                 <option value="creative">Creative</option>
//               </select>
//             </div>
//           </div>

//           <p className={styles.countText}>Words: {outW} | Characters: {outC}</p>

//           {isEditing ? (
//             <textarea
//               className={`${styles.textarea} ${styles.side_by_side} ${styles.editable}`}
//               value={outputText}
//               onChange={onEditChange}
//               aria-label="Edit AI-generated markdown"
//             />
//           ) : (
//             <div className={`${styles.output_box} ${styles.side_by_side}`}>
//               <RenderMD text={outputText}/>
//             </div>
//           )}
//         </div>

//         {/* Difference */}
//         {showDifference && (
//           <div className={styles.text_container}>
//             <div className={styles.labelWrapper}>
//               <label className={styles.label}>Difference (vs input)</label>
//             </div>
//             <div className={`${styles.output_box} ${styles.side_by_side}`} dangerouslySetInnerHTML={{ __html: diffHtml }} />
//           </div>
//         )}

//         <div className={styles.button_container}>
//           <button className={styles.submit_btn} onClick={saveFinal}>Save & Continue</button>
//         </div>

//         {showSurveyPrompt && (
//           <div className={styles.survey_prompt} ref={surveyRef}>
//             <p className={styles.survey_text}>
//               Please take the survey.
//               <button
//                 className={styles.survey_btn}
//                 onClick={() => navigate("/survey", { state: { email, inputText, generatedText: originalOutputText, finalText: outputText } })}
//               >
//                 📑 Take the Survey
//               </button>
//             </p>
//           </div>
//         )}

//         {/* Footer/NIDILRR line remains below all boxes */}
//         <Footer />
//       </div>
//     </>
//   );
// }

// export default function Review(){
//   return (
//     <PageBoundary>
//       <ReviewInner />
//     </PageBoundary>
//   );
// }


// import React, { useEffect, useRef, useState, useCallback } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import { saveAs } from "file-saver";
// import StatsButton from "../StatsButton";
// import styles from "./styles.module.css";
// import Footer from "../Footer";

// /* -------- ErrorBoundary -------- */
// class PageBoundary extends React.Component {
//   constructor(p){ super(p); this.state = { hasError: false, error: null }; }
//   static getDerivedStateFromError(err){ return { hasError: true, error: err }; }
//   componentDidCatch(err, info){ console.error("Review crashed:", err, info); }
//   render(){
//     if(this.state.hasError){
//       return (
//         <div style={{padding:16}}>
//           <h2>Something went wrong while rendering.</h2>
//           <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.error)}</pre>
//         </div>
//       );
//     }
//     return this.props.children;
//   }
// }

// /* -------- Utils -------- */
// const dmp = new DiffMatchPatch();
// const safeGetUser = () => { try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; } };
// const count = (s="") => ({ words: String(s).trim().split(/\s+/).filter(Boolean).length, chars: String(s).length });

// const normalizeHeadings = (md="") => {
//   const lines = String(md || "").split(/\r?\n/);
//   let lastLevel = 1;
//   const out = lines.map((line) => {
//     const m = line.match(/^(#{1,6})\s+(.*)$/);
//     if (!m) return line;
//     let lvl = m[1].length;
//     if (lvl < 2) lvl = 2;               // ⭐ always start at H2
//     if (lvl > lastLevel + 1) lvl = lastLevel + 1; // ⭐ no level skips
//     lastLevel = lvl;
//     return `${"#".repeat(lvl)} ${m[2].trim()}`;
//   });
//   return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
// };

// const coerceGFM = (md="") =>
//   normalizeHeadings(
//     String(md)
//       .replace(/^\s*[\*\+]\s/gm, "- ")
//       .replace(/^\s*(\d+)\)\s/gm, "$1. ")
//       .replace(/[ \t]+$/gm, "")
//   );

// const diffHTML = (a="", b="") => {
//   const diffs = dmp.diff_main(a ?? "", b ?? "");
//   dmp.diff_cleanupSemantic(diffs);
//   return diffs.map(([op, txt]) => {
//     if (op === DiffMatchPatch.DIFF_INSERT) return `<span style="background:#d4fcdc;color:#08660f;">${txt}</span>`;
//     if (op === DiffMatchPatch.DIFF_DELETE) return `<span style="background:#ffecec;color:#8f1d1d;text-decoration:line-through;">${txt}</span>`;
//     return txt;
//   }).join("");
// };

// /* -------- Minimal Markdown Renderer -------- */
// const RenderMD = ({ text }) => {
//   const src = String(text || "");
//   const lines = src.split(/\r?\n/);
//   const nodes = [];
//   let list = null;

//   const flushList = () => {
//     if (list && list.items.length) {
//       nodes.push(
//         React.createElement(
//           list.ordered ? "ol" : "ul",
//           { key: `list-${nodes.length}`, style: { margin: "0 0 1rem 1.25rem" } },
//           list.items.map((t, i) => <li key={i}>{t}</li>)
//         )
//       );
//     }
//     list = null;
//   };

//   for (const raw of lines) {
//     const line = raw.trimRight();

//     const m = line.match(/^(#{2,6})\s+(.*)$/);
//     if (m) {
//       flushList();
//       const level = m[1].length;
//       const Tag = `h${level}`;
//       nodes.push(<Tag key={`h-${nodes.length}`}>{m[2]}</Tag>);
//       continue;
//     }

//     const ul = line.match(/^-\s+(.*)$/);
//     const ol = line.match(/^(\d+)\.\s+(.*)$/);
//     if (ul || ol) {
//       if (!list) list = { ordered: !!ol, items: [] };
//       list.items.push((ul ? ul[1] : ol[2]).trim());
//       continue;
//     }

//     if (!line.trim()) { flushList(); continue; }

//     flushList();
//     nodes.push(<p key={`p-${nodes.length}`}>{line}</p>);
//   }
//   flushList();
//   return <div>{nodes}</div>;
// };

// /* -------- Component -------- */
// function ReviewInner(){
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const surveyRef = useRef(null);

//   const fallback = (() => { try { return JSON.parse(sessionStorage.getItem("lastGenerated")) || null; } catch { return null; } })();
//   const initialInput  = state?.inputText  ?? fallback?.inputText  ?? "";
//   const initialOutput = state?.outputText ?? fallback?.outputText ?? "";

//   const user = safeGetUser();
//   const email = user?.email ?? null;

//   const [inputText, setInputText] = useState(initialInput);
//   const [outputText, setOutputText] = useState(coerceGFM(initialOutput));
//   const [originalOutputText] = useState(coerceGFM(initialOutput)); // ⭐ freeze original; never overwrite
//   const [isLoading, setIsLoading] = useState(false);
//   const [isEditing, setIsEditing] = useState(false);
//   const [isDirty, setIsDirty] = useState(false);
//   const [showDifference, setShowDifference] = useState(false);
//   const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);

//   const [{words:inW, chars:inC}, setInStats]   = useState(count(initialInput));
//   const [{words:outW, chars:outC}, setOutStats] = useState(count(initialOutput));
//   const [diffHtml, setDiffHtml] = useState(diffHTML(initialInput, initialOutput));

//   // Quick prefs (this page only exposes length + tone)
//   const [lengthChoice, setLengthChoice] = useState("same");
//   const [tone, setTone] = useState("neutral");

//   useEffect(() => setInStats(count(inputText)), [inputText]);
//   useEffect(() => { setOutStats(count(outputText)); setDiffHtml(diffHTML(inputText, outputText)); }, [inputText, outputText]);

//   /* ⭐ Build a snapshot we will save with each regenerate */
//   const buildPrefsSnapshot = useCallback(() => ({
//     lengthChoice,
//     tone,
//   }), [lengthChoice, tone]);

//   /* ⭐ Auto regenerate when length/tone change (debounced) */
//   useEffect(() => {
//     if (!inputText.trim()) return;
//     const t = setTimeout(() => regenerate(), 800);
//     return () => clearTimeout(t);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [lengthChoice, tone]);

//   /* Human-readable prefs block for the prompt */
//   const buildPrefsText = useCallback(() => {
//     const ratios = { same: 1, shorter: 0.75, much_shorter: 0.5 };
//     const target = Math.max(10, Math.round(inW * (ratios[lengthChoice] ?? 1)));
//     const toneLine = tone !== "neutral" ? `• Use a ${tone} tone.\n` : "";
//     return `• Aim for ~${target} words while preserving meaning.\n${toneLine}`;
//   }, [inW, lengthChoice, tone]);

//   const buildPrompt = useCallback(
// (text) => `
// You are an expert plain-language editor. Rewrite the text in clear **GitHub-Flavored Markdown** so it is easy to read and understand **without losing meaning**.

// Follow these core rules:
// • Keep facts, intent, and sequence accurate. No hallucinations.
// • Do not add external information.
// • Use inclusive, gender-neutral language when needed.
// • Use consistent terms for the same concept; avoid double negatives.
// • Start headings at **#**. Do not skip levels.
// • Return **only** the rewritten Markdown (no extra commentary).
// • Provide appropriate spacing between each heading.

// 1) Vocabulary & Tone
// - Replace technical or abstract words with simpler alternatives.
// - Define complex but necessary terms in parentheses on first use.
// - Remove idioms, metaphors, and jargon.
// - Use inclusive, gender-neutral language.

// 2) Sentence Structure
// - Aim for sentences of 10–15 words.
// - Prefer active voice; avoid nested clauses and unclear pronouns.

// 3) Structure & Flow
// - Organize with clear headings/subheadings (start at ##; do not skip levels).
// - Use lists for steps or key points.
// - Keep paragraphs short; one idea per paragraph.

// 4) Final Checks
// - Preserve facts, order, and intent.
// - Use consistent terminology; avoid double negatives.

// User Preferences:
// ${buildPrefsText()}

// Text:
// "${text}"
// `.trim(),
//     [buildPrefsText]
//   );

//   const splitChunks = (txt, max=3500) => {
//     const words = String(txt).split(/\s+/);
//     const chunks = [];
//     let cur = [];
//     for (const w of words) {
//       const next = (cur.join(" ") + " " + w).trim();
//       if (next.length <= max) cur.push(w);
//       else { if (cur.length) chunks.push(cur.join(" ")); cur = [w]; }
//     }
//     if (cur.length) chunks.push(cur.join(" "));
//     return chunks;
//   };

//   const regenerate = async () => {
//     if (!inputText.trim()) return;
//     setIsLoading(true);
//     try {
//       const chunks = splitChunks(inputText);
//       const reqs = chunks.map(async (ch) => {
//         const res = await fetch("/api/gpt4", {
//           method: "POST",
//           headers: { "Content-Type":"application/json" },
//           body: JSON.stringify({ prompt: buildPrompt(ch) })
//         });
//         const data = await res.json();
//         let t = "";
//         if (typeof data?.response === "string") t = data.response;
//         else if (Array.isArray(data?.choices)) t = data.choices.map(c => c?.message?.content || "").join(" ");
//         else if (typeof data?.text === "string") t = data.text;
//         else if (data?.response?.content) t = data.response.content.map(c => c?.text || "").join(" ");
//         return coerceGFM(t);
//       });

//       const combined = coerceGFM((await Promise.all(reqs)).join("\n\n"));
//       setOutputText(combined);
//       setIsDirty(true);

//       /* ⭐ Persist a version row with prefsSnapshot */
//       if (email) {
//         try {
//           await fetch("/api/simplifications/version", {
//             method: "POST",
//             headers: { "Content-Type":"application/json" },
//             body: JSON.stringify({
//               email,
//               inputText,
//               producedText: combined,
//               source: "resimplify",
//               prefsSnapshot: buildPrefsSnapshot(), // lengthChoice + tone
//             })
//           });
//         } catch (e) {
//           console.error("version save failed", e);
//         }
//       }
//     } catch (e) {
//       console.error("regenerate", e);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const saveFinal = async () => {
//     // ⭐ Survey sees original (first model output) and your edited final (current outputText)
//     navigate("/survey", {
//       state: {
//         email,
//         inputText,
//         generatedText: originalOutputText,
//         finalText: outputText,
//       },
//     });
//   };

//   const onEditChange = (e) => { setOutputText(coerceGFM(e.target.value)); setIsDirty(true); };

//   return (
//     <>
//       <nav className={styles.navbar}>
//         <h1 onClick={() => (window.location.href = "/")} style={{ cursor: "pointer" }}>
//           Text Simplification Tool
//         </h1>
//         <button className={styles.white_btn} onClick={() => navigate("/Login")}>Logout</button>
//       </nav>

//       <div className={styles.container}>
//         {/* Input */}
//         <div className={styles.text_container}>
//           <div className={styles.labelWrapper}>
//             <label className={styles.label}>Input Text</label>
//             <div className={styles.actions}>
//               <StatsButton text={inputText}/>
//               <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(inputText)}>📋 Copy</button>
//               <button className={styles.actionButton} onClick={() => saveAs(new Blob([inputText],{type:"text/plain;charset=utf-8"}), "InputText.txt")}>📥 Download</button>
//             </div>
//           </div>
//           <p className={styles.countText}>Words: {inW} | Characters: {inC}</p>
//           <textarea className={`${styles.textarea} ${styles.side_by_side}`} value={inputText} readOnly />
//         </div>

//         {/* Output */}
//         <div className={styles.text_container}>
//           <div className={styles.labelWrapper}>
//             <label className={styles.label}>AI-generated Text (Markdown)</label>
//             <div className={styles.actions}>
//               <StatsButton text={outputText}/>
//               <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(outputText)}>📋 Copy</button>
//               <button className={styles.actionButton} onClick={() => saveAs(new Blob([outputText],{type:"text/markdown;charset=utf-8"}), "Generated.md")}>📥 Download</button>
//               <button className={styles.toggleDiffBtn} onClick={() => setShowDifference(s => !s)}>
//                 {showDifference ? "Hide Difference" : "Show Difference"}
//               </button>
//               <button
//                 className={styles.editButton}
//                 onClick={() => setIsEditing(s => !s)}
//                 style={{ background:"#0078d4", color:"#fff", fontWeight:600, borderRadius:6, padding:"6px 12px" }}
//               >
//                 {isEditing ? "Show Rendered" : "✏️ Edit Output"}
//               </button>
//             </div>
//           </div>

//           {/* ⭐ Unsaved banner right ABOVE the AI box */}
//           {isDirty && (
//             <div style={{margin:"8px 0 12px", color:"#9a6700", background:"#fff3cd", padding:8, borderRadius:6, fontWeight:600}}>
//               ⚠️ Unsaved changes
//             </div>
//           )}

//           {/* Quick prefs with more spacing + bigger slider */}
//           <div className={styles.quickPrefs} style={{ margin: "20px 0" }}>
//             <div style={{ marginBottom: 16 }}>
//               <span style={{ display:"block", marginBottom:8, fontWeight:600 }}>Output length</span>
//               <input
//                 type="range" min="0" max="2"
//                 value={["same","shorter","much_shorter"].indexOf(lengthChoice)}
//                 onChange={(e)=>setLengthChoice(["same","shorter","much_shorter"][Number(e.target.value)])}
//                 style={{ width:"100%", height: "14px" }} // ⭐ larger slider
//               />
//               <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
//                 <span>Same</span><span>Shorter</span><span>Much shorter</span>
//               </div>
//             </div>

//             <div style={{ display:"flex", alignItems:"center", gap:12 }}>
//               <label style={{ fontWeight:600 }}>Tone</label>
//               <select value={tone} onChange={(e)=>setTone(e.target.value)} style={{ padding:"6px 10px", fontSize:15 }}>
//                 <option value="neutral">Neutral</option>
//                 <option value="formal">Formal</option>
//                 <option value="academic">Academic</option>
//                 <option value="casual">Casual</option>
//                 <option value="creative">Creative</option>
//               </select>
//             </div>
//           </div>

//           <p className={styles.countText}>Words: {outW} | Characters: {outC}</p>

//           {isEditing ? (
//             <textarea
//               className={`${styles.textarea} ${styles.side_by_side} ${styles.editable}`}
//               value={outputText}
//               onChange={onEditChange}
//               aria-label="Edit AI-generated markdown"
//             />
//           ) : (
//             <div className={`${styles.output_box} ${styles.side_by_side}`}>
//               <RenderMD text={outputText}/>
//             </div>
//           )}
//         </div>

//         {/* ⭐ Live difference view always reflects current outputText */}
//         {showDifference && (
//           <div className={styles.text_container}>
//             <div className={styles.labelWrapper}>
//               <label className={styles.label}>Difference (vs input)</label>
//             </div>
//             <div className={`${styles.output_box} ${styles.side_by_side}`} dangerouslySetInnerHTML={{ __html: diffHtml }} />
//           </div>
//         )}

//         <div className={styles.button_container}>
//           <button className={styles.submit_btn} onClick={saveFinal}>Save & Continue</button>
//         </div>

//         {showSurveyPrompt && (
//           <div className={styles.survey_prompt} ref={surveyRef}>
//             <p className={styles.survey_text}>
//               Please take the survey.
//               <button
//                 className={styles.survey_btn}
//                 onClick={() => navigate("/survey", { state: { email, inputText, generatedText: originalOutputText, finalText: outputText } })}
//               >
//                 📑 Take the Survey
//               </button>
//             </p>
//           </div>
//         )}

//         <Footer />
//       </div>
//     </>
//   );
// }

// export default function Review(){
//   return (
//     <PageBoundary>
//       <ReviewInner />
//     </PageBoundary>
//   );
// }

// prev UI
// import React, { useEffect, useRef, useState, useCallback } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import { saveAs } from "file-saver";
// import StatsButton from "../StatsButton";
// import styles from "./styles.module.css";
// import Footer from "../Footer";

// /* -------- ErrorBoundary -------- */
// class PageBoundary extends React.Component {
//   constructor(p) {
//     super(p);
//     this.state = { hasError: false, error: null };
//   }
//   static getDerivedStateFromError(err) {
//     return { hasError: true, error: err };
//   }
//   componentDidCatch(err, info) {
//     console.error("Review crashed:", err, info);
//   }
//   render() {
//     if (this.state.hasError) {
//       return (
//         <div style={{ padding: 16 }}>
//           <h2>Something went wrong while rendering.</h2>
//           <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.error)}</pre>
//         </div>
//       );
//     }
//     return this.props.children;
//   }
// }

// /* -------- Utils -------- */
// const dmp = new DiffMatchPatch();
// const safeGetUser = () => {
//   try {
//     return JSON.parse(localStorage.getItem("user")) || null;
//   } catch {
//     return null;
//   }
// };
// const count = (s = "") => ({
//   words: String(s).trim().split(/\s+/).filter(Boolean).length,
//   chars: String(s).length,
// });

// const normalizeHeadings = (md = "") => {
//   const lines = String(md || "").split(/\r?\n/);
//   let lastLevel = 1;
//   const out = lines.map((line) => {
//     const m = line.match(/^(#{1,6})\s+(.*)$/);
//     if (!m) return line;
//     let lvl = m[1].length;
//     if (lvl < 2) lvl = 2;
//     if (lvl > lastLevel + 1) lvl = lastLevel + 1;
//     lastLevel = lvl;
//     return `${"#".repeat(lvl)} ${m[2].trim()}`;
//   });
//   return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
// };

// const coerceGFM = (md = "") =>
//   normalizeHeadings(
//     md
//       .replace(/^\s*[\*\+]\s/gm, "- ")
//       .replace(/^\s*(\d+)\)\s/gm, "$1. ")
//       .replace(/[ \t]+$/gm, "")
//   );

// const diffHTML = (a = "", b = "") => {
//   const diffs = dmp.diff_main(a ?? "", b ?? "");
//   dmp.diff_cleanupSemantic(diffs);
//   return diffs
//     .map(([op, txt]) => {
//       if (op === DiffMatchPatch.DIFF_INSERT)
//         return `<span style="background:#d4fcdc;color:#08660f;">${txt}</span>`;
//       if (op === DiffMatchPatch.DIFF_DELETE)
//         return `<span style="background:#ffecec;color:#8f1d1d;text-decoration:line-through;">${txt}</span>`;
//       return txt;
//     })
//     .join("");
// };

// /* -------- Markdown Renderer -------- */
// const RenderMD = ({ text }) => {
//   const src = String(text || "");
//   const lines = src.split(/\r?\n/);
//   const nodes = [];
//   let list = null;

//   const flushList = () => {
//     if (list && list.items.length) {
//       nodes.push(
//         React.createElement(
//           list.ordered ? "ol" : "ul",
//           { key: `list-${nodes.length}`, style: { margin: "0 0 1rem 1.25rem" } },
//           list.items.map((t, i) => <li key={i}>{t}</li>)
//         )
//       );
//     }
//     list = null;
//   };

//   for (const raw of lines) {
//     const line = raw.trimRight();

//     const m = line.match(/^(#{2,6})\s+(.*)$/);
//     if (m) {
//       flushList();
//       const level = m[1].length;
//       const Tag = `h${level}`;
//       nodes.push(<Tag key={`h-${nodes.length}`}>{m[2]}</Tag>);
//       continue;
//     }

//     const ul = line.match(/^-\s+(.*)$/);
//     const ol = line.match(/^(\d+)\.\s+(.*)$/);
//     if (ul || ol) {
//       if (!list) list = { ordered: !!ol, items: [] };
//       list.items.push((ul ? ul[1] : ol[2]).trim());
//       continue;
//     }

//     if (!line.trim()) {
//       flushList();
//       continue;
//     }

//     flushList();
//     nodes.push(<p key={`p-${nodes.length}`}>{line}</p>);
//   }
//   flushList();
//   return <div>{nodes}</div>;
// };

// /* -------- Component -------- */
// function ReviewInner() {
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const surveyRef = useRef(null);

//   const fallback = (() => {
//     try {
//       return JSON.parse(sessionStorage.getItem("lastGenerated")) || null;
//     } catch {
//       return null;
//     }
//   })();

//   const initialInput = state?.inputText ?? fallback?.inputText ?? "";
//   const initialOutput = state?.outputText ?? fallback?.outputText ?? "";

//   const user = safeGetUser();
//   const email = user?.email ?? null;

//   const [inputText, setInputText] = useState(initialInput);
//   const [outputText, setOutputText] = useState(coerceGFM(initialOutput));
//   const [originalOutputText, setOriginalOutputText] = useState(coerceGFM(initialOutput));
//   const [isLoading, setIsLoading] = useState(false);
//   const [isEditing, setIsEditing] = useState(false);
//   const [isDirty, setIsDirty] = useState(false);
//   const [showDifference, setShowDifference] = useState(false);
//   const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);

//   const [{ words: inW, chars: inC }, setInStats] = useState(count(initialInput));
//   const [{ words: outW, chars: outC }, setOutStats] = useState(count(initialOutput));
//   const [diffHtml, setDiffHtml] = useState(diffHTML(initialInput, initialOutput));
//   const [lengthChoice, setLengthChoice] = useState("same");
//   const [tone, setTone] = useState("neutral");

//   useEffect(() => setInStats(count(inputText)), [inputText]);
//   useEffect(() => {
//     setOutStats(count(outputText));
//     setDiffHtml(diffHTML(inputText, outputText));
//   }, [inputText, outputText]);

//   /* Auto regenerate when prefs change */
//   useEffect(() => {
//     if (inputText.trim() && !isLoading) {
//       const t = setTimeout(() => regenerate(), 1200);
//       return () => clearTimeout(t);
//     }
//   }, [lengthChoice, tone]);

//   const buildPrefsText = useCallback(() => {
//     const ratios = { same: 1, shorter: 0.75, much_shorter: 0.5 };
//     const target = Math.max(10, Math.round(inW * (ratios[lengthChoice] ?? 1)));
//     const toneLine = tone !== "neutral" ? `• Use a ${tone} tone.\n` : "";
//     return `• Aim for ~${target} words while preserving meaning.\n${toneLine}`;
//   }, [inW, lengthChoice, tone]);


// //   const generatePrompt = (inputText) => {
// //     // Keep this aligned with Main’s stricter rules
// //     return `
// // You are an expert plain-language editor. Simplify the text so it is easy to read and understand without losing meaning.
// // • Keep facts, intent, and sequence accurate. No hallucinations.
// // • Do not add external information.
// // • Use clear, concrete, inclusive language.
// // • Use consistent terms; avoid double negatives.
// // • Return only the rewritten text (no markdown, headings, emojis).
// // "${inputText}"
// // `.trim();
// // Rewrite the text in clear **GitHub-Flavored Markdown**.
// //   };
//   const buildPrompt = useCallback(
//     (text) => `
// You are an expert in accessible communication, tasked with transforming complex text into clear, accessible plain language for individuals with Intellectual and Developmental Disabilities (IDD) or those requiring simplified content. 

// **Retain all essential information and intent while prioritizing readability, comprehension, and inclusivity.** 

// Stick to the provided input text and only simplify the language. Do not add, remove, or change meaning. Do not provide irrelevant or hallucinated content.

// Follow this step-by-step process rigorously and if any instruction contradicts the user specified customization option, prioritize the user’s selected customization always:

// Step 1: Sentence-by-Sentence Vocabulary and Tone Pass
// Replace technical or abstract words with simpler alternatives.
// Define complex but necessary terms in parentheses the first time they appear.
// Remove idioms, metaphors, cultural references, and jargon.
// Use inclusive and gender-neutral language.
// Ensure a neutral, conversational tone. Address the reader with “you” or “we” if appropriate.


// Step 2: Sentence Structure Pass
// Rewrite each sentence to be no more than 10–15 words.
// Use active voice.
// Avoid passive voice, nested clauses, and unclear pronouns.
// Ensure each sentence expresses one or two clear ideas.


// Step 3: Overall Clarity, Flow, and Structure
// Organize content logically with clear headings/subheadings.
// Use bullet points or numbered lists for steps or key points.
// Ensure each paragraph sticks to one main idea.
// Chunk long sections into smaller paragraphs with line breaks.


// Step 4: Inclusivity and Final Checks
// Review for bias, stereotypes, and assumptions.
// Ensure consistent terminology (avoid confusing synonyms).
// Ensure all required formatting supports readability and comprehension.
// Check that the final output meets all requirements listed below.


// Output Requirements:
// Only return the simplified text. 
// Do not simplify already simple text.
// Preserve all facts, context, and intent.
// Do not shorten the text; length should be similar to the input.
// Ensure the result aligns with plain language standards like WCAG and PlainLanguage.gov.

// Rules:
// • Keep facts, intent, and sequence accurate. No hallucinations.
// • Do not add external information.
// • Use consistent terms; avoid double negatives.
// • Do not skip heading levels (no H3 before H2).
// • Replace jargon with everyday words. Define acronyms on first use.
// • Return **only** valid Markdown (no commentary).

// User Preferences:
// ${buildPrefsText()}

// Text:
// "${text}"
// `.trim(),
//     [buildPrefsText]
//   );

//   const splitChunks = (txt, max = 3500) => {
//     const words = String(txt).split(/\s+/);
//     const chunks = [];
//     let cur = [];
//     for (const w of words) {
//       const next = (cur.join(" ") + " " + w).trim();
//       if (next.length <= max) cur.push(w);
//       else {
//         if (cur.length) chunks.push(cur.join(" "));
//         cur = [w];
//       }
//     }
//     if (cur.length) chunks.push(cur.join(" "));
//     return chunks;
//   };

//   const regenerate = async () => {
//     if (!inputText.trim()) return;
//     setIsLoading(true);
//     try {
//       const chunks = splitChunks(inputText);
//       const reqs = chunks.map(async (ch) => {
//         const res = await fetch("/api/gpt4", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ prompt: buildPrompt(ch) }),
//         });
//         const data = await res.json();
//         let t = "";
//         if (typeof data?.response === "string") t = data.response;
//         else if (Array.isArray(data?.choices))
//           t = data.choices.map((c) => c?.message?.content || "").join(" ");
//         else if (typeof data?.text === "string") t = data.text;
//         else if (data?.response?.content)
//           t = data.response.content.map((c) => c?.text || "").join(" ");
//         return coerceGFM(t);
//       });
//       const combined = coerceGFM((await Promise.all(reqs)).join("\n\n"));
//       setOutputText(combined);
//       setOriginalOutputText(combined);
//       setIsDirty(true);
//     } catch (e) {
//       console.error("regenerate", e);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const saveFinal = async () => {
//     navigate("/survey", {
//       state: {
//         email,
//         inputText,
//         generatedText: originalOutputText,
//         finalText: outputText,
//       },
//     });
//   };

//   const onEditChange = (e) => {
//     setOutputText(coerceGFM(e.target.value));
//     setIsDirty(true);
//   };

//   return (
//     <>
//       <nav className={styles.navbar}>
//         <h1 onClick={() => (window.location.href = "/")} style={{ cursor: "pointer" }}>
//           Text Simplification Tool
//         </h1>
//         <button className={styles.white_btn} onClick={() => navigate("/Login")}>
//           Logout
//         </button>
//       </nav>

//       <div className={styles.container}>
//         {/* Input Section */}
//         <div className={styles.text_container}>
//           <div className={styles.labelWrapper}>
//             <label className={styles.label}>Input Text</label>
//             <div className={styles.actions}>
//               <StatsButton text={inputText} />
//               <button
//                 className={styles.actionButton}
//                 onClick={() => navigator.clipboard.writeText(inputText)}
//               >
//                 📋 Copy
//               </button>
//               <button
//                 className={styles.actionButton}
//                 onClick={() =>
//                   saveAs(
//                     new Blob([inputText], { type: "text/plain;charset=utf-8" }),
//                     "InputText.txt"
//                   )
//                 }
//               >
//                 📥 Download
//               </button>
//             </div>
//           </div>
//           <p className={styles.countText}>
//             Words: {inW} | Characters: {inC}
//           </p>
//           <textarea
//             className={`${styles.textarea} ${styles.side_by_side}`}
//             value={inputText}
//             readOnly
//           />
//         </div>

//         {/* Output Section */}
//         <div className={styles.text_container}>
//           <div className={styles.labelWrapper}>
//             <label className={styles.label}>AI-generated Text (Markdown)</label>
//             <div className={styles.actions}>
//               <StatsButton text={outputText} />
//               <button
//                 className={styles.actionButton}
//                 onClick={() => navigator.clipboard.writeText(outputText)}
//               >
//                 📋 Copy
//               </button>
//               <button
//                 className={styles.actionButton}
//                 onClick={() =>
//                   saveAs(
//                     new Blob([outputText], { type: "text/markdown;charset=utf-8" }),
//                     "Generated.md"
//                   )
//                 }
//               >
//                 📥 Download
//               </button>
//               <button
//                 className={styles.editButton}
//                 onClick={() => setIsEditing((s) => !s)}
//                 style={{
//                   background: "#0078d4",
//                   color: "white",
//                   fontWeight: 600,
//                   borderRadius: "6px",
//                   padding: "6px 12px",
//                 }}
//               >
//                 {isEditing ? "Show Rendered" : "✏️ Edit Output"}
//               </button>
//             </div>
//           </div>

//           {/* Preferences */}
//           <div className={styles.quickPrefs} style={{ margin: "20px 0" }}>
//             <div style={{ marginBottom: "20px" }}>
//               <span>Output length:</span>
//               <input
//                 type="range"
//                 min="0"
//                 max="2"
//                 value={["same", "shorter", "much_shorter"].indexOf(lengthChoice)}
//                 onChange={(e) =>
//                   setLengthChoice(
//                     ["same", "shorter", "much_shorter"][Number(e.target.value)]
//                   )
//                 }
//                 style={{ width: "100%", height: "10px" }}
//               />
//               <div
//                 style={{
//                   display: "flex",
//                   justifyContent: "space-between",
//                   marginTop: 4,
//                 }}
//               >
//                 <span>Same</span>
//                 <span>Shorter</span>
//                 <span>Much shorter</span>
//               </div>
//             </div>

//             <div
//               style={{
//                 display: "flex",
//                 alignItems: "center",
//                 gap: "10px",
//                 fontSize: "15px",
//               }}
//             >
//               <label>Tone:</label>
//               <select
//                 value={tone}
//                 onChange={(e) => setTone(e.target.value)}
//                 style={{ padding: "4px 8px", fontSize: "15px" }}
//               >
//                 <option value="neutral">Neutral</option>
//                 <option value="formal">Formal</option>
//                 <option value="academic">Academic</option>
//                 <option value="casual">Casual</option>
//                 <option value="creative">Creative</option>
//               </select>
//             </div>
//           </div>

//           {isDirty && (
//             <p
//               style={{
//                 color: "#9a6700",
//                 background: "#fff3cd",
//                 padding: "8px",
//                 borderRadius: "6px",
//                 fontWeight: 600,
//               }}
//             >
//               ⚠️ Unsaved changes
//             </p>
//           )}

//           <p className={styles.countText}>
//             Words: {outW} | Characters: {outC}
//           </p>

//           {isEditing ? (
//             <textarea
//               className={`${styles.textarea} ${styles.side_by_side} ${styles.editable}`}
//               value={outputText}
//               onChange={onEditChange}
//               aria-label="Edit AI-generated markdown"
//             />
//           ) : (
//             <div className={`${styles.output_box} ${styles.side_by_side}`}>
//               <RenderMD text={outputText} />
//             </div>
//           )}
//         </div>

//         <div className={styles.button_container}>
//           <button className={styles.submit_btn} onClick={saveFinal}>
//             Save & Continue
//           </button>
//         </div>

//         {showSurveyPrompt && (
//           <div className={styles.survey_prompt} ref={surveyRef}>
//             <p className={styles.survey_text}>
//               Please take the survey.
//               <button
//                 className={styles.survey_btn}
//                 onClick={() =>
//                   navigate("/survey", {
//                     state: {
//                       email,
//                       inputText,
//                       generatedText: originalOutputText,
//                       finalText: outputText,
//                     },
//                   })
//                 }
//               >
//                 📑 Take the Survey
//               </button>
//             </p>
//           </div>
//         )}

//         <Footer />
//       </div>
//     </>
//   );
// }

// export default function Review() {
//   return (
//     <PageBoundary>
//       <ReviewInner />
//     </PageBoundary>
//   );
// }

// import React, { useEffect, useRef, useState, useCallback } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import { saveAs } from "file-saver";
// import styles from "./styles.module.css";
// import Footer from "../Footer";

// /* -------- ErrorBoundary so the page never white-screens -------- */
// class PageBoundary extends React.Component {
//   constructor(p){ super(p); this.state = { hasError: false, error: null }; }
//   static getDerivedStateFromError(err){ return { hasError: true, error: err }; }
//   componentDidCatch(err, info){ console.error("Review crashed:", err, info); }
//   render(){
//     if(this.state.hasError){
//       return (
//         <div style={{padding:16}}>
//           <h2>Something went wrong while rendering.</h2>
//           <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.error)}</pre>
//         </div>
//       );
//     }
//     return this.props.children;
//   }
// }

// /* ---------------- utils ---------------- */
// const dmp = new DiffMatchPatch();
// const safeGetUser = () => { try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; } };
// const count = (s="") => ({ words: String(s).trim().split(/\s+/).filter(Boolean).length, chars: String(s).length });

// /** Normalize headings (never H1 in body; no level skips) & minor GFM tidy. */
// const normalizeHeadings = (md = "") => {
//   const lines = String(md || "").split(/\r?\n/);
//   let lastLevel = 1;
//   const out = lines.map((line) => {
//     const m = line.match(/^(#{1,6})\s+(.*)$/);
//     if (!m) return line;
//     let lvl = m[1].length;
//     if (lvl < 2) lvl = 2;
//     if (lvl > lastLevel + 1) lvl = lastLevel + 1;
//     lastLevel = lvl;
//     return `${"#".repeat(lvl)} ${m[2].trim()}`;
//   });
//   return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
// };
// const coerceGFM = (md="") =>
//   normalizeHeadings(md.replace(/^\s*[\*\+]\s/gm, "- ").replace(/^\s*(\d+)\)\s/gm, "$1. ").replace(/[ \t]+$/gm, ""));

// const diffHTML = (a = "", b = "") => {
//   const diffs = dmp.diff_main(a ?? "", b ?? "");
//   dmp.diff_cleanupSemantic(diffs);
//   return diffs.map(([op, txt]) => {
//     if (op === DiffMatchPatch.DIFF_INSERT) return `<span style="background:#d4fcdc;color:#08660f;">${txt}</span>`;
//     if (op === DiffMatchPatch.DIFF_DELETE) return `<span style="background:#ffecec;color:#8f1d1d;text-decoration:line-through;">${txt}</span>`;
//     return txt;
//   }).join("");
// };

// /* Minimal internal MD renderer (headings, lists, paragraphs only) */
// const RenderMD = ({ text }) => {
//   const src = String(text || "");
//   const lines = src.split(/\r?\n/);
//   const nodes = [];
//   let list = null;

//   const flushList = () => {
//     if (list && list.items.length) {
//       nodes.push(
//         React.createElement(
//           list.ordered ? "ol" : "ul",
//           { key: `list-${nodes.length}`, style: { margin: "0 0 1rem 1.25rem" } },
//           list.items.map((t, i) => <li key={i}>{t}</li>)
//         )
//       );
//     }
//     list = null;
//   };

//   for (const raw of lines) {
//     const line = raw.trimRight();

//     // heading
//     const m = line.match(/^(#{2,6})\s+(.*)$/);
//     if (m) {
//       flushList();
//       const level = m[1].length;
//       const Tag = `h${level}`;
//       nodes.push(<Tag key={`h-${nodes.length}`}>{m[2]}</Tag>);
//       continue;
//     }

//     // list
//     const ul = line.match(/^-\s+(.*)$/);
//     const ol = line.match(/^(\d+)\.\s+(.*)$/);
//     if (ul || ol) {
//       if (!list) list = { ordered: !!ol, items: [] };
//       list.items.push((ul ? ul[1] : ol[2]).trim());
//       continue;
//     }

//     // blank line
//     if (!line.trim()) { flushList(); continue; }

//     // paragraph
//     flushList();
//     nodes.push(<p key={`p-${nodes.length}`}>{line}</p>);
//   }
//   flushList();
//   return <div>{nodes}</div>;
// };

// /* ---------------- component ---------------- */
// function ReviewInner(){
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const surveyRef = useRef(null);

//   const fallback = (() => { try { return JSON.parse(sessionStorage.getItem("lastGenerated")) || null; } catch { return null; } })();
//   const initialInput  = state?.inputText  ?? fallback?.inputText  ?? "";
//   const initialOutput = state?.outputText ?? fallback?.outputText ?? "";

//   const user = safeGetUser();
//   const email = user?.email ?? null;

//   const [documents, setDocuments] = useState([]);
//   const [selectedDocId, setSelectedDocId] = useState(null);

//   const [inputText, setInputText] = useState(initialInput);
//   const [outputText, setOutputText] = useState(coerceGFM(initialOutput));

//   const [isSidebarVisible, setIsSidebarVisible] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isEditing, setIsEditing] = useState(false);
//   const [showDifference, setShowDifference] = useState(false);
//   const [isDirty, setIsDirty] = useState(false);

//   const [{words:inW, chars:inC}, setInStats] = useState(count(initialInput));
//   const [{words:outW, chars:outC}, setOutStats] = useState(count(initialOutput));
//   const [diffHtml, setDiffHtml] = useState(diffHTML(initialInput, initialOutput));
//   const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);

//   const [lengthChoice, setLengthChoice] = useState("same");
//   const [tone, setTone] = useState("neutral");

//   /* fetch docs */
//   useEffect(() => {
//     if (!email) return;
//     (async () => {
//       try {
//         const res = await fetch(`/api/simplifications/user/${email}`);
//         const json = await res.json();
//         if (res.ok) {
//           const sorted = json.data.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
//           setDocuments(sorted);
//           if (!state && sorted.length) {
//             const first = sorted[0];
//             setSelectedDocId(first._id);
//             setInputText(first.inputText);
//             setOutputText(coerceGFM(first.outputText));
//           }
//         }
//       } catch (err) { console.error("fetch docs", err); }
//     })();
//   }, [email, state]);

//   useEffect(() => setInStats(count(inputText)), [inputText]);
//   useEffect(() => { setOutStats(count(outputText)); setDiffHtml(diffHTML(inputText, outputText)); }, [inputText, outputText]);

//   useEffect(() => {
//     const h = (e) => { if (!isDirty) return; e.preventDefault(); e.returnValue = ""; };
//     window.addEventListener("beforeunload", h);
//     return () => window.removeEventListener("beforeunload", h);
//   }, [isDirty]);

//   /* prompt + regenerate */
//   const buildPrefsText = useCallback(() => {
//     const ratios = { same: 1, shorter: 0.75, much_shorter: 0.5 };
//     const target = Math.max(10, Math.round(inW * (ratios[lengthChoice] ?? 1)));
//     const toneLine = tone !== "neutral" ? `• Use a ${tone} tone.\n` : "";
//     return `• Aim for ~${target} words while preserving meaning.\n${toneLine}`;
//   }, [inW, lengthChoice, tone]);

//   const buildPrompt = useCallback((text) => `
// You are an expert plain-language editor.
// Rewrite the text in clear **GitHub-Flavored Markdown**.

// Rules:
// • Keep facts, intent, and sequence accurate. No hallucinations.
// • Use headings, lists, short paragraphs. Start sections at **##** (H2). Never use H1 inside the body.
// • Do not skip heading levels (no H3 before H2).
// • Replace jargon with everyday words. Define acronyms on first use.
// • Return **only** valid Markdown (no commentary).

// Preferences:
// ${buildPrefsText()}

// Text:
// "${text}"
// `.trim(), [buildPrefsText]);

//   const splitChunks = (txt, max = 3500) => {
//     const words = String(txt).split(/\s+/);
//     const chunks = [];
//     let cur = [];
//     for (const w of words) {
//       const next = (cur.join(" ") + " " + w).trim();
//       if (next.length <= max) cur.push(w);
//       else { if (cur.length) chunks.push(cur.join(" ")); cur = [w]; }
//     }
//     if (cur.length) chunks.push(cur.join(" "));
//     return chunks;
//   };

//   const regenerate = async () => {
//     if (!inputText.trim()) return;
//     setIsLoading(true);
//     try {
//       const chunks = splitChunks(inputText);
//       const reqs = chunks.map(async (ch) => {
//         const res = await fetch("/api/gpt4", {
//           method: "POST", headers: {"Content-Type":"application/json"},
//           body: JSON.stringify({ prompt: buildPrompt(ch) })
//         });
//         const data = await res.json();
//         let t = "";
//         if (typeof data?.response === "string") t = data.response;
//         else if (Array.isArray(data?.choices)) t = data.choices.map(c => c?.message?.content || "").join(" ");
//         else if (typeof data?.text === "string") t = data.text;
//         else if (data?.response?.content) t = data.response.content.map(c => c?.text || "").join(" ");
//         return coerceGFM(t);
//       });
//       const combined = coerceGFM((await Promise.all(reqs)).join("\n\n"));

//       setOutputText(combined);
//       setIsDirty(true);

//       await fetch("/api/simplifications/version", {
//         method: "POST",
//         headers: {"Content-Type":"application/json"},
//         body: JSON.stringify({
//           email, inputText,
//           producedText: combined,
//           source: "resimplify",
//           prefsSnapshot: { lengthChoice, tone }
//         })
//       });
//     } catch (e) {
//       console.error("regenerate", e);
//     } finally { setIsLoading(false); }
//   };

//   const saveFinal = async () => {
//     try {
//       const res = await fetch("/api/simplifications/final", {
//         method: "PUT",
//         headers: {"Content-Type":"application/json"},
//         body: JSON.stringify({ email, inputText, finalText: outputText })
//       });
//       if (res.ok) {
//         setIsDirty(false);
//         setShowSurveyPrompt(true);
//         setTimeout(() => surveyRef.current?.scrollIntoView({ behavior: "smooth" }), 250);
//         navigate("/survey", { state: { email, inputText, generatedText: outputText, finalText: outputText }});
//       }
//     } catch(e){ console.error("save final", e); }
//   };

//   const onEditChange = (e) => { setOutputText(coerceGFM(e.target.value)); setIsDirty(true); };

//   const handleDocumentClick = (doc) => {
//     setSelectedDocId(doc._id);
//     setInputText(doc.inputText);
//     setOutputText(coerceGFM(doc.outputText));
//     setIsEditing(false);
//     setShowDifference(false);
//   };

//   const handleLogout = () => { localStorage.removeItem("token"); navigate("/Login"); };

//   return (
//     <>
//       <nav className={styles.navbar}>
//         <h1 onClick={() => (window.location.href = "/")} style={{ cursor: "pointer" }}>
//           Text Simplification Tool
//         </h1>
//         <button className={styles.white_btn} onClick={handleLogout}>Logout</button>
//       </nav>

//       <div className={styles.container}>
//         {/* Sidebar / History */}
//         <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
//           <button className={styles.historyIcon} onClick={() => setIsSidebarVisible(s=>!s)}>
//             🕒 <p style={{ fontSize: 15 }}> History </p>
//           </button>
//           {isSidebarVisible && (
//             <div className={styles.historyContent}>
//               <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>✖</button>
//               <ul className={styles.historyList}>
//                 {documents.map((doc, idx) => (
//                   <li key={doc._id} className={styles.historyItem} onClick={() => handleDocumentClick(doc)}>
//                     <strong>Document {documents.length - idx}</strong> ({doc.inputText.slice(0, 20)}…)
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
//               Please review the simplified text. You can edit the Markdown or regenerate with the options below.
//               {isDirty && <strong style={{ marginLeft: 8, color: "#9a6700" }}> Unsaved changes</strong>}
//             </p>
//           </div>

//           <div className={styles.textareas_container}>
//             {/* Input */}
//             <div className={styles.text_container}>
//               <div className={styles.labelWrapper}>
//                 <label className={styles.label}>Input Text</label>
//                 <div className={styles.actions}>
//                   <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(inputText)}>📋 <span className={styles.iconLabel}>Copy</span></button>
//                   <button className={styles.actionButton} onClick={() => saveAs(new Blob([inputText],{type:"text/plain;charset=utf-8"}), "InputText.txt")}>📥 <span className={styles.iconLabel}>Download</span></button>
//                 </div>
//               </div>
//               <p className={styles.countText}>Words: {inW} | Characters: {inC}</p>
//               <textarea className={`${styles.textarea} ${styles.side_by_side}`} value={inputText} readOnly />
//             </div>

//             {/* Output controls + editor */}
//             <div className={styles.text_container}>
//               <div className={styles.labelWrapper}>
//                 <label className={styles.label}>AI-generated Text (Markdown)</label>
//                 <div className={styles.actions}>
//                   <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(outputText)}>📋 <span className={styles.iconLabel}>Copy</span></button>
//                   <button className={styles.actionButton} onClick={() => saveAs(new Blob([outputText],{type:"text/markdown;charset=utf-8"}), "Generated.md")}>📥 <span className={styles.iconLabel}>Download</span></button>
//                   <button className={styles.toggleDiffBtn} onClick={() => setShowDifference(s => !s)}>
//                     {showDifference ? "Hide Difference" : "Show Difference"}
//                   </button>
//                   <button className={styles.actionButton} onClick={() => setIsEditing((s)=>!s)}>
//                     {isEditing ? "Show Rendered Output" : "Edit Output"}
//                   </button>
//                 </div>
//               </div>

//               {/* quick prefs ABOVE output */}
//               <div className={styles.quickPrefs}>
//                 <div className={styles.sliderRow}>
//                   <span>Output length:</span>
//                   <input
//                     type="range" min="0" max="2"
//                     value={["same","shorter","much_shorter"].indexOf(lengthChoice)}
//                     onChange={(e)=>setLengthChoice(["same","shorter","much_shorter"][Number(e.target.value)])}
//                     className={styles.sliderInput}
//                     aria-label="Output length"
//                   />
//                   <div className={styles.sliderLabels}>
//                     <span className={lengthChoice==="same"?styles.activeLabel:""}>Same</span>
//                     <span className={lengthChoice==="shorter"?styles.activeLabel:""}>Shorter</span>
//                     <span className={lengthChoice==="much_shorter"?styles.activeLabel:""}>Much shorter</span>
//                   </div>
//                 </div>

//                 <div className={styles.toneRow}>
//                   <label> Tone: </label>
//                   <select value={tone} onChange={(e)=>setTone(e.target.value)}>
//                     <option value="neutral">Neutral</option>
//                     <option value="formal">Formal</option>
//                     <option value="academic">Academic</option>
//                     <option value="casual">Casual</option>
//                     <option value="creative">Creative</option>
//                   </select>
//                   <button className={styles.actionButton} onClick={regenerate} disabled={isLoading}>
//                     🔄 <span className={styles.iconLabel}>{isLoading ? "Regenerating…" : "Re-generate"}</span>
//                   </button>
//                 </div>
//               </div>

//               <p className={styles.countText}>Words: {outW} | Characters: {outC}</p>

//               {/* Editor: rendered by default, textarea when editing */}
//               {isEditing ? (
//                 <textarea
//                   className={`${styles.textarea} ${styles.side_by_side} ${styles.editable}`}
//                   value={outputText}
//                   onChange={onEditChange}
//                   aria-label="Edit AI-generated markdown"
//                 />
//               ) : (
//                 <div className={`${styles.output_box} ${styles.side_by_side}`}>
//                   <RenderMD text={outputText} />
//                 </div>
//               )}
//             </div>

//             {showDifference && (
//               <div className={styles.text_container}>
//                 <div className={styles.labelWrapper}>
//                   <label className={styles.label}>Difference (vs input)</label>
//                 </div>
//                 <div className={`${styles.output_box} ${styles.side_by_side}`} dangerouslySetInnerHTML={{ __html: diffHtml }} />
//               </div>
//             )}
//           </div>

//           <div className={styles.button_container}>
//             <button className={styles.submit_btn} onClick={saveFinal} disabled={isLoading}>Save</button>
//           </div>

//           {showSurveyPrompt && (
//             <div className={styles.survey_prompt} ref={surveyRef}>
//               <p className={styles.survey_text}>
//                 Please take the survey.
//                 <button className={styles.survey_btn} onClick={() => navigate("/survey", { state: { email, inputText, generatedText: outputText, finalText: outputText } })}>
//                   📑 Take the Survey
//                 </button>
//               </p>
//             </div>
//           )}

//           <p className={styles.help_text}>Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a></p>
//           <Footer />
//         </div>
//       </div>
//     </>
//   );
// }

// export default function Review(){
//   return (
//     <PageBoundary>
//       <ReviewInner />
//     </PageBoundary>
//   );
// }

// import React, { useEffect, useRef, useState, useCallback } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import { saveAs } from "file-saver";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
// import styles from "./styles.module.css";
// import Footer from "../Footer";
// import StatsButton from "../StatsButton";

// /* ---------- utils ---------- */
// const dmp = new DiffMatchPatch();
// const safeGetUser = () => { try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; } };
// const count = (s="") => ({ words: String(s).trim().split(/\s+/).filter(Boolean).length, chars: String(s).length });

// /** Normalize headings & small GFM tidy so H-levels never skip (no H3 before H2, no H1 in body). */
// const normalizeHeadings = (md = "") => {
//   const lines = String(md || "").split(/\r?\n/);
//   let lastLevel = 1;
//   const out = lines.map((line) => {
//     const m = line.match(/^(#{1,6})\s+(.*)$/);
//     if (!m) return line;
//     let lvl = m[1].length;
//     if (lvl < 2) lvl = 2;                     // never H1 in document body
//     if (lvl > lastLevel + 1) lvl = lastLevel + 1; // don't skip levels
//     lastLevel = lvl;
//     return `${"#".repeat(lvl)} ${m[2].trim()}`;
//   });
//   return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
// };
// const coerceGFM = (md="") =>
//   normalizeHeadings(md.replace(/^\s*[\*\+]\s/gm, "- ").replace(/^\s*(\d+)\)\s/gm, "$1. ").replace(/[ \t]+$/gm, ""));

// const diffHTML = (a = "", b = "") => {
//   const diffs = dmp.diff_main(a ?? "", b ?? "");
//   dmp.diff_cleanupSemantic(diffs);
//   return diffs.map(([op, txt]) => {
//     if (op === DiffMatchPatch.DIFF_INSERT) return `<span style="background:#d4fcdc;color:#08660f;">${txt}</span>`;
//     if (op === DiffMatchPatch.DIFF_DELETE) return `<span style="background:#ffecec;color:#8f1d1d;text-decoration:line-through;">${txt}</span>`;
//     return txt;
//   }).join("");
// };

// /* ---------- component ---------- */
// export default function Review() {
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const surveyRef = useRef(null);

//   const fallback = (() => { try { return JSON.parse(sessionStorage.getItem("lastGenerated")) || null; } catch { return null; } })();
//   const initialInput  = state?.inputText  ?? fallback?.inputText  ?? "";
//   const initialOutput = state?.outputText ?? fallback?.outputText ?? "";

//   const user = safeGetUser();
//   const email = user?.email ?? null;

//   // Data sets
//   const [documents, setDocuments] = useState([]);
//   const [selectedDocId, setSelectedDocId] = useState(null);

//   // Texts
//   const [inputText, setInputText] = useState(initialInput);
//   const [outputText, setOutputText] = useState(coerceGFM(initialOutput));

//   // UI + metrics
//   const [isSidebarVisible, setIsSidebarVisible] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isEditing, setIsEditing] = useState(false);
//   const [showDifference, setShowDifference] = useState(false);
//   const [isDirty, setIsDirty] = useState(false);
//   const [{words:inW, chars:inC}, setInStats] = useState(count(initialInput));
//   const [{words:outW, chars:outC}, setOutStats] = useState(count(initialOutput));
//   const [diffHtml, setDiffHtml] = useState(diffHTML(initialInput, initialOutput));
//   const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);

//   // quick controls above output
//   const [lengthChoice, setLengthChoice] = useState("same"); // same | shorter | much_shorter
//   const [tone, setTone] = useState("neutral");

//   // ---------- effects ----------
//   useEffect(() => {
//     if (!email) return;
//     (async () => {
//       try {
//         const res = await fetch(`/api/simplifications/user/${email}`);
//         const json = await res.json();
//         if (res.ok) {
//           const sorted = json.data.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
//           setDocuments(sorted);
//           if (!state && sorted.length) {
//             const first = sorted[0];
//             setSelectedDocId(first._id);
//             setInputText(first.inputText);
//             setOutputText(coerceGFM(first.outputText));
//           }
//         }
//       } catch (err) { console.error("fetch docs", err); }
//     })();
//   }, [email, state]);

//   useEffect(() => setInStats(count(inputText)), [inputText]);
//   useEffect(() => { setOutStats(count(outputText)); setDiffHtml(diffHTML(inputText, outputText)); }, [inputText, outputText]);

//   // leave-page guard if unsaved
//   useEffect(() => {
//     const h = (e) => { if (!isDirty) return; e.preventDefault(); e.returnValue = ""; };
//     window.addEventListener("beforeunload", h);
//     return () => window.removeEventListener("beforeunload", h);
//   }, [isDirty]);

//   // ---------- helpers ----------
//   const buildPrefsText = useCallback(() => {
//     const ratios = { same: 1, shorter: 0.75, much_shorter: 0.5 };
//     const target = Math.max(10, Math.round(inW * (ratios[lengthChoice] ?? 1)));
//     const toneLine = tone !== "neutral" ? `• Use a ${tone} tone.\n` : "";
//     return `• Aim for ~${target} words while preserving meaning.\n${toneLine}`;
//   }, [inW, lengthChoice, tone]);

//   const buildPrompt = useCallback((text) => `
// You are an expert plain-language editor.
// Rewrite the text in clear **GitHub-Flavored Markdown**.

// Rules:
// • Keep facts, intent, and sequence accurate. No hallucinations.
// • Use headings, lists, short paragraphs. Start sections at **##** (H2). Never use H1 inside the body.
// • Do not skip heading levels (no H3 before H2).
// • Replace jargon with everyday words. Define acronyms on first use.
// • Return **only** valid Markdown (no commentary).

// Preferences:
// ${buildPrefsText()}

// Text:
// "${text}"
// `.trim(), [buildPrefsText]);

//   const splitChunks = (txt, max = 3500) => {
//     const words = String(txt).split(/\s+/);
//     const chunks = [];
//     let cur = [];
//     for (const w of words) {
//       const next = (cur.join(" ") + " " + w).trim();
//       if (next.length <= max) cur.push(w);
//       else { if (cur.length) chunks.push(cur.join(" ")); cur = [w]; }
//     }
//     if (cur.length) chunks.push(cur.join(" "));
//     return chunks;
//   };

//   // ---------- actions ----------
//   const regenerate = async () => {
//     if (!inputText.trim()) return;
//     setIsLoading(true);
//     try {
//       const chunks = splitChunks(inputText);
//       const reqs = chunks.map(async (ch) => {
//         const res = await fetch("/api/gpt4", {
//           method: "POST", headers: {"Content-Type":"application/json"},
//           body: JSON.stringify({ prompt: buildPrompt(ch) })
//         });
//         const data = await res.json();
//         let t = "";
//         if (typeof data?.response === "string") t = data.response;
//         else if (Array.isArray(data?.choices)) t = data.choices.map(c => c?.message?.content || "").join(" ");
//         else if (typeof data?.text === "string") t = data.text;
//         else if (data?.response?.content) t = data.response.content.map(c => c?.text || "").join(" ");
//         return coerceGFM(t);
//       });
//       const combined = coerceGFM((await Promise.all(reqs)).join("\n\n"));

//       setOutputText(combined);
//       setIsDirty(true);

//       // store a version for analysis
//       await fetch("/api/simplifications/version", {
//         method: "POST",
//         headers: {"Content-Type":"application/json"},
//         body: JSON.stringify({
//           email, inputText,
//           producedText: combined,
//           source: "resimplify",
//           prefsSnapshot: { lengthChoice, tone }
//         })
//       });
//     } catch (e) {
//       console.error("regenerate", e);
//     } finally { setIsLoading(false); }
//   };

//   const saveFinal = async () => {
//     try {
//       const res = await fetch("/api/simplifications/final", {
//         method: "PUT",
//         headers: {"Content-Type":"application/json"},
//         body: JSON.stringify({ email, inputText, finalText: outputText })
//       });
//       if (res.ok) {
//         setIsDirty(false);
//         setShowSurveyPrompt(true);
//         setTimeout(() => surveyRef.current?.scrollIntoView({ behavior: "smooth" }), 250);
//         navigate("/survey", { state: { email, inputText, generatedText: outputText, finalText: outputText }});
//       }
//     } catch(e){ console.error("save final", e); }
//   };

//   const onEditChange = (e) => { setOutputText(coerceGFM(e.target.value)); setIsDirty(true); };

//   const handleDocumentClick = (doc) => {
//     setSelectedDocId(doc._id);
//     setInputText(doc.inputText);
//     setOutputText(coerceGFM(doc.outputText));
//     setIsEditing(false);
//     setShowDifference(false);
//   };

//   const handleLogout = () => { localStorage.removeItem("token"); navigate("/Login"); };

//   // ---------- render ----------
//   return (
//     <>
//       <nav className={styles.navbar}>
//         <h1 onClick={() => (window.location.href = "/")} style={{ cursor: "pointer" }}>
//           Text Simplification Tool
//         </h1>
//         <button className={styles.white_btn} onClick={handleLogout}>Logout</button>
//       </nav>

//       <div className={styles.container}>
//         {/* Sidebar / History */}
//         <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
//           <button className={styles.historyIcon} onClick={() => setIsSidebarVisible(s=>!s)}>
//             🕒 <p style={{ fontSize: 15 }}> History </p>
//           </button>
//           {isSidebarVisible && (
//             <div className={styles.historyContent}>
//               <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>✖</button>
//               <ul className={styles.historyList}>
//                 {documents.map((doc, idx) => (
//                   <li key={doc._id} className={styles.historyItem} onClick={() => handleDocumentClick(doc)}>
//                     <strong>Document {documents.length - idx}</strong> ({doc.inputText.slice(0, 20)}…)
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
//               Please review the simplified text. You can edit the Markdown or regenerate with the options below.
//               {isDirty && <strong style={{ marginLeft: 8, color: "#9a6700" }}> Unsaved changes</strong>}
//             </p>
//           </div>

//           <div className={styles.textareas_container}>
//             {/* Input */}
//             <div className={styles.text_container}>
//               <div className={styles.labelWrapper}>
//                 <label className={styles.label}>Input Text</label>
//                 <div className={styles.actions}>
//                   <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(inputText)}>📋 <span className={styles.iconLabel}>Copy</span></button>
//                   <button className={styles.actionButton} onClick={() => saveAs(new Blob([inputText],{type:"text/plain;charset=utf-8"}), "InputText.txt")}>📥 <span className={styles.iconLabel}>Download</span></button>
//                   <StatsButton text={inputText} />
//                 </div>
//               </div>
//               <p className={styles.countText}>Words: {inW} | Characters: {inC}</p>
//               <textarea className={`${styles.textarea} ${styles.side_by_side}`} value={inputText} readOnly />
//             </div>

//             {/* Output controls + editor */}
//             <div className={styles.text_container}>
//               <div className={styles.labelWrapper}>
//                 <label className={styles.label}>AI-generated Text (Markdown)</label>
//                 <div className={styles.actions}>
//                   <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(outputText)}>📋 <span className={styles.iconLabel}>Copy</span></button>
//                   <button className={styles.actionButton} onClick={() => saveAs(new Blob([outputText],{type:"text/markdown;charset=utf-8"}), "Generated.md")}>📥 <span className={styles.iconLabel}>Download</span></button>
//                   <StatsButton text={outputText} />
//                   <button className={styles.toggleDiffBtn} onClick={() => setShowDifference(s => !s)}>
//                     {showDifference ? "Hide Difference" : "Show Difference"}
//                   </button>
//                   <button className={styles.actionButton} onClick={() => setIsEditing((s)=>!s)}>
//                     {isEditing ? "Show Rendered Output" : "Edit Output"}
//                   </button>
//                 </div>
//               </div>

//               {/* quick prefs ABOVE output */}
//               <div className={styles.quickPrefs}>
//                 <div className={styles.sliderRow}>
//                   <span>Output length:</span>
//                   <input
//                     type="range" min="0" max="2"
//                     value={["same","shorter","much_shorter"].indexOf(lengthChoice)}
//                     onChange={(e)=>setLengthChoice(["same","shorter","much_shorter"][Number(e.target.value)])}
//                     className={styles.sliderInput}
//                     aria-label="Output length"
//                   />
//                   <div className={styles.sliderLabels}>
//                     <span className={lengthChoice==="same"?styles.activeLabel:""}>Same</span>
//                     <span className={lengthChoice==="shorter"?styles.activeLabel:""}>Shorter</span>
//                     <span className={lengthChoice==="much_shorter"?styles.activeLabel:""}>Much shorter</span>
//                   </div>
//                 </div>

//                 <div className={styles.toneRow}>
//                   <label> Tone: </label>
//                   <select value={tone} onChange={(e)=>setTone(e.target.value)}>
//                     <option value="neutral">Neutral</option>
//                     <option value="formal">Formal</option>
//                     <option value="academic">Academic</option>
//                     <option value="casual">Casual</option>
//                     <option value="creative">Creative</option>
//                   </select>
//                   <button className={styles.actionButton} onClick={regenerate} disabled={isLoading}>
//                     🔄 <span className={styles.iconLabel}>{isLoading ? "Regenerating…" : "Re-generate"}</span>
//                   </button>
//                 </div>
//               </div>

//               <p className={styles.countText}>Words: {outW} | Characters: {outC}</p>

//               {/* Editor: rendered by default, textarea when editing */}
//               {isEditing ? (
//                 <textarea
//                   className={`${styles.textarea} ${styles.side_by_side} ${styles.editable}`}
//                   value={outputText}
//                   onChange={onEditChange}
//                   aria-label="Edit AI-generated markdown"
//                 />
//               ) : (
//                 <div className={`${styles.output_box} ${styles.side_by_side}`}>
//                   <ReactMarkdown remarkPlugins={[remarkGfm]}>{outputText}</ReactMarkdown>
//                 </div>
//               )}
//             </div>

//             {showDifference && (
//               <div className={styles.text_container}>
//                 <div className={styles.labelWrapper}>
//                   <label className={styles.label}>Difference (vs input)</label>
//                 </div>
//                 <div className={`${styles.output_box} ${styles.side_by_side}`} dangerouslySetInnerHTML={{ __html: diffHtml }} />
//               </div>
//             )}
//           </div>

//           <div className={styles.button_container}>
//             <button className={styles.submit_btn} onClick={saveFinal} disabled={isLoading}>Save</button>
//           </div>

//           {showSurveyPrompt && (
//             <div className={styles.survey_prompt} ref={surveyRef}>
//               <p className={styles.survey_text}>
//                 Please take the survey.
//                 <button className={styles.survey_btn} onClick={() => navigate("/survey", { state: { email, inputText, generatedText: outputText, finalText: outputText } })}>
//                   📑 Take the Survey
//                 </button>
//               </p>
//             </div>
//           )}

//           <p className={styles.help_text}>Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a></p>
//           <Footer />
//         </div>
//       </div>
//     </>
//   );
// }

// import React, { useState, useEffect, useMemo, useRef } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import { saveAs } from "file-saver";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
// import MDEditor from "@uiw/react-md-editor";
// import styles from "./styles.module.css";
// import Footer from "../Footer";
// import StatsButton from "../StatsButton";
// import { coerceGFM } from "../../utils/markdown";

// /* ---------- helpers ---------- */
// const safeGetUser = () => {
//   try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; }
// };

// const dmp = new DiffMatchPatch();
// const diffHTML = (a = "", b = "") => {
//   const diffs = dmp.diff_main(a ?? "", b ?? "");
//   dmp.diff_cleanupSemantic(diffs);
//   return diffs.map(([op, txt]) => {
//     if (op === DiffMatchPatch.DIFF_INSERT) return `<span style="background:#d4fcdc;color:#08660f;">${txt}</span>`;
//     if (op === DiffMatchPatch.DIFF_DELETE) return `<span style="background:#ffecec;color:#8f1d1d;text-decoration:line-through;">${txt}</span>`;
//     return txt;
//   }).join("");
// };

// const wordChar = (s="") => ({
//   words: String(s).trim().split(/\s+/).filter(Boolean).length,
//   chars: String(s).length
// });

// /* ---------- component ---------- */
// export default function Review() {
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const surveyRef = useRef(null);

//   // seed from router OR sessionStorage
//   const fallback = (() => {
//     try { return JSON.parse(sessionStorage.getItem("lastGenerated")) || null; } catch { return null; }
//   })();
//   const initialInput  = state?.inputText  ?? fallback?.inputText  ?? "";
//   const initialOutput = state?.outputText ?? fallback?.outputText ?? "";

//   const user = safeGetUser();
//   const email = user?.email ?? null;

//   // --------- data ----------
//   const [documents, setDocuments] = useState([]);
//   const [selectedDocId, setSelectedDocId] = useState(null);
//   const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);

//   // main texts
//   const [inputText, setInputText] = useState(initialInput);
//   const [outputText, setOutputText] = useState(coerceGFM(initialOutput));

//   // keep a stable baseline for diff even after regenerations
//   const [diffBaseline, setDiffBaseline] = useState(coerceGFM(initialOutput));

//   // metrics
//   const [{words:inW, chars:inC}, setInStats]   = useState(wordChar(initialInput));
//   const [{words:outW, chars:outC}, setOutStats] = useState(wordChar(initialOutput));
//   const [diffHtml, setDiffHtml] = useState(diffHTML(inputText, outputText));

//   // UI
//   const [showDifference, setShowDifference] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isDirty, setIsDirty] = useState(false);
//   const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);
//   const [isSidebarVisible, setIsSidebarVisible] = useState(false);

//   // quick controls ABOVE output
//   const lengthOptions = ["same", "shorter", "much_shorter"];
//   const [lengthChoice, setLengthChoice] = useState("same");
//   const [tone, setTone] = useState("neutral");

//   // keep last saved draft to avoid dup writes
//   const lastDraftRef = useRef("");

//   /* ---------- effects ---------- */

//   useEffect(() => {
//     if (!email) return;
//     (async () => {
//       try {
//         const res = await fetch(`/api/simplifications/user/${email}`);
//         const json = await res.json();
//         if (res.ok) {
//           const sorted = json.data.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
//           setDocuments(sorted);
//           if (!state && sorted.length) {
//             const first = sorted[0];
//             setSelectedDocId(first._id);
//             setSelectedVersionIdx(0);
//             setInputText(first.inputText);
//             setOutputText(coerceGFM(first.outputText));
//             setDiffBaseline(coerceGFM(first.outputText));
//           }
//         }
//       } catch(e) { console.error("fetch docs", e); }
//     })();
//   }, [email, state]);

//   useEffect(() => setInStats(wordChar(inputText)), [inputText]);
//   useEffect(() => {
//     setOutStats(wordChar(outputText));
//     setDiffHtml(diffHTML(diffBaseline, outputText)); // diff vs baseline (sticky)
//   }, [outputText, diffBaseline]);

//   // autosave draft edits every 1.5s when dirty
//   useEffect(() => {
//     if (!isDirty) return;
//     const id = setTimeout(async () => {
//       if (lastDraftRef.current === outputText) return;
//       lastDraftRef.current = outputText;
//       setIsDirty(false);
//       try {
//         await fetch("/api/simplifications/edit", {
//           method: "PUT",
//           headers: {"Content-Type":"application/json"},
//           body: JSON.stringify({ email, inputText, editedText: outputText })
//         });
//       } catch(e){ console.error("autosave edit", e); }
//     }, 1500);
//     return () => clearTimeout(id);
//   }, [isDirty, outputText, email, inputText]);

//   // “are you sure?” when leaving with dirty edits
//   useEffect(() => {
//     const onBeforeUnload = (e) => {
//       if (!isDirty) return;
//       e.preventDefault();
//       e.returnValue = "";
//     };
//     window.addEventListener("beforeunload", onBeforeUnload);
//     return () => window.removeEventListener("beforeunload", onBeforeUnload);
//   }, [isDirty]);

//   /* ---------- regenerate with controls ---------- */
//   const buildPrefsText = () => {
//     const ratios = { same: 1, shorter: 0.75, much_shorter: 0.5 };
//     const target = Math.max(10, Math.round(inW * (ratios[lengthChoice] ?? 1)));
//     const toneInstr = tone !== "neutral" ? `• Use a ${tone} tone.\n` : "";
//     return `• Aim for ~${target} words while preserving meaning.\n${toneInstr}`;
//   };

//   const buildPrompt = (text) => `
// You are an expert plain-language editor.
// Rewrite the text in clear **GitHub-Flavored Markdown**.

// Rules:
// • Keep facts, intent, and sequence accurate. No hallucinations.
// • Use headings, lists, short paragraphs. Start sections at **##** (H2). Never use H1 inside the body.
// • Do not skip heading levels (no H3 before H2).
// • Replace jargon with everyday words. Define acronyms on first use.
// • Return **only** valid Markdown (no extra commentary).

// Preferences:
// ${buildPrefsText()}

// Text:
// "${text}"
// `.trim();

//   const splitChunks = (txt, max = 3500) => {
//     const words = String(txt).split(/\s+/);
//     const chunks = [];
//     let cur = [];
//     for (const w of words) {
//       const next = (cur.join(" ") + " " + w).trim();
//       if (next.length <= max) cur.push(w);
//       else { if (cur.length) chunks.push(cur.join(" ")); cur = [w]; }
//     }
//     if (cur.length) chunks.push(cur.join(" "));
//     return chunks;
//   };

//   const regenerate = async () => {
//     if (!inputText.trim()) return;
//     setIsLoading(true);
//     try {
//       // keep the "Show Difference" baseline pinned to the *previous* text
//       setDiffBaseline(outputText);

//       const chunks = splitChunks(inputText, 3500);
//       const reqs = chunks.map(async (ch) => {
//         const res = await fetch("/api/gpt4", {
//           method: "POST",
//           headers: {"Content-Type":"application/json"},
//           body: JSON.stringify({ prompt: buildPrompt(ch) })
//         });
//         const data = await res.json();
//         // normalize across shapes
//         let t = "";
//         if (typeof data?.response === "string") t = data.response;
//         else if (Array.isArray(data?.choices)) t = data.choices.map(c => c?.message?.content || "").join(" ");
//         else if (typeof data?.text === "string") t = data.text;
//         else if (data?.response?.content) t = data.response.content.map(c => c?.text || "").join(" ");
//         return coerceGFM(t);
//       });
//       const combined = coerceGFM((await Promise.all(reqs)).join("\n\n"));

//       // update screen
//       setOutputText(combined);
//       setIsDirty(true); // so it autosaves as an edit

//       // also persist a "version" row (even if user never saves)
//       await fetch("/api/simplifications/version", {
//         method: "POST",
//         headers: {"Content-Type":"application/json"},
//         body: JSON.stringify({
//           email,
//           inputText,
//           producedText: combined,
//           source: "resimplify",
//           prefsSnapshot: { lengthChoice, tone },
//         })
//       });
//     } catch(e) {
//       console.error("regenerate", e);
//     } finally { setIsLoading(false); }
//   };

//   /* ---------- actions ---------- */
//   const saveFinal = async () => {
//     try {
//       const res = await fetch("/api/simplifications/final", {
//         method: "PUT",
//         headers: {"Content-Type":"application/json"},
//         body: JSON.stringify({ email, inputText, finalText: outputText })
//       });
//       if (res.ok) {
//         setIsDirty(false);
//         setShowSurveyPrompt(true);
//         setTimeout(() => surveyRef.current?.scrollIntoView({ behavior:"smooth" }), 250);
//         // send both generated (baseline) and final to survey page
//         navigate("/survey", {
//           state: {
//             email,
//             inputText,
//             generatedText: diffBaseline, // Version used for diff baseline
//             finalText: outputText
//           }
//         });
//       }
//     } catch(e){ console.error("save final", e); }
//   };

//   const handleLogout = () => { localStorage.removeItem("token"); navigate("/Login"); };

//   /* ---------- render ---------- */
//   return (
//     <>
//       <nav className={styles.navbar}>
//         <h1 onClick={() => (window.location.href = "/")} style={{cursor:"pointer"}}>Text Simplification Tool</h1>
//         <button className={styles.white_btn} onClick={handleLogout}>Logout</button>
//       </nav>

//       <div className={styles.container}>
//         {/* Sidebar */}
//         <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
//           <button className={styles.historyIcon} onClick={() => setIsSidebarVisible(s=>!s)}>🕒 <p style={{fontSize:15}}> History </p></button>
//           {isSidebarVisible && (
//             <div className={styles.historyContent}>
//               <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>✖</button>
//               <ul className={styles.historyList}>
//                 {documents.map((doc, idx) => (
//                   <li key={doc._id} className={styles.historyItem} onClick={() => {
//                     setSelectedDocId(doc._id); setSelectedVersionIdx(0);
//                     setInputText(doc.inputText);
//                     setOutputText(coerceGFM(doc.outputText));
//                     setDiffBaseline(coerceGFM(doc.outputText));
//                   }}>
//                     <strong>Document {documents.length - idx}</strong> ({doc.inputText.slice(0,20)}…)
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>

//         {/* Main */}
//         <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
//           <div className={styles.description}>
//             <p>Please review the simplified text. You can edit inline or regenerate with the controls above the output. {isDirty && <strong style={{marginLeft:8,color:"#9a6700"}}>Unsaved changes</strong>}</p>
//           </div>

//           <div className={styles.textareas_container}>
//             {/* Input (readonly) */}
//             <div className={styles.text_container}>
//               <div className={styles.labelWrapper}>
//                 <label className={styles.label}>Input Text</label>
//                 <div className={styles.actions}>
//                   <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(inputText)}>📋 <span className={styles.iconLabel}>Copy</span></button>
//                   <button className={styles.actionButton} onClick={() => saveAs(new Blob([inputText],{type:"text/plain;charset=utf-8"}), "InputText.txt")}>📥 <span className={styles.iconLabel}>Download</span></button>
//                   <StatsButton text={inputText} />
//                 </div>
//               </div>
//               <p className={styles.countText}>Words: {inW} | Characters: {inC}</p>
//               <textarea className={`${styles.textarea} ${styles.side_by_side}`} value={inputText} readOnly />
//             </div>

//             {/* Output with controls (slider + tone) */}
//             <div className={styles.text_container} data-color-mode="light">
//               <div className={styles.labelWrapper}>
//                 <label className={styles.label}>AI-generated Text (Markdown)</label>
//                 <div className={styles.actions}>
//                   <button className={styles.actionButton} onClick={() => navigator.clipboard.writeText(outputText)}>📋 <span className={styles.iconLabel}>Copy</span></button>
//                   <button className={styles.actionButton} onClick={() => saveAs(new Blob([outputText],{type:"text/markdown;charset=utf-8"}), "Generated.md")}>📥 <span className={styles.iconLabel}>Download</span></button>
//                   <StatsButton text={outputText} />
//                   <button className={styles.toggleDiffBtn} onClick={() => setShowDifference(s=>!s)}>{showDifference ? "Hide Difference" : "Show Difference"}</button>
//                 </div>
//               </div>

//               {/* quick prefs above editor */}
//               <div className={styles.quickPrefs}>
//                 <div className={styles.sliderRow}>
//                   <span>Output length:</span>
//                   <input
//                     type="range"
//                     min="0"
//                     max="2"
//                     value={["same","shorter","much_shorter"].indexOf(lengthChoice)}
//                     onChange={(e)=>setLengthChoice(["same","shorter","much_shorter"][Number(e.target.value)])}
//                     className={styles.sliderInput}
//                     aria-label="Output length"
//                   />
//                   <div className={styles.sliderLabels}>
//                     <span className={lengthChoice==="same"?styles.activeLabel:""}>Same</span>
//                     <span className={lengthChoice==="shorter"?styles.activeLabel:""}>Shorter</span>
//                     <span className={lengthChoice==="much_shorter"?styles.activeLabel:""}>Much shorter</span>
//                   </div>
//                 </div>

//                 <div className={styles.toneRow}>
//                   <label> Tone: </label>
//                   <select value={tone} onChange={(e)=>setTone(e.target.value)}>
//                     <option value="neutral">Neutral</option>
//                     <option value="formal">Formal</option>
//                     <option value="academic">Academic</option>
//                     <option value="casual">Casual</option>
//                     <option value="creative">Creative</option>
//                   </select>

//                   <button className={styles.actionButton} onClick={regenerate} disabled={isLoading} title="Re-generate with the selected options">
//                     🔄 <span className={styles.iconLabel}>{isLoading ? "Regenerating…" : "Re-generate"}</span>
//                   </button>

//                   <button className={styles.actionButton} onClick={()=>setDiffBaseline(outputText)} title="Set current output as new diff baseline">📌 <span className={styles.iconLabel}>Pin as baseline</span></button>
//                 </div>
//               </div>

//               <p className={styles.countText}>Words: {outW} | Characters: {outC}</p>

//               {/* Markdown editor (editable preview) */}
//               <div className={`${styles.output_box} ${styles.side_by_side}`}>
//                 <MDEditor
//                   value={outputText}
//                   onChange={(val) => { setOutputText(coerceGFM(val || "")); setIsDirty(true); }}
//                   preview="live"
//                   hideToolbar={false}
//                   visiableDragbar={false}
//                   previewOptions={{ remarkPlugins: [remarkGfm] }}
//                 />
//               </div>
//             </div>

//             {/* Diff vs baseline */}
//             {showDifference && (
//               <div className={styles.text_container}>
//                 <div className={styles.labelWrapper}>
//                   <label className={styles.label}>Difference (vs pinned baseline)</label>
//                 </div>
//                 <div className={`${styles.output_box} ${styles.side_by_side}`} dangerouslySetInnerHTML={{ __html: diffHtml }} />
//               </div>
//             )}
//           </div>

//           {/* Save */}
//           <div className={styles.button_container}>
//             <button className={styles.submit_btn} onClick={saveFinal} disabled={isLoading}>Save</button>
//           </div>

//           {showSurveyPrompt && (
//             <div className={styles.survey_prompt} ref={surveyRef}>
//               <p className={styles.survey_text}>
//                 Please take the short survey.
//                 <button
//                   className={styles.survey_btn}
//                   onClick={() => navigate("/survey", { state: { email, inputText, generatedText: diffBaseline, finalText: outputText } })}
//                 >
//                   📑 Take the Survey
//                 </button>
//               </p>
//             </div>
//           )}

//           <p className={styles.help_text}>Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a></p>
//           <Footer />
//         </div>
//       </div>
//     </>
//   );
// }

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


