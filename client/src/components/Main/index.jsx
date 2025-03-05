import { useState } from "react";
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
 

	// Function to format the prompt with user input
const generatePrompt = (inputText) => {
	return `
	You are an expert in accessible communication, tasked with simplifying a given text for individuals with intellectual and developmental disabilities (IDD). 
	
	Please do not summarize or reduce the length of output content. Instead, simplify the text preserving the intended meaning or information. The output length should be similar to the input length.
	
	Follow these detailed guidelines to ensure the text is clear, easy to understand, and accessible:
  
	1. Sentence and Structure Simplification
	- Use short sentences (8-10 words max).
	- Keep one main idea per sentence to avoid confusion.
	- Write in active voice (e.g., "A doctor gives medicine" instead of "Medicine is given by a doctor").
	- Avoid bulleted lists. Instead, write short, direct sentences in paragraph form.
	- Repeat important words instead of using synonyms to improve comprehension.
	- Start a new paragraph when introducing a different idea.
  
	2. Word Choice and Vocabulary
	- Replace complex words with simple, common words (words most people know and use every day).
	- Use words with few syllables (e.g., "help" instead of "assist").
	- Avoid figurative language (no metaphors, similes, or idioms).
	  - ❌ "It’s a piece of cake."  
	  - ✅ "It is easy to do."  
	- If a difficult word is necessary, provide a simple definition within the text.
	- Avoid negatives when possible (e.g., instead of "Do not touch," say "Keep hands away").
  
	3. Text Organization
	If necessary,
	- Use headings that are short and direct (max 8 words). Example:
	  - ❌ "Understanding the Difference Between the Flu and COVID-19"  
	  - ✅ "Flu vs. COVID-19"  
	- Keep paragraphs short.
  
	4. Formatting for Readability
	- Use left-aligned text with wide spacing between lines.
	- Ensure the text is high contrast (black text on a white background).
	- Avoid italics, underlining, or all caps, as they can be hard to read.
  
	5. Instructions and Steps
	- If the text includes instructions, keep steps short and clear.
	- Example:
	  - ❌ "First, you will need to open the box carefully and remove the contents before proceeding to step two, which involves assembling the parts."  
	  - ✅ "Step 1: Open the box.  
		 Step 2: Take out the parts."  
  
	6. Retaining Meaning and Key Details
	- Do not remove important information, but explain it in a simpler way.
	- Ensure the simplified version does not change the facts.
	- The output should remain accurate, informative, and accessible.

	7. Do not simplify unnecessarily and the output should contain only the simplified text, nothing else.
  
	Now, simplify the following text line-by-line according to these guidelines:
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