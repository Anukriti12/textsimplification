// const router = require("express").Router();
// const Simplification = require("../models/simplification");
const { User } = require("../models/user");

const router = require("express").Router();
const Simplification = require("../models/simplification");
const { calcMetrics, diffStats } = require("../client/src/utils/textMetrics"); // §4

/* ------------------------------------------------------------------ */
/* 1.  CREATE or UPSERT when user clicks “Simplify”                   */
/* ------------------------------------------------------------------ */
router.post("/", async (req, res) => {
  try {
    const { userId, email, inputText, outputText, pdfName, pdfPath } = req.body;
    if (!userId || !inputText || !outputText) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const filter = { userId, inputText };
    const update = {
      $setOnInsert: {
        userId,
        email,
        inputText,
        inputMetrics:  calcMetrics(inputText),
        pdfName,
        pdfPath,
        "timestamps.submitted":  new Date(),
      },
      $set: {
        outputText,
        outputMetrics: calcMetrics(outputText),
        "timestamps.aiGenerated": new Date(),
      },
    };

    const opts = { new: true, upsert: true };
    const doc  = await Simplification.findOneAndUpdate(filter, update, opts);
    return res.status(200).json({ data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------------ */
/* 2.  SAVE FINAL OUTPUT (user presses “Save”)                        */
/* ------------------------------------------------------------------ */

router.put("/final", async (req, res) => {
  try {
    const { email, inputText, finalText } = req.body;
    if (!email || !inputText || finalText === undefined) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const doc = await Simplification.findOne({ email, inputText });
    if (!doc) return res.status(404).json({ message: "Entry not found" });

    const { distance, insertions, deletions } = diffStats(doc.outputText, finalText);

    doc.saveHistory.push(doc.finalOutput);
    doc.finalOutput = {
      text: finalText,
      timestamp: new Date(),
      metrics: calcMetrics(finalText),
      editDistance: distance,
      insertions,
      deletions,
    };
    doc.timestamps.finalSaved = new Date();
    await doc.save();
    res.json({ message: "Final saved", data: doc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------------ */
/* 3.  PUSH manual edit into editHistory (called optionally)          */
/* ------------------------------------------------------------------ */
router.put("/edit", async (req, res) => {
  try {
    const { email, inputText, editedText } = req.body;
    const doc = await Simplification.findOne({ email, inputText });
    if (!doc) return res.status(404).json({ message: "Entry not found" });

    const base = doc.editHistory.length
      ? doc.editHistory[doc.editHistory.length - 1].text
      : doc.outputText;

    const { distance, insertions, deletions } = diffStats(base, editedText);

    doc.editHistory.push({
      text: editedText,
      timestamp: new Date(),
      metrics: calcMetrics(editedText),
      editDistance: distance,
      insertions,
      deletions,
    });
    await doc.save();
    res.json({ message: "Edit saved" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------------------------------------------ */
/* 4.  SURVEY responses                                               */
/* ------------------------------------------------------------------ */
router.put("/survey", async (req, res) => {
  try {
    const { email, inputText, responses } = req.body;
    const doc = await Simplification.findOne({ email, inputText });
    if (!doc) return res.status(404).json({ message: "Entry not found" });

    if (!doc.finalOutput || !doc.finalOutput.text) {
      return res.status(400).json({ message: "No final text saved yet" });
    }

    doc.finalOutput.surveyResponses = responses;
    await doc.save();
    res.json({ message: "Survey saved" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});


/**
 * GET /api/simplifications/export
 * Returns all documents, newest first (by createdAt; fallback to _id)
 */
router.get("/export", async (req, res) => {
  try {
    console.log("📦 Export route hit...");
    const hasCreatedAt = await Simplification.exists({ createdAt: { $exists: true } });
    const sort = hasCreatedAt ? { createdAt: -1 } : { _id: -1 };
    const docs = await Simplification.find({}).sort(sort).lean();

    console.log(`✅ Exported ${docs.length} records`);
    res.json({ count: docs.length, data: docs });
  } catch (e) {
    console.error("❌ Error in /export route:", e);
    res.status(500).json({ message: e.message || "Internal Server Error" });
  }
});


// CSV export
const { Parser } = require("@json2csv/plainjs");
router.get("/export.csv", async (_req, res) => {
  try {
    const sort = (await Simplification.exists({ createdAt: { $exists: true } })) ? { createdAt: -1 } : { _id: -1 };
    const docs = await Simplification.find({}).sort(sort).lean();
    const parser = new Parser();
    const csv = parser.parse(docs);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="simplifications.csv"');
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).send("failed");
  }
});

router.put("/save", async (req, res) => {
  try {
    const { email, inputText, finalText, readability, accuracy, comments } = req.body;

    if (!email || !inputText || !finalText) {
      return res.status(400).send({ message: "Missing required fields" });
    }

    const simplification = await Simplification.findOne({ email, inputText });

    if (!simplification) {
      return res.status(404).send({ message: "Simplification not found" });
    }

    // Count words and characters
    const numWords = finalText.trim().split(/\s+/).filter(Boolean).length;
    const numChars = finalText.length;

    // Save final submission to saveHistory
    simplification.saveHistory.push({
      finalText,
      timestamp: new Date(),
      numWords,
      numChars,
      surveyAnswers: { readability, accuracy, comments }
    });

    await simplification.save();
    res.status(200).send({
      message: "Final output saved successfully",
      data: simplification,
    });
  } catch (error) {
    console.error("Error saving final output:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});



router.post("/fetch", async (req, res) => {
  try {
    const { email, inputText } = req.body;

    if (!email || !inputText) {
      return res.status(400).send({ message: "Missing required fields" });
    }

    // Find the document by email and inputText
    const simplification = await Simplification.findOne({ email, inputText });

    if (!simplification) {
      return res.status(404).send({ message: "Simplification not found" });
    }

    // Find the latest `finalText` from `saveHistory`
    let latestFinalText = null;
    if (simplification.saveHistory && simplification.saveHistory.length > 0) {
      const latestSave = simplification.saveHistory.reduce((latest, current) => {
        return current.timestamp > latest.timestamp ? current : latest;
      }, simplification.saveHistory[0]);
      latestFinalText = latestSave.finalText;
    }

    res.status(200).json({
      data: {
        ...simplification.toObject(),
        latestFinalText, // Include the latest finalText
      },
    });
  } catch (error) {
    console.error("Error fetching simplification:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

router.get("/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const simplifications = await Simplification.find({ email }).sort({ createdAt: -1 });

    if (!simplifications.length) {
      return res.status(404).send({ message: "No simplifications found for this user" });
    }

    res.status(200).json({ data: simplifications });
  } catch (error) {
    console.error("Error fetching user's simplifications:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});


// GET route to fetch all simplifications for a user
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const simplifications = await Simplification.find({ userId }).sort({
      createdAt: -1,
    });

    res.status(200).send({ data: simplifications });
  } catch (error) {
    console.error("Error fetching simplifications:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});


module.exports = router;

// const router = require("express").Router();
// const Simplification = require("../models/simplification");
// const { User } = require("../models/user");

// // POST route to save a simplification
// router.post("/", async (req, res) => {
//   try {
//     const { userId, inputText, outputText, editedText } = req.body;

//     // Validate required fields
//     if (!userId || !inputText || !outputText) {
//       return res.status(400).send({ message: "Missing required fields" });
//     }

//     // Fetch the user's email from the users collection
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).send({ message: "User not found" });
//     }

//     // Save the simplification
//     const simplification = new Simplification({
//       userId,
//       email: user.email, // Use the email from the user document
//       inputText,
//       outputText,
//       editedText: "",
//     });

//     await simplification.save();
//     res.status(201).send({ message: "Simplification saved successfully", data: simplification });
//   } catch (error) {
//     console.error("Error saving simplification:", error);
//     res.status(500).send({ message: "Internal Server Error" });
//   }
// });

// // GET route to fetch all simplifications for a user
// router.get("/:userId", async (req, res) => {
//   try {
//     const { userId } = req.params;

//     // Fetch all simplifications for the given user
//     const simplifications = await Simplification.find({ userId }).sort({ createdAt: -1 });

//     res.status(200).send({ data: simplifications });
//   } catch (error) {
//     console.error("Error fetching simplifications:", error);
//     res.status(500).send({ message: "Internal Server Error" });
//   }
// });

// module.exports = router;

/* ------------------------------------------------------------------ */
/* read helpers remain unchanged ( /fetch , /user/:email … )          */
/* ------------------------------------------------------------------ */



// router.post("/", async (req, res) => {
//   try {
//     const { userId, inputText, outputText } = req.body;

//     if (!userId || !inputText || !outputText) {
//       return res.status(400).send({ message: "Missing required fields" });
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).send({ message: "User not found" });
//     }

//     const simplification = new Simplification({
//       userId,
//       email: user.email,
//       inputText,
//       outputText,
//     });

//     await simplification.save();
//     res.status(201).send({
//       message: "Simplification saved successfully",
//       data: simplification,
//     });
//   } catch (error) {
//     console.error("Error saving simplification:", error);
//     res.status(500).send({ message: "Internal Server Error" });
//   }
// });


// router.put("/edit", async (req, res) => {
//   try {
//     const { email, inputText, editedText } = req.body;

//     if (!email || !inputText || !editedText) {
//       return res.status(400).send({ message: "Missing required fields" });
//     }

//     const simplification = await Simplification.findOne({ email, inputText });

//     if (!simplification) {
//       return res.status(404).send({ message: "Simplification not found" });
//     }

//     // Count words and characters
//     const numWords = editedText.trim().split(/\s+/).filter(Boolean).length;
//     const numChars = editedText.length;

//     // Save edit to history
//     simplification.editHistory.push({
//       text: editedText,
//       timestamp: new Date(),
//       numWords,
//       numChars
//     });

//     await simplification.save();
//     res.status(200).send({
//       message: "Edit saved successfully",
//       data: simplification,
//     });
//   } catch (error) {
//     console.error("Error saving edit:", error);
//     res.status(500).send({ message: "Internal Server Error" });
//   }
// });
