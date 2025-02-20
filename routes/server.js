const express = require("express");
const router =  express.Router();

const cors = require("cors");
const OpenAI = require("openai");

// const app = express();
// app.use(cors());
// app.use(express.json());

require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, 
});


router.post("/", async (req, res) => {
    console.log("Request received:", req.body);
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06", // Use GPT-4o model
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      max_tokens: 200, // Limit response length
    });
    console.log("Full API Response:", response);
    if (response.choices && response.choices.length > 0) {
        const content = response.choices[0].message.content.trim();
        res.json({ response: content });
      } else {
        console.error("Unexpected API response structure:", response);
        res.status(500).json({ error: "Unexpected API response format." });
      }
    } catch (error) {
      console.error("Error calling OpenAI API:", error.response?.data || error.message);
      res.status(500).json({ error: "Error processing the request" });
    }

});

module.exports = router;

// Start the server
// const PORT = process.env.PORT || 5001;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));