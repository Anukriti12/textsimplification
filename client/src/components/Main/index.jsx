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
 
  	const handleSubmit = async () => {
	  if (!inputText.trim()) return;
	  setIsLoading(true);
  
	  try {
		const prompt = `Simplify the following text for better readability while preserving meaning:\n\n"${inputText}"`;
  
		const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/gpt4", {
		  method: "POST",
		  headers: { "Content-Type": "application/json" },
		  body: JSON.stringify({ prompt }),
		});
  
		const data = await response.json();
		const cleanedResponse =
		  data?.response?.replace(/^"|"$/g, "") || "No response received.";
		setOutputText(cleanedResponse);
		setIsSubmitted(true);
		navigate("/review", { state: { inputText, outputText: cleanedResponse } });

		// navigate("/simplify");
	  } catch (error) {
		console.error("Error fetching GPT-4 response:", error);
		setOutputText("An error occurred while fetching the response.");
	  }
  
	  setIsLoading(false);
	};

  return (
    <>
      <nav className={styles.navbar}>
        <h1>Text Simplification Tool</h1>
        <button className={styles.white_btn} onClick={handleLogout}>
          Logout
        </button>
      </nav>

	  <div className={styles.main_container}>
	
			<div className={styles.description}>
			  <p>
				This app is about simplifying text for improved readability and
				accessibility.
			  </p>
			  <p>
				Upload a document or paste your text to get a simplified version
				with just a click.
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
					  className={styles.textarea}
					  placeholder="Original Text"
					  value={inputText}
					  onChange={(e) => setInputText(e.target.value)}
					></textarea>
				  </div>
  
				  {/* OR Divider */}
				  <div className={styles.or_divider}>OR</div>
  
				  {/* File Upload */}
				  <div className={styles.upload_area}>
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
					  {/* {uploadedFileName ? (
						<>
						  File uploaded: <strong>{uploadedFileName}</strong>
						</>
					  ) : (
						<>
						  Click to Upload a PDF
						  <br />
						  <span>...or drag and drop a file.</span>
						</>
					  )} */}
					</label>
					<input
					  type="file"
					  id="fileUpload"
					  accept="application/pdf"
					  onChange={handleFileUpload}
					  className={styles.hidden_input}
					  disabled={isUploading} // Disable upload while processing
					/>
				  </div>
				</div>
			  </div>
			  {/* Submit Button */}
			  <button
				className={styles.submit_btn}
				onClick={handleSubmit}
				disabled={!inputText.trim() || isLoading || isUploading}
			  >
				{isLoading ? "Processing..." : "Simplfiy Text"}
			  </button>
	
        </div>
      </div>
    </>
  );
};

export default Main;