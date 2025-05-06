import React, { useMemo, useState } from "react";
import { calcMetrics } from "../../utils/textMetrics";   // ← already written
import styles from "./styles.module.css";                 // make next

/** Small icon‑button that pops a metrics panel. */
export default function StatsButton({ text }) {
  const [open, setOpen] = useState(false);

  /* re‑compute only if the text itself changes */
  const metrics = useMemo(() => calcMetrics(text || ""), [text]);

  return (
    <div className={styles.wrapper}>
      <span
        className={styles.icon}
        title="Show statistics"
        onClick={() => setOpen((o) => !o)}
      >
        📊
      </span>

      {open && (
        <div className={styles.panel}>
          <button className={styles.close} onClick={() => setOpen(false)}>✖</button>

          <h4>Readability</h4>
          <div className={styles.row}>
            <label>Flesch Reading Ease</label>
            <span>{metrics.fleschReadingEase?.toFixed(1)}</span>
          </div>
          <div className={styles.row}>
            <label>Flesch‑Kincaid Grade</label>
            <span>{metrics.fleschKincaidGrade?.toFixed(1)}</span>
          </div>

          <h4>Linguistic Metrics</h4>
          {[
            ["Lexical density", metrics.lexicalDensity?.toFixed(2)],
            ["Word count", metrics.wordCount],
            ["Unique words", metrics.uniqueWords],
            ["Sentence count", metrics.sentenceCount],
            ["Avg. sentence length", metrics.avgSentenceLength?.toFixed(2)],
            ["Chars (with spaces)", metrics.charsWithSpaces],
            ["Chars (no spaces)", metrics.charsWithoutSpaces],
            ["Avg. chars / word", metrics.avgCharsPerWord?.toFixed(2)],
            ["Syllables (∼)", metrics.syllableCount],
            ["Avg. syllables / word", metrics.avgSyllablesPerWord?.toFixed(2)],
          ].map(([k, v]) => (
            <div key={k} className={styles.row}>
              <label>{k}</label>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
