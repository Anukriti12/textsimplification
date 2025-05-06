import React, { useState, useEffect, useRef, useCallback  } from "react";
import styles from "./styles.module.css";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
// import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

import { calcMetrics } from "../../utils/textMetrics";

pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.mjs`;

const prefsToPlain = (prefs) => {
	const sections = [];
  
	/* ----- 1 Output length ----- */
	if (prefs.maxWords || prefs.reduction)
	  sections.push(
		`• Limit final output to **${prefs.maxWords || "⩓"} words** ` +
		`(${prefs.reduction ? `${prefs.reduction}% reduction` : "no reduction"}).`
	  );
  
	/* ----- 2 Reading level ----- */
	if (prefs.readingLevels.length)
	  sections.push("• Writing should suit readers who " +
		prefs.readingLevels.join(", ") + ".");
  
	/* ----- 3 Tone ----- */
	if (prefs.tone)
	  sections.push(`• Use a **${prefs.tone}** tone.`);
  
	/* ----- 4 Sentence structure ----- */
	if (prefs.structPrefs.length)
	  sections.push("• Structural preferences: " +
		prefs.structPrefs.join(", ") + ".");
  
	/* ----- 5 Free text ----- */
	if (prefs.misc.trim())
	  sections.push("• Additional notes: " + prefs.misc.trim());
  
	return sections.length ? sections.join("\n") : "";
  };

  
const Main = () => {

	const [inputText, setInputText] = useState("");
	const [outputText, setOutputText] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [isEditable, setIsEditable] = useState(false); // For toggling edit mode
	const [uploadedFileName, setUploadedFileName] = useState(""); // State for file name
	const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);
	const [showSurveyPrompt, setShowSurveyPrompt] = useState(false); // State for survey prompt

	const [documents, setDocuments] = useState([]); // Store user documents
	const [selectedDocument, setSelectedDocument] = useState(null); // Selected doc
	const [isSidebarVisible, setIsSidebarVisible] = useState(false); // Sidebar toggle

	const navigate = useNavigate();
	const [isUploading, setIsUploading] = useState(false); // State for showing buffer

	const user = JSON.parse(localStorage.getItem("user"));
	const email = user?.email;

	const [inputWordCount, setInputWordCount] = useState(0);
	const [inputCharCount, setInputCharCount] = useState(0);
	const [pdfPageCount, setPdfPageCount] = useState(0);

	const inputTextSnapshot = useRef("");
	const [pdfPath, setPdfPath] = useState(""); 

	const [prefsOpen, setPrefsOpen] = useState(false);
	const [customPrefs, setCustomPrefs] = useState({
	  maxWords   : "",      // number or ""
	  reduction  : "",      // "0" | "25" | "50" | …
	  readingLevels : [],   // array of strings
	  tone       : "",      // single string
	  structPrefs: [],      // array of strings
	  misc       : "",      // free text
	});

	const [outputLen, setOutputLen] = useState("");   // "", "50", "150", …, "custom"

	const [showCustom,  setShowCustom]  = useState(false);  // accordion open/close
	const [customLen,   setCustomLen]   = useState("");     // numeric length, if “Custom”
	const [extraPrefs,  setExtraPrefs]  = useState("");     // free‑text box

	// ─── Panel toggle ────────────────────────────────────────────────
const handleTogglePanel = () => setShowCustom((s) => !s);   // <─ NEW

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/Login"); 
  };

  const toggleSet = (key, value) => setCustomPrefs(p => {
    const list = p[key];
    return {
      ...p,
      [key]: list.includes(value)
        ? list.filter(v => v !== value)
        : [...list, value]
    };
  });


    // Load user's past documents (original texts only)
	useEffect(() => {
		if (!email) return;
	
		const fetchDocuments = async () => {
		  try {
			const response = await fetch(
			  `https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications/user/${email}`
			);
			const result = await response.json();
	
			if (response.ok) {
			  const sortedDocs = result.data.sort(
				(a, b) => new Date(b.createdAt) - new Date(a.createdAt)
			  );
			  setDocuments(sortedDocs);
			} else {
			  console.error("Error fetching documents:", result.message);
			}
		  } catch (error) {
			console.error("Error fetching documents:", error);
		  }
		};
	
		fetchDocuments();
	  }, [email]);

	  // Handle document selection from history
  const handleDocumentClick = (doc) => {
    setSelectedDocument(doc);
    setInputText(doc.inputText);
  };

  	const handleFileUpload = async (event) => {
	  const file = event.target.files[0];
	  setPdfPath(`/uploads/${file.name}`);    

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
	  
		const saveInitialSimplification = async (trimmedInput, cleanedOutput) => {
			const user = JSON.parse(localStorage.getItem("user"));
			if (!user) return;

			await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
				userId: user._id,
				email,
				inputText: trimmedInput,
				outputText: cleanedOutput,
				pdfName: uploadedFileName || null,
				pdfPath: pdfPath || null,
				}),
			});
		};


		const generatePrompt = useCallback((inputText) => {
			const prefsText = prefsToPlain(customPrefs);
	
			return `
		### USER‑SPECIFIC CUSTOMISATIONS (please follow **strictly**)
		${prefsText || "• No special preferences."}
		
		You are an expert in accessible communication, tasked with transforming complex text into clear, accessible plain language for individuals with Intellectual and Developmental Disabilities (IDD) or those requiring simplified content. Retain all essential information and intent while prioritizing readability, comprehension, and inclusivity.

		Text simplification refers to rewriting or adapting text to make it easier to read and understand while keeping the same level of detail and precision. Make sure you focus on simplification and not summarization. The length of generated output text must be similar to that of input text.

		Stick to the provided input text and only simplify the language. Don't provide the answer or hallucinate or provide any irrelevant information, not mentioned in the input text. 

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
		  }, [customPrefs]);
	// Function to format the prompt with user input
// const generatePrompt = (inputText) => {
// 	return `
// 	You are an expert in accessible communication, tasked with transforming complex text into clear, accessible plain language for individuals with Intellectual and Developmental Disabilities (IDD) or those requiring simplified content. Retain all essential information and intent while prioritizing readability, comprehension, and inclusivity.

// 	Text simplification refers to rewriting or adapting text to make it easier to read and understand while keeping the same level of detail and precision. Make sure you focus on simplification and not summarization. The length of generated output text must be similar to that of input text.

// 	Stick to the provided input text and only simplify the language. Don't provide the answer or hallucinate or provide any irrelevant information, not mentioned in the input text. 

// 	Guidelines for Simplification:
// 	Vocabulary and Terminology:
// 	Replace uncommon, technical, or abstract words with simple, everyday language.
// 	Define unavoidable complex terms in plain language within parentheses upon first use (example: “cardiologist (heart doctor)”).
// 	Avoid idioms, metaphors, sarcasm, or culturally specific references.

// 	Sentence Structure:
// 	Use short sentences (10--15 words max). Break long sentences into 1–2 ideas each.
// 	Prefer active voice (example: “The doctor examined the patient” vs. “The patient was examined by the doctor”).
// 	Avoid nested clauses, passive voice, and ambiguous pronouns (example: “they,” “it”).

// 	Clarity and Flow:
// 	Organize content logically, using headings/subheadings to group related ideas.
// 	Use bullet points or numbered lists for steps, options, or key points.
// 	Ensure each paragraph focuses on one main idea.

// 	Tone and Engagement:
// 	Write in a neutral, conversational tone (avoid formal or academic language).
// 	Address the reader directly with “you” or “we” where appropriate.
// 	Use consistent terms for concepts (avoid synonyms that may confuse).

// 	Avoid Exclusionary Elements:
// 	Remove jargon, acronyms (unless defined), and expand abbreviations if needed (example: “ASAP” → “as soon as possible”).
// 	Eliminate metaphors, idioms, or implied meanings (example: “hit the books” → “study”).
// 	Avoid double negatives (example: “not uncommon” → “common”).

// 	Structural Support:
// 	Add clear headings to label sections (example: “How to Apply for Benefits”).
// 	Use formatting tools like bold for key terms or warnings.
// 	Chunk information into short paragraphs with line breaks for visual ease.

// 	Inclusivity Checks:
// 	Ensure content is free of bias, stereotypes, or assumptions about the reader.
// 	Use gender-neutral language (example: “they” instead of “he/she”).


// 	Output Requirements:
// 	Return only the simplified text, without markdown, emojis, or images.
// 	Preserve original context, facts, and intent. Do not omit critical details.
// 	Prioritize clarity over brevity; focus on simplification and not summarization. The length of generated output text should be same or similar to that of input text.
// 	Do not simplify already simple text.

// 	Example Transformation:
// 	Original: “Individuals experiencing adverse climatic conditions may necessitate relocation to mitigate health risks.”
// 	Simplified: “If weather conditions become dangerous, people might need to move to stay safe.”

// 	For the provided input text, apply the above guidelines rigorously. Ensure the output is accessible to readers with varied cognitive abilities, emphasizing clarity, simplicity, and logical structure. Verify that the simplified text aligns with plain language standards like WCAG and PlainLanguage.gov.

// 	"${inputText}"
// 	`;
//   };

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

	// const inputText = document.getElementById('inputText').value;
	const trimmedInput = inputText.trim();
	if (!trimmedInput) return;

	// inputTextSnapshot.current = inputText; 
	setIsLoading(true);
  
	try {
	  const chunks = splitTextIntoChunks(trimmedInput, 10000);
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

	await saveInitialSimplification(trimmedInput, cleanedResponse);
	navigate("/review", { state: { inputText: trimmedInput, outputText: cleanedResponse } });
	// navigate("/review", { state: { inputText: trimmedInput, outputText: cleanedResponse } });
	
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

	  <div className={styles.container}>

			 <div
				  className={`${styles.sidebar} ${
					isSidebarVisible ? styles.expanded : ""
				  }`}
				>

			{/* </div> */}

			<button
			className={styles.historyIcon}
			onClick={() => setIsSidebarVisible(!isSidebarVisible)}
			>
				🕒   <p style={{ fontSize: "15px" }}> History </p> 
			</button>



          {isSidebarVisible && (
            <div className={styles.historyContent}>
              <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>
                ✖
              </button>
              <ul className={styles.historyList}>
                {documents.map((doc, index) => (
    
				<li
				key={doc._id}
				onClick={() => handleDocumentClick(doc)}
				className={`${styles.historyItem} ${selectedDocument?._id === doc._id ? styles.activeDoc : ""}`}
				>
				{/* <strong>Document {index + 1}</strong>  */}
				<strong>Document {documents.length - index}</strong>({doc.inputText.substring(0, 20)}...)
				</li>
                ))}
              </ul>
            </div>
          )}
        </div>

	  {/* <div className={styles.main_container}> */}
	  
	  <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
         


			<div className={styles.description}>

			  <p>
			  This tool helps make complex text easier to read while preserving its original meaning. Whether you're simplifying academic content, technical documents, or general text for better accessibility, this tool provides a quick and efficient way to generate a more readable version. You can enter text manually or upload a document to get started.
			  </p>
	</div>

	        {/* ─── (2)  CUSTOMISATION PANEL  ─────────── */}
			<section className={styles.customPanel}>
          {/* toggle row */}
          <button
            className={styles.customToggle}
            onClick={() => setShowCustom((s) => !s)}
          >
            {showCustom ? "▲  Hide Customisation Options" : "▼  Show Customisation Options"}
          </button>

         
		  <div
			className={`${styles.customPanel} ${
				showCustom ? "" : styles.hiddenPanel   // ←  just hide with CSS
			}`}
			>

            <div className={styles.customBody}>
				
              {/* 2‑A  ▸ Output length ------------------------------------------------ */}
              <h3>Output Length</h3>
              <div className={styles.flexRow}>
                <label className={styles.block}>
                  <input type="radio" name="lenPreset" value="50"     checked={outputLen === "50"}      /* ← NEW */
    onChange={(e) => setOutputLen(e.target.value)}/> 50 words
                </label>
                <label className={styles.block}>
                  <input type="radio" name="lenPreset" value="150"     checked={outputLen === "150"}      /* ← NEW */
    onChange={(e) => setOutputLen(e.target.value)}/> 150 words
                </label>
                <label className={styles.block}>
                  <input type="radio" name="lenPreset" value="300"     checked={outputLen === "300"}      /* ← NEW */
    onChange={(e) => setOutputLen(e.target.value)}/> 300 words
                </label>
                <label className={styles.block}>
                  <input type="radio" name="lenPreset" value="500"    checked={outputLen === "500"}      /* ← NEW */
    onChange={(e) => setOutputLen(e.target.value)} /> 500 words
                </label>
		
        
			
                <label className={styles.block}>
                  <input type="radio" name="lenPreset" value="custom"    checked={outputLen === "custom" } onChange={(e) => setOutputLen(e.target.value)}      /* ← NEW */
   /> Custom:{" "}
                  <input
                    type="number"
                    min="10"
                    style={{ width: "5rem" }}
                    onChange={(e) => setCustomLen(e.target.value)}
                  />{" "}
                  words
                </label>
              </div>

              <h3>Reduce original text by</h3>
              <div className={styles.flexRow}>
                {["0", "25", "50", "75", "90"].map((pct) => (
                  <label key={pct} className={styles.block}>
                    <input
                      type="radio"
                      name="reducePct"
                      value={pct}
                      defaultChecked={pct === "0"}
                    />{" "}
                    {pct}%{pct === "0" ? " (No reduction)" : ""}
                  </label>
                ))}
              </div>

              {/* 2‑B  ▸ Reading level ---------------------------------------------- */}
              <h3>Reading Level</h3>
              <div className={styles.flexRow}>
                {[
                  "Are learning to read",
                  "Need simple vocabulary",
                  "Prefer shorter sentences",
                  "Can handle complex concepts but need clear explanations",
                  "Are professionals in this field",
                ].map((txt) => (
                  <label key={txt} className={styles.block}>
                    <input type="checkbox" name="readingLevel" value={txt} />{" "}
                    {txt}
                  </label>
                ))}
              </div>

              {/* 2‑C  ▸ Tone / style ---------------------------------------------- */}
              <h3>Tone &amp; Style</h3>
              <div className={styles.flexRow}>
                {[
                  "Casual/Conversational",
                  "Professional/Formal",
                  "Academic/Instructional",
                  "Creative/Enthusiastic",
                  "Neutral/Objective",
                ].map((tone) => (
                  <label key={tone} className={styles.block}>
                    <input type="radio" name="tone" value={tone} /> {tone}
                  </label>
                ))}
              </div>

              {/* 2‑D  ▸ Sentence structure ---------------------------------------- */}
              <h3>Sentence Structure Preferences</h3>
              <div className={styles.flexRow}>
                {[
                  "Bullet points instead of paragraphs",
                  "Numbered sequences for steps",
                  "Headings to break up content",
                  "White space between key ideas",
                  "Convert passive to active voice",
                  "Break up sentences longer than X words",
                  "Simplify nested clauses",
                  "Maintain consistent subject‑verb patterns",
                  "Reduce prepositional phrases",
                ].map((opt) => (
                  <label key={opt} className={styles.block}>
                    <input type="checkbox" name="structure" value={opt} /> {opt}
                  </label>
                ))}
              </div>

              {/* 2‑E  ▸ Free‑text box -------------------------------------------- */}
              <h3>Anything else?</h3>
              <textarea
                rows={3}
                placeholder="Type any additional preferences here…"
                onChange={(e) => setExtraPrefs(e.target.value)}
              />
            </div>
          
			</div>
        </section>

		{/*  */}

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
				id="simplifyBtn"
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