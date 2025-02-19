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
        timestamp: { type: Date, default: Date.now }, // Timestamp of the edit
      },
    ],
    saveHistory: [
      {
        finalText: { type: String, required: true }, // Final text after saving
        timestamp: { type: Date, default: Date.now }, // Timestamp of the save
      },
    ],
    surveyAnswers: {
      readability: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      comments: { type: String, default: null },
    },
    metrics: {
      processingTimeMs: { type: Number, default: null },
      numWordsInput: { type: Number, default: null },
      numWordsOutput: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

const Simplification = mongoose.model("Simplification", simplificationSchema);

module.exports = Simplification;


