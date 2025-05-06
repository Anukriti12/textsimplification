const mongoose = require("mongoose");

const { calcMetrics, diffStats } = require("../client/src/utils/textMetrics"); // §4

/* ----- reusable metric block ----- */
const metricsSchema = new mongoose.Schema(
  {
    fleschReadingEase:       Number,
    fleschKincaidGrade:      Number,
    lexicalDensity:          Number,
    wordCount:               Number,
    uniqueWords:             Number,
    sentenceCount:           Number,
    avgSentenceLength:       Number,
    charsWithSpaces:         Number,
    charsWithoutSpaces:      Number,
    avgCharsPerWord:         Number,
    syllableCount:           Number,
    avgSyllablesPerWord:     Number,
  },
  { _id: false }
);

/* ----- sub‑documents ----- */
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

/* ----- master document ----- */
const simplificationSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  email:      { type: String, required: true },
  inputText:  { type: String, required: true },
  inputMetrics:  metricsSchema,

  outputText:    String,
  outputMetrics: metricsSchema,

  pdfName:     String,
  pdfPath:     String,          // or base‑64 / GridFS id
  timestamps: {
    submitted:     Date,        // when user hit “Simplify”
    aiGenerated:   Date,        // when your server responded
    finalSaved:    Date,        // when user hit “Save”
  },

  editHistory:  [editSchema],   // may be empty
  finalOutput:  finalSchema,    // may be {} if user never saved
  saveHistory: [finalSchema],  
}, { timestamps: true });

/* ensure userId + inputText is UNIQUE → one document per prompt */
simplificationSchema.index({ userId: 1, inputText: 1 }, { unique: true });

module.exports = mongoose.model("Simplification", simplificationSchema);

// const simplificationSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
//   email: { type: String, required: true },
//   inputText: { type: String, required: true },
//   outputHistory: [{
//     text: String,
//     timestamp: { type: Date, default: Date.now },
//     metrics: {
//       fleschReadingEase: Number,
//       fleschKincaidGrade: Number,
//       lexicalDensity: Number,
//       wordCount: Number,
//       uniqueWords: Number,
//       sentenceCount: Number,
//       avgSentenceLength: Number,
//       charsWithSpaces: Number,
//       charsWithoutSpaces: Number,
//       avgCharsPerWord: Number,
//       syllableCount: Number,
//       avgSyllablesPerWord: Number
//     }
//   }],
//   editHistory: [{
//     text: String,
//     timestamp: { type: Date, default: Date.now }
//   }],
//   finalOutput: {
//     text: String,
//     timestamp: Date,
//     surveyMetrics: {
//       readability: String,
//       easy: String,
//       clarity: String,
//       meaning: String,
//       grammar: String,
//       needs: String,
//       guidelines: String,
//       coherent: String,
//       relevancy: String,
//       editing_effort: String,
//       edit_reasons: String,
//       additional_comments: String
//     },
//     textMetrics: {
//       // Same structure as outputHistory.metrics
//     }
//   },
//   createdAt: { type: Date, default: Date.now }
// });


// const Simplification = mongoose.model("Simplification", simplificationSchema);

// module.exports = Simplification;









// const mongoose = require("mongoose");

// const simplificationSchema = new mongoose.Schema(
//   {
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//     email: { type: String, required: true },
//     inputText: { type: String, required: true },
//     outputText: { type: String, required: true },
//     editHistory: [
//       {
//         text: { type: String, required: true }, // Text from each edit
//         timestamp: { tsype: Date, default: Date.now }, // Timestamp of the edit
//       },
//     ],
//     saveHistory: [
//       {
//         finalText: { type: String, required: true }, // Final text after saving
//         timestamp: { type: Date, default: Date.now }, // Timestamp of the save
//       },
//     ],
//     surveyAnswers: {
//       readability: { type: Number, default: null },
//       accuracy: { type: Number, default: null },
//       comments: { type: String, default: null },
//     },
//     metrics: {
//       processingTimeMs: { type: Number, default: null },
//       numWordsInput: { type: Number, default: null },
//       numWordsOutput: { type: Number, default: null },
//     },
//   },
//   { timestamps: true }
// );

// const Simplification = mongoose.model("Simplification", simplificationSchema);

// module.exports = Simplification;


