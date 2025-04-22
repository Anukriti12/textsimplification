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

    // Check if a document with this inputText already exists for this user
    let simplification = await Simplification.findOne({
      userId,
      inputText
    });

    // const simplification = new Simplification({
    //   userId,
    //   email: user.email,
    //   inputText,
    //   outputText,
    // });

    if (simplification) {
      // If the document exists, update it instead of creating a new one
      simplification.outputText = outputText;
      simplification.metrics = {
        ...simplification.metrics,
        ...metrics
      };
    } else {
      // Create a new document if none exists
      simplification = new Simplification({
        userId,
        email: user.email,
        inputText,
        outputText,
        metrics
      });
    }

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


// router.put("/edit", async (req, res) => {
//   try {
//     const { email, inputText, editedText } = req.body;

//     if (!email || !inputText || !editedText) {
//       return res.status(400).send({ success: false, message: "Missing required fields" });
//     }

//     const simplification = await Simplification.findOne({ email, inputText });

//     if (!simplification) {
//       return res.status(404).send({success: false,  message: "Simplification not found" });
//     }

//     // Count words and characters
//     const numWords = editedText.trim().split(/\s+/).filter(Boolean).length;
//     const numChars = editedText.length;

//     // Save edit to history
//     // simplification.editHistory.push({
//     //   text: editedText,
//     //   timestamp: new Date(),
//     //   numWords,
//     //   numChars
//     // });

//      // Check if the edit already exists to avoid duplicates
//      const existingEditIndex = simplification.editHistory.findIndex(
//       edit => edit.text === editedText
//     );

//     if (existingEditIndex === -1) {
//       // Add new edit to history if it doesn't exist
//       simplification.editHistory.push({
//         text: editedText,
//         timestamp: new Date(),
//         numWords,
//         numChars
//       });
//     } else {
//       // Update timestamp if edit already exists
//       simplification.editHistory[existingEditIndex].timestamp = new Date();
//     }

//     await simplification.save();
//     res.status(200).send({
//       success: true,
//       message: "Edit saved successfully",
//       // data: simplification,
//       data: {
//         editCount: simplification.editHistory.length,
//         latestEdit: simplification.editHistory[simplification.editHistory.length - 1]
//       }
//     });
//   } catch (error) {
//     console.error("Error saving edit:", error);
//     res.status(500).send({success: false,  message: "Internal Server Error" });
//   }
// });

// router.put("/save", async (req, res) => {
//   try {
//     const { email, inputText, finalText, numWords, numChars, readability, accuracy, comments } = req.body;

//     if (!email || !inputText || !finalText) {
//       return res.status(400).send({success: false,  message: "Missing required fields" });
//     }

//     const simplification = await Simplification.findOne({ email, inputText });

//     if (!simplification) {
//       return res.status(404).send({success: false,  message: "Simplification not found" });
//     }

//     // Count words and characters
//     // const numWords = finalText.trim().split(/\s+/).filter(Boolean).length;
//     // const numChars = finalText.length;

//     const wordCount = numWords || finalText.trim().split(/\s+/).filter(Boolean).length;
//     const charCount = numChars || finalText.length;

//        // Check if the same finalText already exists to avoid duplicates
//        const existingSaveIndex = simplification.saveHistory.findIndex(
//         save => save.finalText === finalText
//       );
//     // Save final submission to saveHistory
//     // simplification.saveHistory.push({
//     //   finalText,
//     //   timestamp: new Date(),
//     //   numWords,
//     //   numChars,
//     //   surveyAnswers: { readability, accuracy, comments }
//     // });

//     if (existingSaveIndex === -1) {
//       // Add new save to history if it doesn't exist
//       simplification.saveHistory.push({
//         finalText,
//         timestamp: new Date(),
//         numWords: wordCount,
//         numChars: charCount,
//         surveyAnswers: {
//           readability: readability || null,
//           accuracy: accuracy || null,
//           comments: comments || null
//         }
//       });
//     } else {
//       // Update timestamp and survey answers if save already exists
//       const existingSave = simplification.saveHistory[existingSaveIndex];
//       existingSave.timestamp = new Date();
//       existingSave.surveyAnswers = {
//         readability: readability || existingSave.surveyAnswers.readability,
//         accuracy: accuracy || existingSave.surveyAnswers.accuracy,
//         comments: comments || existingSave.surveyAnswers.comments
//       };
//     }
//     await simplification.save();
//     res.status(200).send({
//       success: true,
//       message: "Final output saved successfully",
//       // data: simplification,
//       data: {
//         saveCount: simplification.saveHistory.length,
//         latestSave: simplification.saveHistory[simplification.saveHistory.length - 1]
//       }
//     });
//   } catch (error) {
//     console.error("Error saving final output:", error);
//     res.status(500).send({       success: false, 
//       message: "Internal Server Error" });
//   }
// });



// router.post("/fetch", async (req, res) => {
//   try {
//     const { email, inputText } = req.body;

//     if (!email || !inputText) {
//       return res.status(400).send({ message: "Missing required fields" });
//     }

//     // Find the document by email and inputText
//     const simplification = await Simplification.findOne({ email, inputText });

//     if (!simplification) {
//       return res.status(404).send({ message: "Simplification not found" });
//     }

//     // Get latest edit if available
//     let latestEditText = null;
//     if (simplification.editHistory && simplification.editHistory.length > 0) {
//       // Sort by timestamp to get the most recent edit
//       const sortedEdits = [...simplification.editHistory].sort(
//         (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
//       );
//       latestEditText = sortedEdits[0].text;
//     }

//     // Find the latest `finalText` from `saveHistory`
//     let latestFinalText = null;
//     if (simplification.saveHistory && simplification.saveHistory.length > 0) {

//       // Sort by timestamp to get the most recent save
//       const sortedSaves = [...simplification.saveHistory].sort(
//         (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
//       );
//       latestFinalText = sortedSaves[0].finalText;

//       // const latestSave = simplification.saveHistory.reduce((latest, current) => {
//       //   return current.timestamp > latest.timestamp ? current : latest;
//       // }, simplification.saveHistory[0]);
//       // latestFinalText = latestSave.finalText;
//     }

//     // res.status(200).json({
//     //   data: {
//     //     ...simplification.toObject(),
//     //     latestFinalText, // Include the latest finalText
//     //   },
//     // });

//     res.status(200).send({
//       success: true,
//       data: {
//         ...simplification.toObject(),
//         latestEditText,
//         latestFinalText
//       }
//     });
//   } catch (error) {
//     console.error("Error fetching simplification:", error);
//     res.status(500).send({ 
//       success: false, 
//       message: "Internal Server Error",
//       error: error.message 
//     });

//     // console.error("Error fetching simplification:", error);
//     // res.status(500).send({ message: "Internal Server Error" });
//   }
// });

// router.get("/user/:email", async (req, res) => {
//   try {
//     const { email } = req.params;
//     if (!email) {
//       return res.status(400).send({ message: "Email is required" });
//     }

//     const simplifications = await Simplification.find({ email }).sort({ createdAt: -1 });

//     // if (!simplifications.length) {
//     //   return res.status(404).send({ message: "No simplifications found for this user" });
//     // }
//     if (!simplifications.length) {
//       return res.status(200).send({ 
//         success: true, 
//         message: "No simplifications found for this user", 
//         data: [] 
//       });
//     }

//     // Process the documents to ensure we have unique entries
//     const uniqueDocMap = new Map();
    
//     simplifications.forEach(doc => {
//       // Use inputText as the key to identify unique documents
//       if (!uniqueDocMap.has(doc.inputText)) {
//         uniqueDocMap.set(doc.inputText, doc);
//       } else {
//         // If we already have this input text, merge the histories
//         const existingDoc = uniqueDocMap.get(doc.inputText);
        
//         // Merge edit histories
//         if (doc.editHistory && doc.editHistory.length > 0) {
//           if (!existingDoc.editHistory) existingDoc.editHistory = [];
//           existingDoc.editHistory = [...existingDoc.editHistory, ...doc.editHistory];
//         }
        
//         // Merge save histories
//         if (doc.saveHistory && doc.saveHistory.length > 0) {
//           if (!existingDoc.saveHistory) existingDoc.saveHistory = [];
//           existingDoc.saveHistory = [...existingDoc.saveHistory, ...doc.saveHistory];
//         }
        
//         // Keep the most recent document's metadata
//         if (new Date(doc.createdAt) > new Date(existingDoc.createdAt)) {
//           existingDoc.outputText = doc.outputText;
//           existingDoc.metrics = doc.metrics;
//           existingDoc.metadata = doc.metadata;
//         }
//       }

//     res.status(200).json({ data: simplifications });
//   } catch (error) {
//     console.error("Error fetching user's simplifications:", error);
//     res.status(500).send({ message: "Internal Server Error" });
//   }
// });
//     // Convert map to array
//     const uniqueDocs = Array.from(uniqueDocMap.values());
    
//     // Sort by most recent first
//     uniqueDocs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

//     res.status(200).send({ 
//       success: true, 
//       data: uniqueDocs 
//     });
//   } catch (error) {
//     console.error("Error fetching user's simplifications:", error);
//     res.status(500).send({ 
//       success: false, 
//       message: "Internal Server Error",
//       error: error.message 
//     });
//   }
// });


// // GET route to fetch all simplifications for a user
// // router.get("/:userId", async (req, res) => {
// //   try {
// //     const { userId } = req.params;

// //     const simplifications = await Simplification.find({ userId }).sort({
// //       createdAt: -1,
// //     });

// //     res.status(200).send({ data: simplifications });
// //   } catch (error) {
// //     console.error("Error fetching simplifications:", error);
// //     res.status(500).send({ message: "Internal Server Error" });
// //   }
// // });

// // Export all routes
// module.exports = router;
// const router = require("express").Router();
// const Simplification = require("../models/simplification");
// const { User } = require("../models/user");

// // Create or update a simplification - handles duplicates properly
// router.post("/", async (req, res) => {
//   try {
//     const { userId, inputText, outputText, metrics = {}, fileName, pageCount } = req.body;

//     if (!userId || !inputText || !outputText) {
//       return res.status(400).send({ 
//         success: false,
//         message: "Missing required fields" 
//       });
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).send({ 
//         success: false,
//         message: "User not found" 
//       });
//     }

//     // Check if a document with this inputText already exists for this user
//     let simplification = await Simplification.findOne({
//       userId,
//       inputText
//     });

//     if (simplification) {
//       // If the document exists, update it instead of creating a new one
//       simplification.outputText = outputText;
//       simplification.metrics = {
//         ...simplification.metrics,
//         ...metrics
//       };
      
//       // Update metadata if provided
//       if (fileName || pageCount) {
//         simplification.metadata = {
//           ...simplification.metadata,
//           fileName: fileName || simplification.metadata?.fileName,
//           pageCount: pageCount || simplification.metadata?.pageCount
//         };
//       }
      
//       console.log("Updating existing simplification:", simplification._id);
//     } else {
//       // Create a new document if none exists
//       simplification = new Simplification({
//         userId,
//         email: user.email,
//         inputText,
//         outputText,
//         metrics,
//         metadata: {
//           fileName: fileName || null,
//           pageCount: pageCount || null
//         }
//       });
//       console.log("Creating new simplification");
//     }

//     await simplification.save();
    
//     res.status(200).send({
//       success: true,
//       message: simplification._id ? "Simplification updated successfully" : "Simplification saved successfully",
//       data: simplification
//     });
//   } catch (error) {
//     console.error("Error saving simplification:", error);
    
//     // Handle duplicate key error with a friendly message
//     if (error.code === 11000) {
//       return res.status(409).send({ 
//         success: false,
//         message: "This text has already been simplified. The existing record has been updated." 
//       });
//     }
    
//     res.status(500).send({ 
//       success: false,
//       message: "Internal Server Error",
//       error: error.message 
//     });
//   }
// });
// Add or update edit for a simplification
router.put("/edit", async (req, res) => {
  try {
    const { email, inputText, editedText } = req.body;

    if (!email || !inputText || !editedText) {
      return res.status(400).send({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    // Find the simplification document
    const simplification = await Simplification.findOne({ email, inputText });

    if (!simplification) {
      return res.status(404).send({ 
        success: false, 
        message: "Simplification not found" 
      });
    }

    // Count words and characters
    const numWords = editedText.trim().split(/\s+/).filter(Boolean).length;
    const numChars = editedText.length;

    // Check if the edit already exists to avoid duplicates
    const existingEditIndex = simplification.editHistory.findIndex(
      edit => edit.text === editedText
    );

    if (existingEditIndex === -1) {
      // Add new edit to history if it doesn't exist
      simplification.editHistory.push({
        text: editedText,
        timestamp: new Date(),
        numWords,
        numChars
      });
    } else {
      // Update timestamp if edit already exists
      simplification.editHistory[existingEditIndex].timestamp = new Date();
    }

    await simplification.save();
    
    res.status(200).send({
      success: true,
      message: "Edit saved successfully",
      data: {
        editCount: simplification.editHistory.length,
        latestEdit: simplification.editHistory[simplification.editHistory.length - 1]
      }
    });
  } catch (error) {
    console.error("Error saving edit:", error);
    res.status(500).send({ 
      success: false, 
      message: "Internal Server Error",
      error: error.message 
    });
  }
});

// Save final version
router.put("/save", async (req, res) => {
  try {
    const { email, inputText, finalText, numWords, numChars, readability, accuracy, comments } = req.body;

    if (!email || !inputText || !finalText) {
      return res.status(400).send({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    const simplification = await Simplification.findOne({ email, inputText });

    if (!simplification) {
      return res.status(404).send({ 
        success: false, 
        message: "Simplification not found" 
      });
    }

    // Calculate metrics if not provided
    const wordCount = numWords || finalText.trim().split(/\s+/).filter(Boolean).length;
    const charCount = numChars || finalText.length;

    // Check if the same finalText already exists to avoid duplicates
    const existingSaveIndex = simplification.saveHistory.findIndex(
      save => save.finalText === finalText
    );

    if (existingSaveIndex === -1) {
      // Add new save to history if it doesn't exist
      simplification.saveHistory.push({
        finalText,
        timestamp: new Date(),
        numWords: wordCount,
        numChars: charCount,
        surveyAnswers: {
          readability: readability || null,
          accuracy: accuracy || null,
          comments: comments || null
        }
      });
    } else {
      // Update timestamp and survey answers if save already exists
      const existingSave = simplification.saveHistory[existingSaveIndex];
      existingSave.timestamp = new Date();
      existingSave.surveyAnswers = {
        readability: readability || existingSave.surveyAnswers.readability,
        accuracy: accuracy || existingSave.surveyAnswers.accuracy,
        comments: comments || existingSave.surveyAnswers.comments
      };
    }

    await simplification.save();
    
    res.status(200).send({
      success: true,
      message: "Final output saved successfully",
      data: {
        saveCount: simplification.saveHistory.length,
        latestSave: simplification.saveHistory[simplification.saveHistory.length - 1]
      }
    });
  } catch (error) {
    console.error("Error saving final output:", error);
    res.status(500).send({ 
      success: false, 
      message: "Internal Server Error",
      error: error.message 
    });
  }
});

// Fetch document data
router.post("/fetch", async (req, res) => {
  try {
    const { email, inputText } = req.body;

    if (!email || !inputText) {
      return res.status(400).send({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

    // Find the document by email and inputText
    const simplification = await Simplification.findOne({ email, inputText });

    if (!simplification) {
      return res.status(404).send({ 
        success: false, 
        message: "Simplification not found" 
      });
    }

    // Get latest edit if available
    let latestEditText = null;
    if (simplification.editHistory && simplification.editHistory.length > 0) {
      // Sort by timestamp to get the most recent edit
      const sortedEdits = [...simplification.editHistory].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      latestEditText = sortedEdits[0].text;
    }

    // Get latest final version if available
    let latestFinalText = null;
    if (simplification.saveHistory && simplification.saveHistory.length > 0) {
      // Sort by timestamp to get the most recent save
      const sortedSaves = [...simplification.saveHistory].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      latestFinalText = sortedSaves[0].finalText;
    }

    res.status(200).send({
      success: true,
      data: {
        ...simplification.toObject(),
        latestEditText,
        latestFinalText
      }
    });
  } catch (error) {
    console.error("Error fetching simplification:", error);
    res.status(500).send({ 
      success: false, 
      message: "Internal Server Error",
      error: error.message 
    });
  }
});

// Get all documents for a user with deduplication
router.get("/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).send({ 
        success: false, 
        message: "Email is required" 
      });
    }

    // Find all documents for this user
    const simplifications = await Simplification.find({ email }).sort({ createdAt: -1 });

    if (!simplifications.length) {
      return res.status(200).send({ 
        success: true, 
        message: "No simplifications found for this user", 
        data: [] 
      });
    }

    // Process the documents to ensure we have unique entries
    const uniqueDocMap = new Map();
    
    simplifications.forEach(doc => {
      // Use inputText as the key to identify unique documents
      if (!uniqueDocMap.has(doc.inputText)) {
        uniqueDocMap.set(doc.inputText, doc);
      } else {
        // If we already have this input text, merge the histories
        const existingDoc = uniqueDocMap.get(doc.inputText);
        
        // Merge edit histories
        if (doc.editHistory && doc.editHistory.length > 0) {
          if (!existingDoc.editHistory) existingDoc.editHistory = [];
          existingDoc.editHistory = [...existingDoc.editHistory, ...doc.editHistory];
        }
        
        // Merge save histories
        if (doc.saveHistory && doc.saveHistory.length > 0) {
          if (!existingDoc.saveHistory) existingDoc.saveHistory = [];
          existingDoc.saveHistory = [...existingDoc.saveHistory, ...doc.saveHistory];
        }
        
        // Keep the most recent document's metadata
        if (new Date(doc.createdAt) > new Date(existingDoc.createdAt)) {
          existingDoc.outputText = doc.outputText;
          existingDoc.metrics = doc.metrics;
          existingDoc.metadata = doc.metadata;
        }
      }
    });
    
    // Convert map to array
    const uniqueDocs = Array.from(uniqueDocMap.values());
    
    // Sort by most recent first
    uniqueDocs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).send({ 
      success: true, 
      data: uniqueDocs 
    });
  } catch (error) {
    console.error("Error fetching user's simplifications:", error);
    res.status(500).send({ 
      success: false, 
      message: "Internal Server Error",
      error: error.message 
    });
  }
});

// Export all routes
module.exports = router;const router = require("express").Router();
const Simplification = require("../models/simplification");
const { User } = require("../models/user");

// Create or update a simplification - handles duplicates properly
router.post("/", async (req, res) => {
  try {
    const { userId, inputText, outputText, metrics = {}, fileName, pageCount } = req.body;

    if (!userId || !inputText || !outputText) {
      return res.status(400).send({ 
        success: false,
        message: "Missing required fields" 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ 
        success: false,
        message: "User not found" 
      });
    }

    // Check if a document with this inputText already exists for this user
    let simplification = await Simplification.findOne({
      userId,
      inputText
    });

    if (simplification) {
      // If the document exists, update it instead of creating a new one
      simplification.outputText = outputText;
      simplification.metrics = {
        ...simplification.metrics,
        ...metrics
      };
      
      // Update metadata if provided
      if (fileName || pageCount) {
        simplification.metadata = {
          ...simplification.metadata,
          fileName: fileName || simplification.metadata?.fileName,
          pageCount: pageCount || simplification.metadata?.pageCount
        };
      }
      
      console.log("Updating existing simplification:", simplification._id);
    } else {
      // Create a new document if none exists
      simplification = new Simplification({
        userId,
        email: user.email,
        inputText,
        outputText,
        metrics,
        metadata: {
          fileName: fileName || null,
          pageCount: pageCount || null
        }
      });
      console.log("Creating new simplification");
    }

    await simplification.save();
    
    res.status(200).send({
      success: true,
      message: simplification._id ? "Simplification updated successfully" : "Simplification saved successfully",
      data: simplification
    });
  } catch (error) {
    console.error("Error saving simplification:", error);
    
    // Handle duplicate key error with a friendly message
    if (error.code === 11000) {
      return res.status(409).send({ 
        success: false,
        message: "This text has already been simplified. The existing record has been updated." 
      });
    }
    
    res.status(500).send({ 
      success: false,
      message: "Internal Server Error",
      error: error.message 
    });
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