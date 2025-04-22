const mongoose = require("mongoose");

const simplificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true },
    inputText: { type: String, required: true },
    outputText: { type: String, required: true },
    editHistory: [
      {
        text: { type: String }, // Text from each edit
        timestamp: { type: Date, default: Date.now }, // Fix typo (tsype → type)
        numWords: { type: Number }, // Store word count for edits
        numChars: { type: Number }, // Store character count for edits
      },
    ],
    saveHistory: [
      {
        finalText: { type: String }, // Final text after saving
        timestamp: { type: Date, default: Date.now }, // Timestamp of save
        numWords: { type: Number }, // Word count for saved version
        numChars: { type: Number }, // Character count for saved version
        surveyAnswers: {  // Store survey per final submission
          readability: { type: Number, default: null },
          accuracy: { type: Number, default: null },
          comments: { type: String, default: null },
        },
      },
    ],
    metrics: {
      processingTimeMs: { type: Number, default: null },
      numWordsInput: { type: Number }, // Required to track input stats
      numCharsInput: { type: Number },
      numWordsOutput: { type: Number },
      numCharsOutput: { type: Number },
    },
  },
  { timestamps: true }
);

// Create a compound index to prevent duplicate inputText for the same user
simplificationSchema.index({ userId: 1, inputText: 1 }, { unique: true });

// Create a text index for better searching
simplificationSchema.index({ inputText: 'text', outputText: 'text' });

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


