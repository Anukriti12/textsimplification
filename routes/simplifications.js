const router = require("express").Router();
const Simplification = require("../models/simplification");
const { User } = require("../models/user");


router.post("/", async (req, res) => {
  try {
    const { userId, inputText, outputText } = req.body;

    if (!userId || !inputText || !outputText) {
      return res.status(400).send({ message: "Missing required fields" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const simplification = new Simplification({
      userId,
      email: user.email,
      inputText,
      outputText,
    });

    await simplification.save();
    res.status(201).send({
      message: "Simplification saved successfully",
      data: simplification,
    });
  } catch (error) {
    console.error("Error saving simplification:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});


router.put("/edit", async (req, res) => {
  try {
    const { email, inputText, editedText } = req.body;

    if (!email || !inputText || !editedText) {
      return res.status(400).send({ message: "Missing required fields" });
    }

    const simplification = await Simplification.findOne({ email, inputText });

    if (!simplification) {
      return res.status(404).send({ message: "Simplification not found" });
    }

    // Count words and characters
    const numWords = editedText.trim().split(/\s+/).filter(Boolean).length;
    const numChars = editedText.length;

    // Save edit to history
    simplification.editHistory.push({
      text: editedText,
      timestamp: new Date(),
      numWords,
      numChars
    });

    await simplification.save();
    res.status(200).send({
      message: "Edit saved successfully",
      data: simplification,
    });
  } catch (error) {
    console.error("Error saving edit:", error);
    res.status(500).send({ message: "Internal Server Error" });
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