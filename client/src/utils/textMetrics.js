// const syllable = require("syllable");         // npm i syllable
// const flesch   = require("flesch-kincaid");   // npm i flesch-kincaid
// const uniq     = require("lodash/uniq");

// exports.calcMetrics = (txt = "") => {
//   const words       = txt.trim().split(/\s+/).filter(Boolean);
//   const sentences   = txt.split(/[.!?]+/).filter(Boolean);
//   const chars       = txt.length;
//   const charsNoSp   = txt.replace(/\s+/g, "").length;
//   const syllables   = words.reduce((s, w) => s + syllable(w), 0);

//   const fk          = flesch({ sentence: sentences.length || 1,
//                                word: words.length || 1,
//                                syllable: syllables || 1 });

//   return {
//     fleschReadingEase:  fk.ease,
//     fleschKincaidGrade: fk.grade,
//     lexicalDensity:     uniq(words).length / words.length || 0,
//     wordCount:          words.length,
//     uniqueWords:        uniq(words).length,
//     sentenceCount:      sentences.length,
//     avgSentenceLength:  words.length / (sentences.length || 1),
//     charsWithSpaces:    chars,
//     charsWithoutSpaces: charsNoSp,
//     avgCharsPerWord:    charsNoSp / (words.length || 1),
//     syllableCount:      syllables,
//     avgSyllablesPerWord: syllables / (words.length || 1),
//   };
// };

// exports.diffStats = (a = "", b = "") => {
//   const dmp   = new (require("diff-match-patch"))();
//   const diffs = dmp.diff_main(a, b);
//   dmp.diff_cleanupSemantic(diffs);

//   let insertions = 0,
//       deletions  = 0;

//   diffs.forEach(([op, txt]) => {
//     if (op === 1) insertions += txt.trim().split(/\s+/).length;
//     if (op === -1) deletions  += txt.trim().split(/\s+/).length;
//   });

//   return {
//     distance: dmp.diff_levenshtein(diffs),
//     insertions,
//     deletions,
//   };
// };

/* utils/textMetrics.js
   ------------------------------------------------------------------------ */
  //  const { fleschKincaid: fk } = require('flesch-kincaid');

   const raw = require("syllable");                 // whatever shape it is
   /* 🔹 one line that never fails */
   const syllable =
     typeof raw === "function"
       ? raw
       : raw.default || raw.syllable || (() => 0);  // fallback = dummy fn
   
  //  const fk    = require("flesch-kincaid");

   const rawFk = require("flesch-kincaid");

// const fk =
//   typeof rawFk === "function"
//     ? rawFk
//     : rawFk.default || rawFk.fk || (() => 0);   

  const fk =
  (typeof rawFk === "function" && rawFk)      // (old CJS build)
  || rawFk.fleschKincaid                      // ← correct property
  || rawFk.default                            // (transpiled ESM)
  || (() => 0);                               // last‑ditch fallback

   const uniq  = require("lodash/uniq");
   const DMP   = require("diff-match-patch");
   
   /* safe division to avoid NaN / Infinity */
   const div = (n, d) => (d ? n / d : 0);
   
   /* ---------------------------------------------------------------------- */
   exports.calcMetrics = (txt = "") => {
     const words      = txt.trim().split(/\s+/).filter(Boolean);
     const sentences  = txt.split(/[.!?]+/).filter(Boolean);
     const charsWS    = txt.length;
     const charsNoWS  = txt.replace(/\s+/g, "").length;
     const syllables  = words.reduce((s, w) => s + syllable(w), 0);
   
     /* FK grade from package */
     const fkGrade = fk({
       sentence : sentences.length || 1,
       word     : words.length     || 1,
       syllable : syllables        || 1,
     });
   
     /* FRE ease – manual formula */
     const freEase =
       206.835 -
       1.015 * div(words.length, sentences.length || 1) -
       84.6  * div(syllables,   words.length     || 1);
   
     return {
       fleschReadingEase   : +freEase.toFixed(2),
       fleschKincaidGrade  : +fkGrade.toFixed(2),
       lexicalDensity      : div(uniq(words).length, words.length),
       wordCount           : words.length,
       uniqueWords         : uniq(words).length,
       sentenceCount       : sentences.length,
       avgSentenceLength   : +div(words.length, sentences.length || 1).toFixed(2),
       charsWithSpaces     : charsWS,
       charsWithoutSpaces  : charsNoWS,
       avgCharsPerWord     : +div(charsNoWS, words.length || 1).toFixed(2),
       syllableCount       : syllables,
       avgSyllablesPerWord : +div(syllables, words.length || 1).toFixed(2),
     };
   };
   
   /* ---------------------------------------------------------------------- */
   exports.diffStats = (a = "", b = "") => {
     const dmp   = new DMP();
     const diffs = dmp.diff_main(a, b);
     dmp.diff_cleanupSemantic(diffs);
   
     let insertions = 0,
         deletions  = 0;
   
     diffs.forEach(([op, txt]) => {
       const delta = txt.trim().split(/\s+/).filter(Boolean).length;
       if (op ===  1) insertions += delta;
       if (op === -1) deletions  += delta;
     });
   
     return {
       distance   : dmp.diff_levenshtein(diffs),
       insertions,
       deletions,
     };
   };
   
/* utils/textMetrics.js
   -------------------------------------------------------------------------- */

  //  const _syllable = require("syllable");            // ≥4.x is ESM‑only
  //  /* if it's an ESM default export grab it, otherwise use the value directly */
  //  const syllable  = typeof _syllable === "function" ? _syllable : _syllable.default;
   
  //  const fk        = require("flesch-kincaid");
  //  const uniq      = require("lodash/uniq");
  //  const DiffMatchPatch = require("diff-match-patch");
   
  //  /* small helper for safe division (avoids NaN / Infinity) */
  //  const safeDiv = (num, den) => (den ? num / den : 0);
   
  //  /* --------------------------------------------------------------------------
  //   * MAIN TEXT‑METRIC AGGREGATOR
  //   * ------------------------------------------------------------------------ */
  //  exports.calcMetrics = (txt = "") => {
  //    const words     = txt.trim().split(/\s+/).filter(Boolean);
  //    const sentences = txt.split(/[.!?]+/).filter(Boolean);
  //    const charsWithSpaces    = txt.length;
  //    const charsWithoutSpaces = txt.replace(/\s+/g, "").length;
  //    const syllableCount      = words.reduce((acc, w) => acc + syllable(w), 0);
   
  //    /* FK grade – package returns only grade level */
  //    const fkGrade = fk({
  //      sentence : sentences.length || 1,
  //      word     : words.length      || 1,
  //      syllable : syllableCount     || 1,
  //    });
   
  //    /* Flesch‑Reading‑Ease – compute ourselves */
  //    const freEase =
  //      206.835 -
  //      1.015 * safeDiv(words.length,     sentences.length || 1) -
  //      84.6  * safeDiv(syllableCount,    words.length     || 1);
   
  //    return {
  //      /* headline readability scores */
  //      fleschReadingEase   : Number(freEase.toFixed(2)),
  //      fleschKincaidGrade  : Number(fkGrade.toFixed(2)),
   
  //      /* lexical / structural stats */
  //      lexicalDensity      : safeDiv(uniq(words).length, words.length),
  //      wordCount           : words.length,
  //      uniqueWords         : uniq(words).length,
  //      sentenceCount       : sentences.length,
  //      avgSentenceLength   : Number(
  //        safeDiv(words.length, sentences.length || 1).toFixed(2)
  //      ),
   
  //      /* character‑level stats */
  //      charsWithSpaces,
  //      charsWithoutSpaces,
  //      avgCharsPerWord     : Number(
  //        safeDiv(charsWithoutSpaces, words.length || 1).toFixed(2)
  //      ),
   
  //      /* syllable‑level stats */
  //      syllableCount,
  //      avgSyllablesPerWord : Number(
  //        safeDiv(syllableCount, words.length || 1).toFixed(2)
  //      ),
  //    };
  //  };
   
  //  /* --------------------------------------------------------------------------
  //   * DIFF‑BASED EDIT DISTANCE / INSERTIONS / DELETIONS
  //   * ------------------------------------------------------------------------ */
  //  exports.diffStats = (a = "", b = "") => {
  //    const dmp   = new DiffMatchPatch();
  //    const diffs = dmp.diff_main(a, b);
  //    dmp.diff_cleanupSemantic(diffs);
   
  //    let insertions = 0;
  //    let deletions  = 0;
   
  //    diffs.forEach(([op, txt]) => {
  //      const delta = txt.trim().split(/\s+/).filter(Boolean).length;
  //      if (op ===  1) insertions += delta;  // added in b
  //      if (op === -1) deletions  += delta;  // removed from a
  //    });
   
  //    return {
  //      distance   : dmp.diff_levenshtein(diffs),
  //      insertions,
  //      deletions,
  //    };
  //  };
   