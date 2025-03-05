import React, { useState, useEffect, useRef  } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DiffMatchPatch from "diff-match-patch";
import { FaRegCopy, FaDownload } from "react-icons/fa"; // Import FontAwesome icons
import { saveAs } from "file-saver";
import styles from "./styles.module.css";

const Review = () => {


  const { state } = useLocation();
  const { inputText, outputText: initialOutputText, editHistory: restoredEditHistory } = state || {
    inputText: "",
    outputText: "",
    editHistory: [],
  };

  const [outputText, setOutputText] = useState(initialOutputText);
  const [editHistory, setEditHistory] = useState(restoredEditHistory || []);
  const [saveHistory, setSaveHistory] = useState([]);


  const [diffHtml, setDiffHtml] = useState("");
  const [isSaveButtonEnabled, setIsSaveButtonEnabled] = useState(false);
  const navigate = useNavigate();


  const [isEditable, setIsEditable] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showDifference, setShowDifference] = useState(false);

  const [inputWordCount, setInputWordCount] = useState(0);
  const [inputCharCount, setInputCharCount] = useState(0);

  const [outputWordCount, setOutputWordCount] = useState(0);
  const [outputCharCount, setOutputCharCount] = useState(0);



//   const navigate = useNavigate();


  const [isHistoryVisible, setIsHistoryVisible] = useState(false); // Show/Hide history sidebar
  const contentEditableRef = useRef(null); // Reference to the contentEditable div

	const [isLoading, setIsLoading] = useState(false);

	const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);
	const [showSurveyPrompt, setShowSurveyPrompt] = useState(false); // State for survey prompt

    const handleLogout = () => {
    localStorage.removeItem("token");
	navigate("/Login"); 

  localStorage.removeItem("reviewPageState"); // Clear the saved state

   // window.location.reload();
  };

  const countWordsAndChars = (text) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    return { words, chars };
  };
  
	// Function to format the prompt with user input
  const generatePrompt = (inputText) => {
    return `
    You are an expert in accessible communication, tasked with transforming complex text into clear, accessible plain language for individuals with Intellectual and Developmental Disabilities (IDD) or those requiring simplified content. Retain all essential information and intent while prioritizing readability, comprehension, and inclusivity.

    Guidelines for Simplification:
    Vocabulary and Terminology:
    Replace uncommon, technical, or abstract words with simple, everyday language.
    Define unavoidable complex terms in plain language within parentheses upon first use (example: “cardiologist (heart doctor)”).
    Avoid idioms, metaphors, sarcasm, or culturally specific references.

    Sentence Structure:
    Use short sentences (10--15 words max). Break long sentences into 1–2 ideas each.
    Prefer active voice (example: “The doctor examined the patient” vs. “The patient was examined by the doctor”).
    Avoid nested clauses, passive voice, and ambiguous pronouns (example: “they,” “it”).

    Clarity and Flow:
    Organize content logically, using headings/subheadings to group related ideas.
    Use bullet points or numbered lists for steps, options, or key points.
    Ensure each paragraph focuses on one main idea.

    Tone and Engagement:
    Write in a neutral, conversational tone (avoid formal or academic language).
    Address the reader directly with “you” or “we” where appropriate.
    Use consistent terms for concepts (avoid synonyms that may confuse).

    Avoid Exclusionary Elements:
    Remove jargon, acronyms (unless defined), and expand abbreviations if needed (example: “ASAP” → “as soon as possible”).
    Eliminate metaphors, idioms, or implied meanings (example: “hit the books” → “study”).
    Avoid double negatives (example: “not uncommon” → “common”).

    Structural Support:
    Add clear headings to label sections (example: “How to Apply for Benefits”).
    Use formatting tools like bold for key terms or warnings.
    Chunk information into short paragraphs with line breaks for visual ease.

    Inclusivity Checks:
    Ensure content is free of bias, stereotypes, or assumptions about the reader.
    Use gender-neutral language (example: “they” instead of “he/she”).


    Output Requirements:
    Return only the simplified text, without markdown, emojis, or images.
    Preserve original context, facts, and intent. Do not omit critical details.
    Prioritize clarity over brevity; focus on simplification and not summarization. The length of generated output text should be same or similar to that of input text.
    Do not simplify already simple text.

    Example Transformation:
    Original: “Individuals experiencing adverse climatic conditions may necessitate relocation to mitigate health risks.”
    Simplified: “If weather conditions become dangerous, people might need to move to stay safe.”

    For the provided input text, apply the above guidelines rigorously. Ensure the output is accessible to readers with varied cognitive abilities, emphasizing clarity, simplicity, and logical structure. Verify that the simplified text aligns with plain language standards like WCAG and PlainLanguage.gov.

    "${inputText}"
    `;
    };
  
    const splitTextIntoChunks = (text, maxTokens) => {
    const words = text.split(" ");
    let chunks = [];
    let currentChunk = [];
    
    for (let word of words) {
      if (currentChunk.join(" ").length + word.length < maxTokens) {
      currentChunk.push(word);
      } else {
      chunks.push(currentChunk.join(" "));
      currentChunk = [word];
      }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));
    return chunks;
    };

  const saveSimplification = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) return;


    const numWordsInput = inputText.trim().split(/\s+/).filter(Boolean).length;
    const numCharsInput = inputText.length;
    const numWordsOutput = outputText.trim().split(/\s+/).filter(Boolean).length;
    const numCharsOutput = outputText.length;

      const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user._id,
          inputText,
          outputText,
          metrics: { numWordsInput, numCharsInput, numWordsOutput, numCharsOutput }

        }),
      });

      if (response.ok) {
        console.log("Simplification saved successfully.");
        
      } else {
        const error = await response.json();
        console.error("Error saving simplification:", error.message);
      }
    } catch (error) {
      console.error("Error saving simplification:", error);
    }
  };

  const handleResimplify = async () => {
    if (!inputText.trim()) return;
  
    setIsLoading(true); // Show loading state
  
    try {

      const chunks = splitTextIntoChunks(inputText, 30000);
      let combinedOutput = "";
    
      for (let chunk of chunks) {
      const prompt = generatePrompt(chunk);
      const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/gpt4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      
  
      if (!response.ok) {
        console.error("Error with API request:", response.status);
        return;
      }
  
      const data = await response.json();
      console.log("Full API Response: ", data);
      const newOutput = data?.response?.replace(/^"|"$/g, "") || "No response received.";
  
      // Update System-generated Text
      combinedOutput += newOutput + " ";
      console.log("Final Combined Output: ", combinedOutput);
    
      }
      setOutputText(combinedOutput);
    } catch (error) {
      console.error("Error fetching GPT-4o response:", error);
      setOutputText("An error occurred while simplifying the text.");
    }
  
    setIsLoading(false);
  };


  
  //
  const saveEditToHistory = async (editedText) => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) return;

      const numWords = editedText.trim().split(/\s+/).filter(Boolean).length;
      const numChars = editedText.length;

      const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications/edit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          inputText,
          editedText,
          numWords,
          numChars
        }),
      });

      if (response.ok) {
        console.log("Edit saved to history.");
      } else {
        const error = await response.json();
        console.error("Error saving edit to history:", error.message);
      }
    } catch (error) {
      console.error("Error saving edit to history:", error);
    }
  };

  const saveFinalOutput = async () => {
    setIsLoading(true);

    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) return;

      const numWords = outputText.trim().split(/\s+/).filter(Boolean).length;
      const numChars = outputText.length;

      const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications/save", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          inputText,
          finalText: outputText,
          numWords,
          numChars,
          readability: 4, // Example value, replace with user input
          accuracy: 5, // Example value, replace with user input
          comments: "Looks good." // Example value, replace with user input
        }),
      });

    const timestamp = new Date().toISOString();
    setEditHistory((prev) => [
      ...prev,
      { timestamp, text: outputText },
    ]);

      if (response.ok) {
        console.log("Final output saved successfully.");
        setIsSaveButtonEnabled(false); // Disable save button
        setShowSurveyPrompt(true);    // Ensure survey prompt is displayed

        const timestamp = new Date().toISOString();
        setSaveHistory((prev) => [...prev, { timestamp, finalText: outputText }]); // 🔹 Save to history
  
      } else {
        const error = await response.json();
        console.error("Error saving final output:", error.message);
      }
    } catch (error) {
      console.error("Error saving final output:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditChange = (event) => {
    const updatedText = event.target.value;
    setOutputText(updatedText);
    setIsSaveButtonEnabled(true); // Enable save button on edit

    // const timestamp = new Date().toISOString();
    // setEditHistory((prev) => [
    //   ...prev,
    //   { timestamp, text: updatedText },
    // ]);

    // Save the change to edit history in MongoDB
    saveEditToHistory(updatedText);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        alert("Copied to clipboard!");
      },
      (err) => {
        console.error("Failed to copy text:", err);
      }
    );
  };

  const handleDownload = (text, filename, format) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `${filename}.${format}`);
  };

  useEffect(() => {
    const reviewPageState = {
      inputText,
      outputText,
      editHistory,
    };
    localStorage.setItem("reviewPageState", JSON.stringify(reviewPageState));
  }, [outputText, editHistory, inputText]);
  
  useEffect(() => {
    const savedState = JSON.parse(localStorage.getItem("reviewPageState"));
    if (savedState) {
      setOutputText(savedState.outputText || "");
      setEditHistory(savedState.editHistory || []);
    } else {
      setOutputText(initialOutputText);
      setEditHistory(restoredEditHistory || []);
    }
  
   saveSimplification(); // Save the initial inputText and outputText
    setIsSaveButtonEnabled(true);
  }, [initialOutputText, restoredEditHistory]);
  
  
  // useEffect(() => {
  //   // Save initial input and output text in MongoDB
  //   saveSimplification();
  // }, []);
  useEffect(() => {
    const diffResult = generateDiff(inputText, outputText);
    setDiffHtml(diffResult);
   // saveSimplification();
  }, [inputText, outputText]);

  useEffect(() => {
    saveSimplification(); 
    setIsSaveButtonEnabled(true);

    const savedState = JSON.parse(localStorage.getItem("reviewPageState"));
    if (savedState) {
      setOutputText(savedState.outputText || "");
      setEditHistory(savedState.editHistory || []);
    }
  }, []);
  
  useEffect(() => {
    const { words: inputWords, chars: inputChars } = countWordsAndChars(inputText);
    const { words: outputWords, chars: outputChars } = countWordsAndChars(outputText);
  
    setInputWordCount(inputWords);
    setInputCharCount(inputChars);
    setOutputWordCount(outputWords);
    setOutputCharCount(outputChars);
  }, [inputText, outputText]);

  
  const handleHistoryClick = (edit) => {
    setOutputText(edit.text);
    const diffResult = generateDiff(inputText, edit.text);
    setDiffHtml(diffResult);
    setIsEditable(false);
  };

    // Function to calculate and render diff
  const generateDiff = (input, output) => {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(input, output);
    dmp.diff_cleanupSemantic(diffs); // Optional cleanup for better readability
    return dmp.diff_prettyHtml(diffs);
  };

  return (
    <>
      <nav className={styles.navbar}>
        {/* <h1>Text Simplification Tool</h1> */}
        <h1 
    onClick={() => window.location.href = "https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/"}
    style={{ cursor: "pointer" }} // Makes it look clickable
 		>
		Text Simplification Tool</h1>
        <button className={styles.white_btn} onClick={handleLogout}>
          Logout
        </button>
      </nav>

      <div className={styles.container}>
        {/* Sidebar */}
        <div
          className={`${styles.sidebar} ${
            isSidebarVisible ? styles.expanded : ""
          }`}
        >
          <button
            className={styles.historyIcon}
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
          >
             🕒   <p style={{ fontSize: "15px" }}> History </p> {/* History Icon */}
          </button>
          {isSidebarVisible && (
            <div className={styles.historyContent}>
              <button
                className={styles.closeButton}
                onClick={() => setIsSidebarVisible(false)}
              >
               ✖
              </button>
              {/* <h3>History</h3> */}
              <ul className={styles.historyList}>
                {editHistory.map((edit, index) => (
                  <li
                    key={index}
                    className={styles.historyItem}
                    onClick={() => handleHistoryClick(edit)}
                  >
                    {edit.timestamp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div
          className={`${styles.mainContent} ${
            isSidebarVisible ? styles.withSidebar : ""
          }`}
        >
			<div className={styles.description}>
			<p>
	
        Please review the simplified text carefully and make any edits as needed to suit your requirements. Once you are satisfied with your revisions, submit the final version and complete the short survey to provide your feedback.
      </p>
			</div>

			<div className={styles.textareas_container}>

  {/* Input Text */}
  <div className={styles.text_container}>
    <div className={styles.labelWrapper}>
      <label className={styles.label} htmlFor="inputText">
        Input Text
      </label>
      <div className={styles.actions}>
      <div
        className={styles.copyIcon}
        onClick={() => handleCopy(inputText)}
        title="Copy to Clipboard"
      >
        
        📋 {/* Clipboard Emoji */}
        </div>

        <div
        className={styles.copyIcon}
        onClick={() => handleDownload(inputText, "InputText", "txt")}
        title="Download as .txt file"
      >
        📥 {/* Download Icon */}
      </div>

            {/* New Re-simplify Button */}
      <div
        className={styles.copyIcon}
        onClick={handleResimplify}
        title="Re-simplify Text"
        style={{ cursor: "pointer" }}
      >
        🔄 {/* Re-simplify Icon */}
      </div>

      </div>
    </div>
    <p className={styles.countText}>Words: {inputWordCount} | Characters: {inputCharCount}</p>

    <textarea
      id="inputText"
      className={`${styles.textarea} ${styles.side_by_side}`}
      value={inputText}
      readOnly
    ></textarea>
  </div>

			{/* Output Text Box */}
<div className={styles.text_container}>
  <div className={styles.labelWrapper}>
    <label className={styles.label} htmlFor="outputText">
      System-generated Text
    </label>
    <div className={styles.actions}>
      <div
        className={styles.copyIcon}
        onClick={() => handleCopy(outputText)}
        title="Copy to Clipboard"
      >
        📋 {/* Clipboard Emoji */}
      </div>

      <div
        className={styles.copyIcon}
        onClick={() => handleDownload(outputText, "GeneratedText", "txt")}
        title="Download as .txt file"
      >
        📥 {/* Download Icon */}
      </div>
      <button
        className={styles.toggleDiffBtn}
        onClick={() => setShowDifference(!showDifference)}
      >
        {showDifference ? "Hide Difference with input text" : "Show Difference with input text"}
      </button>
    </div>
  </div>
    {/* Word and Character Count */}
    <p className={styles.countText}>Words: {outputWordCount} | Characters: {outputCharCount}</p>

  <textarea
    id="outputText"
    className={`${styles.output_box} ${styles.side_by_side}`}
    value={outputText}
    onChange={handleEditChange}
    readOnly={isEditable}
    placeholder="Output"

  ></textarea>
</div>

            {/* Difference Text */}
			{showDifference && (
				<div className={styles.text_container}>
           <div className={styles.labelWrapper}>
				<label className={styles.label} htmlFor="outputText">
					Difference from input text
				</label>
        </div>   
         
					<div
					id="diffText"
					className={`${styles.output_box} ${styles.side_by_side}`}
					dangerouslySetInnerHTML={{ __html: diffHtml }}
					></div>
				 {/* )} */}
				</div>
			)}
			
			</div>



          {/* Buttons */}
			<div className={styles.button_container}>

    
    				{/* <button
    					className={`${styles.save_btn} ${styles.text_btn}`}
              onClick={saveFinalOutput}
              disabled={!isSaveButtonEnabled || isLoading}
              title={!isSaveButtonEnabled ? "Please make an edit before submitting." : ""}

    				>
    					Submit
    				</button> */}

            <button
            className={styles.submit_btn}
            onClick={saveFinalOutput}
            disabled={!isSaveButtonEnabled || isLoading}
            title={!isSaveButtonEnabled ? "Please make an edit before submitting." : ""}
            >
            Submit
            </button>
      </div>

  {/* Survey Prompt (Appears Only After Submitting) */}
  {showSurveyPrompt && (
    <div className={styles.survey_prompt}>
      <p className={styles.survey_text}>
        Please take the survey to help us improve.
        <button
          className={styles.survey_btn}
          onClick={() => {
            const reviewPageState = { inputText, outputText, editHistory, saveHistory };
            localStorage.setItem("reviewPageState", JSON.stringify(reviewPageState));
            navigate("/survey", {
              state: {
                email: JSON.parse(localStorage.getItem("user")).email,
                inputText,
                outputText,
                editHistory,
                saveHistory,
              },
            });
          }}
        >
          📑 Take the Survey
        </button>
      </p>
    </div>
  )}

<p className={styles.help_text}>Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a></p>




        </div>
      </div>
    </>
  );
};

export default Review;