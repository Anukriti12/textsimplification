const mongoose = require("mongoose");

/* ----- reusable metric block ----- */
const metricsSchema = new mongoose.Schema(
  {
    fleschReadingEase:   Number,
    fleschKincaidGrade:  Number,
    lexicalDensity:      Number,
    wordCount:           Number,
    uniqueWords:         Number,
    sentenceCount:       Number,
    avgSentenceLength:   Number,
    charsWithSpaces:     Number,
    charsWithoutSpaces:  Number,
    avgCharsPerWord:     Number,
    syllableCount:       Number,
    avgSyllablesPerWord: Number,
  },
  { _id: false }
);

/* ----- customization/prefs snapshot ----- */
const customizationSchema = new mongoose.Schema(
  {
    length: { type: String, enum: ["same", "shorter", "much_shorter"], default: "same" },
    tone:   { type: String, enum: ["neutral", "formal", "academic", "casual", "creative"], default: "neutral" },

    structure: {
      headings:       { type: Boolean, default: true },
      lists:          { type: Boolean, default: true },
      shortParagraphs:{ type: Boolean, default: true },
    },

    sentence: {
      breakLong:      { type: Boolean, default: true },
      activeVoice:    { type: Boolean, default: true },
      simplifyNested: { type: Boolean, default: true },
    },

    vocab: {
      everyday:       { type: Boolean, default: true },
      defineTerms:    { type: Boolean, default: true },
      expandAcronyms: { type: Boolean, default: true },
      avoidJargon:    { type: Boolean, default: true },
    },

    extra: { type: String, default: "" },
  },
  { _id: false }
);

/* ----- sub-documents ----- */
const editSchema = new mongoose.Schema(
  {
    text:          String,
    timestamp:     { type: Date, default: Date.now },
    metrics:       metricsSchema,
    editDistance:  Number,
    insertions:    Number,
    deletions:     Number,
  },
  { _id: false }
);

const finalSchema = new mongoose.Schema(
  {
    text:          String,
    timestamp:     Date,
    metrics:       metricsSchema,
    editDistance:  Number,
    insertions:    Number,
    deletions:     Number,
    surveyResponses: {
      needs: String,
      easy: String,
      meaning: String,
      relevancy: String,
      grammar: String,
      guidelines: String,
      clarity: String,
      coherent: String,
      editing_effort: String,
      main_reasons: String,
      additional_comments: String,
    },
  },
  { _id: false }
);

/* ----- regeneration/version log (optional but useful) ----- */
const versionSchema = new mongoose.Schema(
  {
    producedText:   { type: String, required: true },
    prefsSnapshot:  customizationSchema,          // <- store the exact prefs used
    source:         { type: String, enum: ["initial", "resimplify", "manual"], default: "initial" },
    timestamp:      { type: Date, default: Date.now },
    outputMetrics:  metricsSchema
  },
  { _id: false }
);

/* ----- master document ----- */
const simplificationSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    email:        { type: String, required: true },

    // Input
    inputText:    { type: String, required: true },
    inputMetrics: metricsSchema,

    // Latest AI output kept at top-level for convenience
    outputText:    String,
    outputMetrics: metricsSchema,

    // NEW: snapshot of the customization used for the initial generation
    initialPrefsSnapshot: customizationSchema,

    // Optional full version log (each regeneration push goes here)
    versions:     [versionSchema],

    // File info
    pdfName:      String,
    pdfPath:      String,

    timestamps: {
      submitted:   Date,   // when user hit “Simplify”
      aiGenerated: Date,   // when your server responded
      finalSaved:  Date,   // when user hit “Save”
    },

    // User editing & finalization
    editHistory:  [editSchema],
    finalOutput:  finalSchema,
    saveHistory:  [finalSchema],
  },
  { timestamps: true }
);

/* ensure userId + inputText is UNIQUE → one document per prompt */
simplificationSchema.index({ userId: 1, inputText: 1 }, { unique: true });

module.exports = mongoose.model("Simplification", simplificationSchema);

// const mongoose = require("mongoose");

// // const { calcMetrics, diffStats } = require("../client/src/utils/textMetrics"); // §4

// /* ----- reusable metric block ----- */
// const metricsSchema = new mongoose.Schema(
//   {
//     fleschReadingEase:       Number,
//     fleschKincaidGrade:      Number,
//     lexicalDensity:          Number,
//     wordCount:               Number,
//     uniqueWords:             Number,
//     sentenceCount:           Number,
//     avgSentenceLength:       Number,
//     charsWithSpaces:         Number,
//     charsWithoutSpaces:      Number,
//     avgCharsPerWord:         Number,
//     syllableCount:           Number,
//     avgSyllablesPerWord:     Number,
//   },
//   { _id: false }
// );

// /* ----- sub‑documents ----- */
// const editSchema = new mongoose.Schema(
//   {
//     text:          String,
//     timestamp:     { type: Date, default: Date.now },
//     metrics:       metricsSchema,
//     editDistance:  Number,
//     insertions:    Number,
//     deletions:     Number,
//   },
//   { _id: false }
// );

// const finalSchema = new mongoose.Schema(
//   {
//     text:          String,
//     timestamp:     Date,
//     metrics:       metricsSchema,
//     editDistance:  Number,
//     insertions:    Number,
//     deletions:     Number,
//     surveyResponses: {
//       needs: String,
//       easy: String,
//       meaning: String,
//       relevancy: String,
//       grammar: String,
//       guidelines: String,
//       clarity: String,
//       coherent: String,
//       editing_effort: String,
//       main_reasons: String,
//       additional_comments: String,
//     },
//   },
//   { _id: false }
// );

// /* ----- master document ----- */
// const simplificationSchema = new mongoose.Schema({
//   userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   email:      { type: String, required: true },
//   inputText:  { type: String, required: true },
//   inputMetrics:  metricsSchema,

//   outputText:    String,
//   outputMetrics: metricsSchema,

//   pdfName:     String,
//   pdfPath:     String,          // or base‑64 / GridFS id
//   timestamps: {
//     submitted:     Date,        // when user hit “Simplify”
//     aiGenerated:   Date,        // when your server responded
//     finalSaved:    Date,        // when user hit “Save”
//   },

//   editHistory:  [editSchema],   // may be empty
//   finalOutput:  finalSchema,    // may be {} if user never saved
//   saveHistory: [finalSchema],  
// }, { timestamps: true });

// /* ensure userId + inputText is UNIQUE → one document per prompt */
// simplificationSchema.index({ userId: 1, inputText: 1 }, { unique: true });

// module.exports = mongoose.model("Simplification", simplificationSchema);