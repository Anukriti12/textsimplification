const mongoose = require("mongoose");

const simplificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true },
    inputText: { type: String, required: true },
    outputText: { type: String, required: true },
    editHistory: [
      {
        text: { type: String, required: true }, // Text from each edit
        timestamp: { type: Date, default: Date.now }, // Fix typo (tsype → type)
        numWords: { type: Number, required: true }, // Store word count for edits
        numChars: { type: Number, required: true }, // Store character count for edits
      },
    ],
    saveHistory: [
      {
        finalText: { type: String, required: true }, // Final text after saving
        timestamp: { type: Date, default: Date.now }, // Timestamp of save
        numWords: { type: Number, required: true }, // Word count for saved version
        numChars: { type: Number, required: true }, // Character count for saved version
        surveyAnswers: {  // Store survey per final submission
          readability: { type: Number, default: null },
          accuracy: { type: Number, default: null },
          comments: { type: String, default: null },
        },
      },
    ],
    metrics: {
      processingTimeMs: { type: Number, default: null },
      numWordsInput: { type: Number, required: true }, // Required to track input stats
      numCharsInput: { type: Number, required: true },
      numWordsOutput: { type: Number, required: true },
      numCharsOutput: { type: Number, required: true },
    },
  },
  { timestamps: true }
);

const Simplification = mongoose.model("Simplification", simplificationSchema);

module.exports = Simplification;

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


