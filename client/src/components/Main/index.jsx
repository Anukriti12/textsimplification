import React, { useState, useEffect, useRef  } from "react";
import styles from "./styles.module.css";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
// import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";


pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.mjs`;

const Main = () => {

	const [inputText, setInputText] = useState("");
	const [outputText, setOutputText] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [isEditable, setIsEditable] = useState(false); // For toggling edit mode
	const [uploadedFileName, setUploadedFileName] = useState(""); // State for file name
	const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);
	const [showSurveyPrompt, setShowSurveyPrompt] = useState(false); // State for survey prompt
	const navigate = useNavigate();
	const [isUploading, setIsUploading] = useState(false); // State for showing buffer

	const [inputWordCount, setInputWordCount] = useState(0);
	const [inputCharCount, setInputCharCount] = useState(0);
	const [pdfPageCount, setPdfPageCount] = useState(0);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/Login"); 
  };


  	const handleFileUpload = async (event) => {
	  const file = event.target.files[0];
	  if (!file) return;
  
	  setIsUploading(true); // Show buffer while processing
	  setUploadedFileName(file.name); // Set file name

	  try {
		//setUploadedFileName(file.name); // Set the uploaded file name
		const fileReader = new FileReader();
		fileReader.onload = async function () {
		  const typedArray = new Uint8Array(this.result);
  
		  const pdf = await pdfjsLib.getDocument(typedArray).promise;

		  setPdfPageCount(pdf.numPages);

		  let text = "";
  
		  // Extract text from all pages
		  for (let i = 1; i <= pdf.numPages; i++) {
			const page = await pdf.getPage(i);
			const textContent = await page.getTextContent();
			text += textContent.items.map((item) => item.str).join(" ");
		  }
  
		  setInputText(text);
		};
		fileReader.readAsArrayBuffer(file);
	  } catch (error) {
		console.error("Error reading PDF:", error);
		alert("Failed to extract text from the PDF.");
	  } finally {
		setIsUploading(false); // Hide buffer once done
	  }
	};
 
	const countWordsAndChars = (text) => {
		const words = text.trim().split(/\s+/).filter(Boolean).length;
		const chars = text.length;
		return { words, chars };
	  };
	  
	    useEffect(() => {
		  const { words: inputWords, chars: inputChars } = countWordsAndChars(inputText);

		  setInputWordCount(inputWords);
		  setInputCharCount(inputChars);

		}, [inputText]);
	  
		

	// Function to format the prompt with user input
const generatePrompt = (inputText) => {
	return `
	You are an expert in accessible communication, tasked with transforming complex text into clear, accessible plain language for individuals with Intellectual and Developmental Disabilities (IDD) or those requiring simplified content. Retain all essential information and intent while prioritizing readability, comprehension, and inclusivity.

	Text simplification refers to rewriting or adapting text to make it easier to read and understand while keeping the same level of detail and precision. Make sure you focus on simplification and not summarization. The length of generated output text must be similar to that of input text.

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


  const handleSubmit = async () => {
	if (!inputText.trim()) return;
	setIsLoading(true);
  
	try {
	  const chunks = splitTextIntoChunks(inputText, 1000);
	  let combinedOutput = "";
  
	  for (let chunk of chunks) {
		const prompt = generatePrompt(chunk);
		const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/gpt4", {
		  method: "POST",
		  headers: { "Content-Type": "application/json" },
		  body: JSON.stringify({ prompt }),
		});
		
		if (!response.ok) {
			console.error(`API request failed with status: ${response.status}`);
			continue; // Skip this chunk if the API request failed
		  }

		const data = await response.json();
		console.log("Full API Response: ", data);


		const data1 = data?.response?.replace(/^"|"$/g, "") || "No response received."; // Append results
		combinedOutput += data1 + " ";
	}
	  console.log("Final Combined Output: ", combinedOutput);

	console.log("Data: ", combinedOutput);
	const cleanedResponse = combinedOutput.trim();
	  setOutputText(cleanedResponse);
	  setIsSubmitted(true);
	  navigate("/review", { state: { inputText, outputText: cleanedResponse } });
	
	} catch (error) {
	  console.error("Error fetching GPT-4o response:", error);
	  setOutputText("An error occurred while simplifying the text.");
	}
  
	setIsLoading(false);
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

	  <div className={styles.main_container}>
	
			<div className={styles.description}>
			  <p>
			  This tool helps make complex text easier to read while preserving its original meaning. Whether you're simplifying academic content, technical documents, or general text for better accessibility, this tool provides a quick and efficient way to generate a more readable version. You can enter text manually or upload a document to get started.
			  </p>
  
			  <div className={styles.form_container}>
				{/* Input Area */}
				<div className={styles.input_area}>
				  <div className={styles.text_container}>
					<label className={styles.label} htmlFor="inputText">
					  Input Text
					</label>
					<textarea
					  id="inputText"
					  className={`${styles.textarea} ${isLoading ? styles.disabled : ""}`}
					//   className={styles.textarea}
					  placeholder="Write/Paste your text here or upload a PDF document to extract content automatically."
					  value={inputText}
					  onChange={(e) => setInputText(e.target.value)}
					  disabled={isLoading} // Disable input when loading
					></textarea>
				 
				 <p className={styles.countText}>Words: {inputWordCount} | Characters: {inputCharCount}
				 {pdfPageCount > 0 && ` | Pages: ${pdfPageCount}`}
				 </p>
					
				  </div>
  
				  {/* OR Divider */}
				  <div className={styles.or_divider}>OR</div>
  
				  {/* File Upload */}
				  <div className={`${styles.upload_area} ${isLoading ? styles.disabled : ""}`}
					onDragOver={(e) => e.preventDefault()} // Prevent default behavior
					onDrop={(e) => {
						e.preventDefault();
						const file = e.dataTransfer.files[0]; // Get the first dropped file
						if (file) {
						handleFileUpload({ target: { files: [file] } }); // Simulate file selection event
						}
					}}>
					<label htmlFor="fileUpload" className={styles.upload_box}>
						
						{isUploading ? (
							<span className={styles.loadingText}>Extracting text, please wait...</span>
							) : uploadedFileName ? (
							<>
								File uploaded: <strong>{uploadedFileName}</strong>
							</>
							) : (
							<>
								Click to Upload a PDF
								<br />
								<span>...or drag and drop a file.</span>
							</>
						)}
			
					</label>
					<input
					  type="file"
					  id="fileUpload"
					  accept="application/pdf"
					  onChange={handleFileUpload}
					  className={styles.hidden_input}
					  disabled={isUploading || isLoading} // Disable upload while processing
					  //disabled={isUploading} // Disable upload while processing
					/>
				  </div>
				</div>
			  </div>
			  {/* Submit Button */}
			  <button
				className={styles.submit_btn}
				onClick={handleSubmit}
				disabled={!inputText.trim() || isLoading || isUploading}
				//title={!inputText.trim() ? "Enter text or upload a file to enable simplification." : ""}
			  >
				{isLoading ? "Processing..." : "Simplify Text"}
			  </button>
	
			  <p className={styles.help_text}>Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a></p>

        </div>
      </div>
    </>
  );
};

export default Main;