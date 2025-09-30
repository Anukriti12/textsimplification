// import React, { useState, useEffect, useRef, useCallback  } from "react";
// import styles from "./styles.module.css";
// import { useNavigate } from "react-router-dom";
// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
// // import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
// import { jwtDecode } from "jwt-decode";
// import Footer from "../Footer";
// import { calcMetrics } from "../../utils/textMetrics";
// import StatsButton from "../StatsButton";

// pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.mjs`;

// const prefsToPlain = (prefs) => {
// 	const sections = [];
  
// 	/* ----- 1 Output length ----- */
// 	if (prefs.maxWords || prefs.reduction)
// 	  sections.push(
// 		`• Limit final output to **${prefs.maxWords || "⩓"} words** ` +
// 		`(${prefs.reduction ? `${prefs.reduction}% reduction` : "no reduction"}).`
// 	  );
  
// 	/* ----- 2 Reading level ----- */
// 	if (prefs.readingLevels.length)
// 	  sections.push("• Writing should suit readers who " +
// 		prefs.readingLevels.join(", ") + ".");
  
// 	/* ----- 3 Tone ----- */
// 	if (prefs.tone)
// 	  sections.push(`• Use a **${prefs.tone}** tone.`);
  
// 	/* ----- 4 Sentence structure ----- */
// 	if (prefs.structPrefs.length)
// 	  sections.push("• Structural preferences: " +
// 		prefs.structPrefs.join(", ") + ".");
  
// 	/* ----- 5 Free text ----- */
// 	if (prefs.misc.trim())
// 	  sections.push("• Additional notes: " + prefs.misc.trim());
  
// 	return sections.length ? sections.join("\n") : "";
//   };

  
// const Main = () => {

// 	const [inputText, setInputText] = useState("");
// 	const [outputText, setOutputText] = useState("");
// 	const [isLoading, setIsLoading] = useState(false);
// 	const [isSubmitted, setIsSubmitted] = useState(false);
// 	const [isEditable, setIsEditable] = useState(false); // For toggling edit mode
// 	const [uploadedFileName, setUploadedFileName] = useState(""); // State for file name
// 	const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);
// 	const [showSurveyPrompt, setShowSurveyPrompt] = useState(false); // State for survey prompt

// 	const [documents, setDocuments] = useState([]); // Store user documents
// 	const [selectedDocument, setSelectedDocument] = useState(null); // Selected doc
// 	const [isSidebarVisible, setIsSidebarVisible] = useState(false); // Sidebar toggle

// 	const navigate = useNavigate();
// 	const [isUploading, setIsUploading] = useState(false); // State for showing buffer

// 	const user = JSON.parse(localStorage.getItem("user"));
// 	const email = user?.email;

// 	const [inputWordCount, setInputWordCount] = useState(0);
// 	const [inputCharCount, setInputCharCount] = useState(0);
// 	const [pdfPageCount, setPdfPageCount] = useState(0);

// 	const inputTextSnapshot = useRef("");
// 	const [pdfPath, setPdfPath] = useState(""); 

// 	const [prefsOpen, setPrefsOpen] = useState(false);
// 	const [customPrefs, setCustomPrefs] = useState({
// 	  maxWords   : "",      // number or ""
// 	  reduction  : "",      // "0" | "25" | "50" | …
// 	  readingLevels : [],   // array of strings
// 	  tone       : "",      // single string
// 	  structPrefs: [],      // array of strings
// 	  misc       : "",      // free text
// 	});

// 	const [outputLen, setOutputLen] = useState("");   // "", "50", "150", …, "custom"

// 	const [showCustom,  setShowCustom]  = useState(false);  // accordion open/close
// 	const [customLen,   setCustomLen]   = useState("");     // numeric length, if “Custom”
// 	const [extraPrefs,  setExtraPrefs]  = useState("");     // free‑text box

// 	// ─── Panel toggle ────────────────────────────────────────────────
// const handleTogglePanel = () => setShowCustom((s) => !s);   // <─ NEW

//   const handleLogout = () => {
//     localStorage.removeItem("token");
//     navigate("/Login"); 
//   };

//   const toggleSet = (key, value) => setCustomPrefs(p => {
//     const list = p[key];
//     return {
//       ...p,
//       [key]: list.includes(value)
//         ? list.filter(v => v !== value)
//         : [...list, value]
//     };
//   });


//     // Load user's past documents (original texts only)
// 	useEffect(() => {
// 		if (!email) return;
	
// 		const fetchDocuments = async () => {
// 		  try {
// 			const response = await fetch(
// 			  `https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/user/${email}`
// 			);
// 			const result = await response.json();
	
// 			if (response.ok) {
// 			  const sortedDocs = result.data.sort(
// 				(a, b) => new Date(b.createdAt) - new Date(a.createdAt)
// 			  );
// 			  setDocuments(sortedDocs);
// 			} else {
// 			  console.error("Error fetching documents:", result.message);
// 			}
// 		  } catch (error) {
// 			console.error("Error fetching documents:", error);
// 		  }
// 		};
	
// 		fetchDocuments();
// 	  }, [email]);

// 	  // Handle document selection from history
//   const handleDocumentClick = (doc) => {
//     setSelectedDocument(doc);
//     setInputText(doc.inputText);
//   };

//   	const handleFileUpload = async (event) => {
// 	  const file = event.target.files[0];
// 	  setPdfPath(`/uploads/${file.name}`);    

// 	  if (!file) return;
  
// 	  setIsUploading(true); // Show buffer while processing
// 	  setUploadedFileName(file.name); // Set file name

// 	  try {
// 		//setUploadedFileName(file.name); // Set the uploaded file name
// 		const fileReader = new FileReader();
// 		fileReader.onload = async function () {
// 		  const typedArray = new Uint8Array(this.result);
  
// 		  const pdf = await pdfjsLib.getDocument(typedArray).promise;

// 		  setPdfPageCount(pdf.numPages);

// 		  let text = "";
  
// 		  // Extract text from all pages
// 		  for (let i = 1; i <= pdf.numPages; i++) {
// 			const page = await pdf.getPage(i);
// 			const textContent = await page.getTextContent();
// 			text += textContent.items.map((item) => item.str).join(" ");
// 		  }
  
// 		  setInputText(text);
// 		};
// 		fileReader.readAsArrayBuffer(file);
// 	  } catch (error) {
// 		console.error("Error reading PDF:", error);
// 		alert("Failed to extract text from the PDF.");
// 	  } finally {
// 		setIsUploading(false); // Hide buffer once done
// 	  }
// 	};
 
// 	const countWordsAndChars = (text) => {
// 		const words = text.trim().split(/\s+/).filter(Boolean).length;
// 		const chars = text.length;
// 		return { words, chars };
// 	  };
	  
// 	    useEffect(() => {
// 		  const { words: inputWords, chars: inputChars } = countWordsAndChars(inputText);

// 		  setInputWordCount(inputWords);
// 		  setInputCharCount(inputChars);

// 		}, [inputText]);
	  
// 		const saveInitialSimplification = async (trimmedInput, cleanedOutput) => {
// 			const user = JSON.parse(localStorage.getItem("user"));
// 			if (!user) return;

// 			await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications", {
// 				method: "POST",
// 				headers: { "Content-Type": "application/json" },
// 				body: JSON.stringify({
// 				userId: user._id,
// 				email,
// 				inputText: trimmedInput,
// 				outputText: cleanedOutput,
// 				pdfName: uploadedFileName || null,
// 				pdfPath: pdfPath || null,
// 				}),
// 			});
// 		};


// 		const generatePrompt = useCallback((inputText) => {
// 			const prefsText = prefsToPlain(customPrefs);
	
// 			return `
// 		### USER‑SPECIFIC CUSTOMISATIONS (please follow **strictly**)
// 		${prefsText || "• No special preferences."}
		
// 		You are an expert in accessible communication, tasked with transforming complex text into clear, accessible plain language for individuals with Intellectual and Developmental Disabilities (IDD) or those requiring simplified content. Retain all essential information and intent while prioritizing readability, comprehension, and inclusivity.

// 		Text simplification refers to rewriting or adapting text to make it easier to read and understand while keeping the same level of detail and precision. Make sure you focus on simplification and not summarization. The length of generated output text must be similar to that of input text.

// 		Stick to the provided input text and only simplify the language. Don't provide the answer or hallucinate or provide any irrelevant information, not mentioned in the input text. 

// 		Guidelines for Simplification:
// 		Vocabulary and Terminology:
// 		Replace uncommon, technical, or abstract words with simple, everyday language.
// 		Define unavoidable complex terms in plain language within parentheses upon first use (example: “cardiologist (heart doctor)”).
// 		Avoid idioms, metaphors, sarcasm, or culturally specific references.

// 		Sentence Structure:
// 		Use short sentences (10--15 words max). Break long sentences into 1–2 ideas each.
// 		Prefer active voice (example: “The doctor examined the patient” vs. “The patient was examined by the doctor”).
// 		Avoid nested clauses, passive voice, and ambiguous pronouns (example: “they,” “it”).

// 		Clarity and Flow:
// 		Organize content logically, using headings/subheadings to group related ideas.
// 		Use bullet points or numbered lists for steps, options, or key points.
// 		Ensure each paragraph focuses on one main idea.

// 		Tone and Engagement:
// 		Write in a neutral, conversational tone (avoid formal or academic language).
// 		Address the reader directly with “you” or “we” where appropriate.
// 		Use consistent terms for concepts (avoid synonyms that may confuse).

// 		Avoid Exclusionary Elements:
// 		Remove jargon, acronyms (unless defined), and expand abbreviations if needed (example: “ASAP” → “as soon as possible”).
// 		Eliminate metaphors, idioms, or implied meanings (example: “hit the books” → “study”).
// 		Avoid double negatives (example: “not uncommon” → “common”).

// 		Structural Support:
// 		Add clear headings to label sections (example: “How to Apply for Benefits”).
// 		Use formatting tools like bold for key terms or warnings.
// 		Chunk information into short paragraphs with line breaks for visual ease.

// 		Inclusivity Checks:
// 		Ensure content is free of bias, stereotypes, or assumptions about the reader.
// 		Use gender-neutral language (example: “they” instead of “he/she”).


// 		Output Requirements:
// 		Return only the simplified text, without markdown, emojis, or images.
// 		Preserve original context, facts, and intent. Do not omit critical details.
// 		Prioritize clarity over brevity; focus on simplification and not summarization. The length of generated output text should be same or similar to that of input text.
// 		Do not simplify already simple text.

// 		Example Transformation:
// 		Original: “Individuals experiencing adverse climatic conditions may necessitate relocation to mitigate health risks.”
// 		Simplified: “If weather conditions become dangerous, people might need to move to stay safe.”

// 		For the provided input text, apply the above guidelines rigorously. Ensure the output is accessible to readers with varied cognitive abilities, emphasizing clarity, simplicity, and logical structure. Verify that the simplified text aligns with plain language standards like WCAG and PlainLanguage.gov.

// 		"${inputText}"
// 		`;
// 		  }, [customPrefs]);

//   const splitTextIntoChunks = (text, maxTokens) => {
// 	const words = text.split(" ");
// 	let chunks = [];
// 	let currentChunk = [];
  
// 	for (let word of words) {
// 	  if (currentChunk.join(" ").length + word.length < maxTokens) {
// 		currentChunk.push(word);
// 	  } else {
// 		chunks.push(currentChunk.join(" "));
// 		currentChunk = [word];
// 	  }
// 	}
// 	if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));
// 	return chunks;
//   };


//   const handleSubmit = async () => {

// 	// const inputText = document.getElementById('inputText').value;
// 	const trimmedInput = inputText.trim();
// 	if (!trimmedInput) return;

// 	// inputTextSnapshot.current = inputText; 
// 	setIsLoading(true);
  
// 	try {
// 	  const chunks = splitTextIntoChunks(trimmedInput, 1000);
// 	  let combinedOutput = "";
  
// 	  for (let chunk of chunks) {
// 		const prompt = generatePrompt(chunk);
// 		const response = await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4", {
// 		  method: "POST",
// 		  headers: { "Content-Type": "application/json" },
// 		  body: JSON.stringify({ prompt }),
// 		});
		
// 		if (!response.ok) {
// 			console.error(`API request failed with status: ${response.status}`);
// 			continue; // Skip this chunk if the API request failed
// 		  }

// 		const data = await response.json();
// 		console.log("Full API Response: ", data);


// 		const data1 = data?.response?.replace(/^"|"$/g, "") || "No response received."; // Append results
// 		combinedOutput += data1 + " ";
// 	}
// 	  console.log("Final Combined Output: ", combinedOutput);

// 	console.log("Data: ", combinedOutput);

// 	const cleanedResponse = combinedOutput.trim();
// 	setOutputText(cleanedResponse);
// 	setIsSubmitted(true);

// 	await saveInitialSimplification(trimmedInput, cleanedResponse);
// 	navigate("/review", { state: { inputText: trimmedInput, outputText: cleanedResponse } });
// 	// navigate("/review", { state: { inputText: trimmedInput, outputText: cleanedResponse } });
	
// 	} catch (error) {
// 	  console.error("Error fetching GPT-4o response:", error);
// 	  setOutputText("An error occurred while simplifying the text.");
// 	}
  
// 	setIsLoading(false);
//   };

  

//   return (
//     <>
//       <nav className={styles.navbar}>
//         {/* <h1>Text Simplification Tool</h1> */}
// 		<h1 
//     onClick={() => window.location.href = "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/"}
//     style={{ cursor: "pointer" }} // Makes it look clickable
//  		>
// 		Text Simplification Tool</h1>
//         <button className={styles.white_btn} onClick={handleLogout}>
//           Logout
//         </button>
//       </nav>

// 	  <div className={styles.container}>

// 			 <div
// 				  className={`${styles.sidebar} ${
// 					isSidebarVisible ? styles.expanded : ""
// 				  }`}
// 				>

// 			{/* </div> */}

// 			<button
// 			className={styles.historyIcon}
// 			onClick={() => setIsSidebarVisible(!isSidebarVisible)}
// 			>
// 				🕒   <p style={{ fontSize: "15px" }}> History </p> 
// 			</button>



//           {isSidebarVisible && (
//             <div className={styles.historyContent}>
//               <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>
//                 ✖
//               </button>
//               <ul className={styles.historyList}>
//                 {documents.map((doc, index) => (
    
// 				<li
// 				key={doc._id}
// 				onClick={() => handleDocumentClick(doc)}
// 				className={`${styles.historyItem} ${selectedDocument?._id === doc._id ? styles.activeDoc : ""}`}
// 				>
// 				{/* <strong>Document {index + 1}</strong>  */}
// 				<strong>Document {documents.length - index}</strong>({doc.inputText.substring(0, 20)}...)
// 				</li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>

// 	  {/* <div className={styles.main_container}> */}
	  
// 	  <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
         


// 			<div className={styles.description}>

// 			  <p>
// 			  This tool helps make complex text easier to read while preserving its original meaning. Whether you're simplifying academic content, technical documents, or general text for better accessibility, this tool provides a quick and efficient way to generate a more readable version. You can enter text manually or upload a document to get started.
// 			  </p>
// 	</div>

// 	        {/* ─── (2)  CUSTOMISATION PANEL  ─────────── */}
// 			<section className={styles.customPanel}>
//           {/* toggle row */}
//           <button
//             className={styles.customToggle}
//             onClick={() => setShowCustom((s) => !s)}
//           >
//             {showCustom ? "▲  Hide Customisation Options" : "▼  Show Customisation Options"}
//           </button>

         
// 		  <div
// 			className={`${styles.customPanel} ${
// 				showCustom ? "" : styles.hiddenPanel   // ←  just hide with CSS
// 			}`}
// 			>

//             <div className={styles.customBody}>
				
//               {/* 2‑A  ▸ Output length ------------------------------------------------ */}
//               <h3>Output Length</h3>
//               <div className={styles.flexRow}>
//                 <label className={styles.block}>
//                   <input type="radio" name="lenPreset" value="50"     checked={outputLen === "50"}      /* ← NEW */
//     onChange={(e) => setOutputLen(e.target.value)}/> 50 words
//                 </label>
//                 <label className={styles.block}>
//                   <input type="radio" name="lenPreset" value="150"     checked={outputLen === "150"}      /* ← NEW */
//     onChange={(e) => setOutputLen(e.target.value)}/> 150 words
//                 </label>
//                 <label className={styles.block}>
//                   <input type="radio" name="lenPreset" value="300"     checked={outputLen === "300"}      /* ← NEW */
//     onChange={(e) => setOutputLen(e.target.value)}/> 300 words
//                 </label>
//                 <label className={styles.block}>
//                   <input type="radio" name="lenPreset" value="500"    checked={outputLen === "500"}      /* ← NEW */
//     onChange={(e) => setOutputLen(e.target.value)} /> 500 words
//                 </label>
		
        
			
//                 <label className={styles.block}>
//                   <input type="radio" name="lenPreset" value="custom"    checked={outputLen === "custom" } onChange={(e) => setOutputLen(e.target.value)}      /* ← NEW */
//    /> Custom:{" "}
//                   <input
//                     type="number"
//                     min="10"
//                     style={{ width: "5rem" }}
//                     onChange={(e) => setCustomLen(e.target.value)}
//                   />{" "}
//                   words
//                 </label>
//               </div>

//               <h3>Reduce original text by</h3>
//               <div className={styles.flexRow}>
//                 {["0", "25", "50", "75", "90"].map((pct) => (
//                   <label key={pct} className={styles.block}>
//                     <input
//                       type="radio"
//                       name="reducePct"
//                       value={pct}
//                       defaultChecked={pct === "0"}
//                     />{" "}
//                     {pct}%{pct === "0" ? " (No reduction)" : ""}
//                   </label>
//                 ))}
//               </div>

//               {/* 2‑B  ▸ Reading level ---------------------------------------------- */}
//               <h3>Reading Level</h3>
//               <div className={styles.flexRow}>
//                 {[
//                   "Are learning to read",
//                   "Need simple vocabulary",
//                   "Prefer shorter sentences",
//                   "Can handle complex concepts but need clear explanations",
//                   "Are professionals in this field",
//                 ].map((txt) => (
//                   <label key={txt} className={styles.block}>
//                     <input type="checkbox" name="readingLevel" value={txt} />{" "}
//                     {txt}
//                   </label>
//                 ))}
//               </div>

//               {/* 2‑C  ▸ Tone / style ---------------------------------------------- */}
//               <h3>Tone &amp; Style</h3>
//               <div className={styles.flexRow}>
//                 {[
//                   "Casual/Conversational",
//                   "Professional/Formal",
//                   "Academic/Instructional",
//                   "Creative/Enthusiastic",
//                   "Neutral/Objective",
//                 ].map((tone) => (
//                   <label key={tone} className={styles.block}>
//                     <input type="radio" name="tone" value={tone} /> {tone}
//                   </label>
//                 ))}
//               </div>

//               {/* 2‑D  ▸ Sentence structure ---------------------------------------- */}
//               <h3>Sentence Structure Preferences</h3>
//               <div className={styles.flexRow}>
//                 {[
//                   "Bullet points instead of paragraphs",
//                   "Numbered sequences for steps",
//                   "Headings to break up content",
//                   "White space between key ideas",
//                   "Convert passive to active voice",
//                   "Break up sentences longer than 10--15 words words",
//                   "Simplify nested clauses",
//                   "Reduce prepositional phrases",
//                 ].map((opt) => (
//                   <label key={opt} className={styles.block}>
//                     <input type="checkbox" name="structure" value={opt} /> {opt}
//                   </label>
//                 ))}
//               </div>

//               {/* 2‑E  ▸ Free‑text box -------------------------------------------- */}
//               <h3>Anything else?</h3>
//               <textarea
//                 rows={3}
//                 placeholder="Type any additional preferences here…"
//                 onChange={(e) => setExtraPrefs(e.target.value)}
//               />
//             </div>
          
// 			</div>
//         </section>

// 		{/*  */}

// 			  <div className={styles.form_container}>
// 				{/* Input Area */}
// 				<div className={styles.input_area}>
// 				  <div className={styles.text_container}>
// 					<label className={styles.label} htmlFor="inputText">
// 					  Input Text
// 					</label>
// 					<textarea
// 					  id="inputText"
// 					  className={`${styles.textarea} ${isLoading ? styles.disabled : ""}`}
// 					//   className={styles.textarea}
// 					  placeholder="Write/Paste your text here or upload a PDF document to extract content automatically."
// 					  value={inputText}
// 					  onChange={(e) => setInputText(e.target.value)}
// 					  disabled={isLoading} // Disable input when loading
// 					></textarea>
				 
// 				 <p className={styles.countText}>Words: {inputWordCount} | Characters: {inputCharCount}
// 				 {pdfPageCount > 0 && ` | Pages: ${pdfPageCount}`}
// 				 </p>
					
// 				  </div>
  
// 				  {/* OR Divider */}
// 				  <div className={styles.or_divider}>OR</div>
  
// 				  {/* File Upload */}
// 				  <div className={`${styles.upload_area} ${isLoading ? styles.disabled : ""}`}
// 					onDragOver={(e) => e.preventDefault()} // Prevent default behavior
// 					onDrop={(e) => {
// 						e.preventDefault();
// 						const file = e.dataTransfer.files[0]; // Get the first dropped file
// 						if (file) {
// 						handleFileUpload({ target: { files: [file] } }); // Simulate file selection event
// 						}
// 					}}>
// 					<label htmlFor="fileUpload" className={styles.upload_box}>
						
// 						{isUploading ? (
// 							<span className={styles.loadingText}>Extracting text, please wait...</span>
// 							) : uploadedFileName ? (
// 							<>
// 								File uploaded: <strong>{uploadedFileName}</strong>
// 							</>
// 							) : (
// 							<>
// 								Click to Upload a PDF
// 								<br />
// 								<span>...or drag and drop a file.</span>
// 							</>
// 						)}
			
// 					</label>
// 					<input
// 					  type="file"
// 					  id="fileUpload"
// 					  accept="application/pdf"
// 					  onChange={handleFileUpload}
// 					  className={styles.hidden_input}
// 					  disabled={isUploading || isLoading} // Disable upload while processing
// 					  //disabled={isUploading} // Disable upload while processing
// 					/>
// 				  </div>
// 				</div>
// 			  </div>
// 			  {/* Submit Button */}
// 			  <button
// 				className={styles.submit_btn}
// 				onClick={handleSubmit}
// 				disabled={!inputText.trim() || isLoading || isUploading}
// 				id="simplifyBtn"
// 				//title={!inputText.trim() ? "Enter text or upload a file to enable simplification." : ""}
// 			  >
// 				{isLoading ? "Processing..." : "Simplify Text"}
// 			  </button>
	
// 			  <p className={styles.help_text}>Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a></p>
// 			  <Footer />  
//       </div>

//       </div>
	  
//     </>
//   );
// };

// export default Main;




// v2
// import React, { useState, useEffect, useRef, useCallback  } from "react";
// import styles from "./styles.module.css";
// import { useNavigate } from "react-router-dom";
// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
// // import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
// import { jwtDecode } from "jwt-decode";
// import Footer from "../Footer";
// import { calcMetrics } from "../../utils/textMetrics";
// import StatsButton from "../StatsButton";

// pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.mjs`;

// // Updated prefsToPlain function to work with expanded structure preferences
// const prefsToPlain = (inputWordCount, outputLength, customWordCount, structurePrefs, tonePreference) => {
//   const sections = [];

//   // Helper function to calculate word counts
//   const calculateWordCount = (inputWordCount, type, customWordCount) => {
//     switch(type) {
//       case "shorter": return Math.round(inputWordCount * 0.75);
//       case "much_shorter": return Math.round(inputWordCount * 0.5);
//       case "custom": return customWordCount;
//       default: return inputWordCount;
//     }
//   };

//   // Output length
//   const targetWordCount = calculateWordCount(inputWordCount, outputLength, customWordCount);
//   if (outputLength !== "same") {
//     sections.push(`• Limit final output to **${targetWordCount} words**.`);
//   }

//   // Organization & Structure
//   const organizationPrefs = [];
//   if (structurePrefs.sectionHeadings) organizationPrefs.push("add clear section headings");
//   if (structurePrefs.bulletLists) organizationPrefs.push("use bullet points or numbered lists for sequences and key points");
//   if (structurePrefs.shortParagraphs) organizationPrefs.push("keep paragraphs to 2-3 sentences maximum");
//   if (structurePrefs.addWhiteSpace) organizationPrefs.push("add white space between key ideas for visual breaks");
  
//   if (organizationPrefs.length > 0) {
//     sections.push("• Organization: " + organizationPrefs.join(", ") + ".");
//   }

//   // Sentence Structure
//   const sentencePrefs = [];
//   if (structurePrefs.sentenceSplitting) sentencePrefs.push("break sentences longer than 10-15 words");
//   if (structurePrefs.activeVoice) sentencePrefs.push("convert passive voice to active voice");
//   if (structurePrefs.avoidNestedClauses) sentencePrefs.push("simplify nested clauses and complex sentence structures");
//   if (structurePrefs.clearPronouns) sentencePrefs.push("avoid ambiguous pronouns like 'they,' 'it,' 'this'");
  
//   if (sentencePrefs.length > 0) {
//     sections.push("• Sentence structure: " + sentencePrefs.join(", ") + ".");
//   }

//   // Vocabulary & Clarity
//   const vocabularyPrefs = [];
//   if (structurePrefs.useEverydayLanguage) vocabularyPrefs.push("replace complex words with simple, everyday language");
//   if (structurePrefs.defineComplexTerms) vocabularyPrefs.push("define unavoidable complex terms in parentheses");
//   if (structurePrefs.expandAcronyms) vocabularyPrefs.push("expand acronyms and abbreviations");
//   if (structurePrefs.avoidJargon) vocabularyPrefs.push("remove technical jargon and specialized language");
//   if (structurePrefs.avoidIdioms) vocabularyPrefs.push("avoid idioms, metaphors, and culturally specific references");
//   if (structurePrefs.avoidDoubleNegatives) vocabularyPrefs.push("eliminate double negatives and use positive statements");
//   if (structurePrefs.consistentTerms) vocabularyPrefs.push("use consistent terminology and avoid confusing synonyms");
  
//   if (vocabularyPrefs.length > 0) {
//     sections.push("• Vocabulary: " + vocabularyPrefs.join(", ") + ".");
//   }

//   // Engagement & Formatting
//   const engagementPrefs = [];
//   if (structurePrefs.directAddress) engagementPrefs.push("use direct address with 'you' or 'we' where appropriate");
//   if (structurePrefs.boldKeyTerms) engagementPrefs.push("use bold formatting for key terms and warnings");
  
//   if (engagementPrefs.length > 0) {
//     sections.push("• Engagement: " + engagementPrefs.join(", ") + ".");
//   }

//   // Tone
//   if (tonePreference !== "neutral") {
//     sections.push(`• Use a **${tonePreference}** tone while maintaining accessibility.`);
//   }

//   return sections.length ? sections.join("\n") : "• Follow standard text simplification guidelines.";
// };

  
// const Main = () => {

// 	const [inputText, setInputText] = useState("");
// 	const [outputText, setOutputText] = useState("");
// 	const [isLoading, setIsLoading] = useState(false);
// 	const [isSubmitted, setIsSubmitted] = useState(false);
// 	const [isEditable, setIsEditable] = useState(false); // For toggling edit mode
// 	const [uploadedFileName, setUploadedFileName] = useState(""); // State for file name
// 	const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);
// 	const [showSurveyPrompt, setShowSurveyPrompt] = useState(false); // State for survey prompt

// 	const [documents, setDocuments] = useState([]); // Store user documents
// 	const [selectedDocument, setSelectedDocument] = useState(null); // Selected doc
// 	const [isSidebarVisible, setIsSidebarVisible] = useState(false); // Sidebar toggle

// 	const navigate = useNavigate();
// 	const [isUploading, setIsUploading] = useState(false); // State for showing buffer

// 	const user = JSON.parse(localStorage.getItem("user"));
// 	const email = user?.email;

// 	const [inputWordCount, setInputWordCount] = useState(0);
// 	const [inputCharCount, setInputCharCount] = useState(0);
// 	const [pdfPageCount, setPdfPageCount] = useState(0);

// 	const inputTextSnapshot = useRef("");
// 	const [pdfPath, setPdfPath] = useState(""); 

// 	// Updated state variables for your customization requirements
// 	const [outputLength, setOutputLength] = useState("same"); // "same", "shorter", "much_shorter", "custom"
// 	const [customWordCount, setCustomWordCount] = useState("");

// 	// Structure preferences - extracted from your existing prompt
// 	const [structurePrefs, setStructurePrefs] = useState({
// 	  // Organization & Structure
// 	  sectionHeadings: true,
// 	  bulletLists: true,
// 	  shortParagraphs: true,
	  
// 	  // Sentence Structure
// 	  sentenceSplitting: true,
// 	  activeVoice: true,
// 	  avoidNestedClauses: true,
// 	  clearPronouns: true,
	  
// 	  // Vocabulary & Clarity
// 	  defineComplexTerms: true,
// 	  expandAcronyms: true,
// 	  avoidJargon: true,
// 	  avoidIdioms: true,
// 	  avoidDoubleNegatives: true,
// 	  useEverydayLanguage: true,
	  
// 	  // Formatting & Visual
// 	  boldKeyTerms: true,
// 	  addWhiteSpace: true,
// 	  directAddress: true, // Use "you" or "we"
// 	  consistentTerms: true, // Avoid synonyms that may confuse
	  
// 	  // Special Features
// 	  showChanges: false // This one defaults to OFF
// 	});

// 	const [tonePreference, setTonePreference] = useState("neutral"); // "neutral", "academic", "formal", "creative"

// 	const [showCustom,  setShowCustom]  = useState(false);  // accordion open/close

// 	// Helper function to calculate word counts based on input
// 	const calculateWordCount = (inputWordCount, type) => {
// 	  switch(type) {
// 		case "shorter": return Math.round(inputWordCount * 0.75);
// 		case "much_shorter": return Math.round(inputWordCount * 0.5);
// 		case "custom": return customWordCount;
// 		default: return inputWordCount;
// 	  }
// 	};

// 	// Toggle function for structure preferences
// 	const toggleStructurePref = (key) => {
// 	  setStructurePrefs(prev => ({
// 		...prev,
// 		[key]: !prev[key]
// 	  }));
// 	};

//   const handleLogout = () => {
//     localStorage.removeItem("token");
//     navigate("/Login"); 
//   };

//     // Load user's past documents (original texts only)
// 	useEffect(() => {
// 		if (!email) return;
	
// 		const fetchDocuments = async () => {
// 		  try {
// 			const response = await fetch(
// 			  `https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/user/${email}`
// 			);
// 			const result = await response.json();
	
// 			if (response.ok) {
// 			  const sortedDocs = result.data.sort(
// 				(a, b) => new Date(b.createdAt) - new Date(a.createdAt)
// 			  );
// 			  setDocuments(sortedDocs);
// 			} else {
// 			  console.error("Error fetching documents:", result.message);
// 			}
// 		  } catch (error) {
// 			console.error("Error fetching documents:", error);
// 		  }
// 		};
	
// 		fetchDocuments();
// 	  }, [email]);

// 	  // Handle document selection from history
//   const handleDocumentClick = (doc) => {
//     setSelectedDocument(doc);
//     setInputText(doc.inputText);
//   };

//   	const handleFileUpload = async (event) => {
// 	  const file = event.target.files[0];
// 	  setPdfPath(`/uploads/${file.name}`);    

// 	  if (!file) return;
  
// 	  setIsUploading(true); // Show buffer while processing
// 	  setUploadedFileName(file.name); // Set file name

// 	  try {
// 		//setUploadedFileName(file.name); // Set the uploaded file name
// 		const fileReader = new FileReader();
// 		fileReader.onload = async function () {
// 		  const typedArray = new Uint8Array(this.result);
  
// 		  const pdf = await pdfjsLib.getDocument(typedArray).promise;

// 		  setPdfPageCount(pdf.numPages);

// 		  let text = "";
  
// 		  // Extract text from all pages
// 		  for (let i = 1; i <= pdf.numPages; i++) {
// 			const page = await pdf.getPage(i);
// 			const textContent = await page.getTextContent();
// 			text += textContent.items.map((item) => item.str).join(" ");
// 		  }
  
// 		  setInputText(text);
// 		};
// 		fileReader.readAsArrayBuffer(file);
// 	  } catch (error) {
// 		console.error("Error reading PDF:", error);
// 		alert("Failed to extract text from the PDF.");
// 	  } finally {
// 		setIsUploading(false); // Hide buffer once done
// 	  }
// 	};
 
// 	const countWordsAndChars = (text) => {
// 		const words = text.trim().split(/\s+/).filter(Boolean).length;
// 		const chars = text.length;
// 		return { words, chars };
// 	  };
	  
// 	    useEffect(() => {
// 		  const { words: inputWords, chars: inputChars } = countWordsAndChars(inputText);

// 		  setInputWordCount(inputWords);
// 		  setInputCharCount(inputChars);

// 		}, [inputText]);
	  
// 		const saveInitialSimplification = async (trimmedInput, cleanedOutput) => {
// 			const user = JSON.parse(localStorage.getItem("user"));
// 			if (!user) return;

// 			await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications", {
// 				method: "POST",
// 				headers: { "Content-Type": "application/json" },
// 				body: JSON.stringify({
// 				userId: user._id,
// 				email,
// 				inputText: trimmedInput,
// 				outputText: cleanedOutput,
// 				pdfName: uploadedFileName || null,
// 				pdfPath: pdfPath || null,
// 				}),
// 			});
// 		};


// 		const generatePrompt = useCallback((inputText) => {
// 			const prefsText = prefsToPlain(inputWordCount, outputLength, customWordCount, structurePrefs, tonePreference);
	
// 			return `
// 		### USER‑SPECIFIC CUSTOMISATIONS (please follow **strictly**)
// 		${prefsText || "• No special preferences."}
		
// 		You are an expert in accessible communication, tasked with transforming complex text into clear, accessible plain language for individuals with Intellectual and Developmental Disabilities (IDD) or those requiring simplified content. Retain all essential information and intent while prioritizing readability, comprehension, and inclusivity.

// 		Text simplification refers to rewriting or adapting text to make it easier to read and understand while keeping the same level of detail and precision. Make sure you focus on simplification and not summarization. The length of generated output text must be similar to that of input text.

// 		Stick to the provided input text and only simplify the language. Don't provide the answer or hallucinate or provide any irrelevant information, not mentioned in the input text. 

// 		Guidelines for Simplification:
// 		Vocabulary and Terminology:
// 		Replace uncommon, technical, or abstract words with simple, everyday language.
// 		Define unavoidable complex terms in plain language within parentheses upon first use (example: "cardiologist (heart doctor)").
// 		Avoid idioms, metaphors, sarcasm, or culturally specific references.

// 		Sentence Structure:
// 		Use short sentences (10--15 words max). Break long sentences into 1–2 ideas each.
// 		Prefer active voice (example: "The doctor examined the patient" vs. "The patient was examined by the doctor").
// 		Avoid nested clauses, passive voice, and ambiguous pronouns (example: "they," "it").

// 		Clarity and Flow:
// 		Organize content logically, using headings/subheadings to group related ideas.
// 		Use bullet points or numbered lists for steps, options, or key points.
// 		Ensure each paragraph focuses on one main idea.

// 		Tone and Engagement:
// 		Write in a neutral, conversational tone (avoid formal or academic language).
// 		Address the reader directly with "you" or "we" where appropriate.
// 		Use consistent terms for concepts (avoid synonyms that may confuse).

// 		Avoid Exclusionary Elements:
// 		Remove jargon, acronyms (unless defined), and expand abbreviations if needed (example: "ASAP" → "as soon as possible").
// 		Eliminate metaphors, idioms, or implied meanings (example: "hit the books" → "study").
// 		Avoid double negatives (example: "not uncommon" → "common").

// 		Structural Support:
// 		Add clear headings to label sections (example: "How to Apply for Benefits").
// 		Use formatting tools like bold for key terms or warnings.
// 		Chunk information into short paragraphs with line breaks for visual ease.

// 		Inclusivity Checks:
// 		Ensure content is free of bias, stereotypes, or assumptions about the reader.
// 		Use gender-neutral language (example: "they" instead of "he/she").


// 		Output Requirements:
// 		Return only the simplified text, without markdown, emojis, or images.
// 		Preserve original context, facts, and intent. Do not omit critical details.
// 		Prioritize clarity over brevity; focus on simplification and not summarization. The length of generated output text should be same or similar to that of input text.
// 		Do not simplify already simple text.

// 		Example Transformation:
// 		Original: "Individuals experiencing adverse climatic conditions may necessitate relocation to mitigate health risks."
// 		Simplified: "If weather conditions become dangerous, people might need to move to stay safe."

// 		For the provided input text, apply the above guidelines rigorously. Ensure the output is accessible to readers with varied cognitive abilities, emphasizing clarity, simplicity, and logical structure. Verify that the simplified text aligns with plain language standards like WCAG and PlainLanguage.gov.

// 		"${inputText}"
// 		`;
// 		  }, [inputWordCount, outputLength, customWordCount, structurePrefs, tonePreference]);

//   const splitTextIntoChunks = (text, maxTokens) => {
// 	const words = text.split(" ");
// 	let chunks = [];
// 	let currentChunk = [];
  
// 	for (let word of words) {
// 	  if (currentChunk.join(" ").length + word.length < maxTokens) {
// 		currentChunk.push(word);
// 	  } else {
// 		chunks.push(currentChunk.join(" "));
// 		currentChunk = [word];
// 	  }
// 	}
// 	if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));
// 	return chunks;
//   };


//   const handleSubmit = async () => {

// 	// const inputText = document.getElementById('inputText').value;
// 	const trimmedInput = inputText.trim();
// 	if (!trimmedInput) return;

// 	// inputTextSnapshot.current = inputText; 
// 	setIsLoading(true);
  
// 	try {
// 	  const chunks = splitTextIntoChunks(trimmedInput, 10000);
// 	  let combinedOutput = "";
  
// 	  for (let chunk of chunks) {
// 		const prompt = generatePrompt(chunk);
// 		const response = await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4", {
// 		  method: "POST",
// 		  headers: { "Content-Type": "application/json" },
// 		  body: JSON.stringify({ prompt }),
// 		});
		
// 		if (!response.ok) {
// 			console.error(`API request failed with status: ${response.status}`);
// 			continue; // Skip this chunk if the API request failed
// 		  }

// 		const data = await response.json();
// 		console.log("Full API Response: ", data);


// 		const data1 = data?.response?.replace(/^"|"$/g, "") || "No response received."; // Append results
// 		combinedOutput += data1 + " ";
// 	}
// 	  console.log("Final Combined Output: ", combinedOutput);

// 	console.log("Data: ", combinedOutput);

// 	const cleanedResponse = combinedOutput.trim();
// 	setOutputText(cleanedResponse);
// 	setIsSubmitted(true);

// 	await saveInitialSimplification(trimmedInput, cleanedResponse);
// 	navigate("/review", { state: { inputText: trimmedInput, outputText: cleanedResponse } });
// 	// navigate("/review", { state: { inputText: trimmedInput, outputText: cleanedResponse } });
	
// 	} catch (error) {
// 	  console.error("Error fetching GPT-4o response:", error);
// 	  setOutputText("An error occurred while simplifying the text.");
// 	}
  
// 	setIsLoading(false);
//   };

  

//   return (
//     <>
//       <nav className={styles.navbar}>
//         {/* <h1>Text Simplification Tool</h1> */}
// 		<h1 
//     onClick={() => window.location.href = "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/"}
//     style={{ cursor: "pointer" }} // Makes it look clickable
//  		>
// 		Text Simplification Tool</h1>
//         <button className={styles.white_btn} onClick={handleLogout}>
//           Logout
//         </button>
//       </nav>

// 	  <div className={styles.container}>

// 			 <div
// 				  className={`${styles.sidebar} ${
// 					isSidebarVisible ? styles.expanded : ""
// 				  }`}
// 				>

// 			{/* </div> */}

// 			<button
// 			className={styles.historyIcon}
// 			onClick={() => setIsSidebarVisible(!isSidebarVisible)}
// 			>
// 				🕒   <p style={{ fontSize: "15px" }}> History </p> 
// 			</button>



//           {isSidebarVisible && (
//             <div className={styles.historyContent}>
//               <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>
//                 ✖
//               </button>
//               <ul className={styles.historyList}>
//                 {documents.map((doc, index) => (
    
// 				<li
// 				key={doc._id}
// 				onClick={() => handleDocumentClick(doc)}
// 				className={`${styles.historyItem} ${selectedDocument?._id === doc._id ? styles.activeDoc : ""}`}
// 				>
// 				{/* <strong>Document {index + 1}</strong>  */}
// 				<strong>Document {documents.length - index}</strong>({doc.inputText.substring(0, 20)}...)
// 				</li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>

// 	  {/* <div className={styles.main_container}> */}
	  
// 	  <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
         


// 			<div className={styles.description}>

// 			  <p>
// 			  This tool helps make complex text easier to read while preserving its original meaning. Whether you're simplifying academic content, technical documents, or general text for better accessibility, this tool provides a quick and efficient way to generate a more readable version. You can enter text manually or upload a document to get started.
// 			  </p>
// 	</div>

// 	        {/* ─── CUSTOMISATION PANEL  ─────────── */}
// 			<section className={styles.customPanel}>
// 			  {/* toggle row */}
// 			  <button
// 				className={styles.customToggle}
// 				onClick={() => setShowCustom((s) => !s)}
// 			  >
// 				{showCustom ? "▲  Hide Customisation Options" : "▼  Show Customisation Options"}
// 			  </button>

			 
// 			  <div className={`${styles.customPanel} ${showCustom ? "" : styles.hiddenPanel}`}>
// 				<div className={styles.customBody}>
				  
// 				  {/* 1. OUTPUT LENGTH SECTION */}
// 				  <h3>Output Length</h3>
// 				  <div className={styles.sliderContainer}>
// 					{/* Visual slider representation */}
// 					<div className={styles.sliderTrack}>
// 					  <div className={styles.sliderMarkers}>
// 						<span className={outputLength === "same" ? styles.activeMarker : styles.marker}>•</span>
// 						<span className={outputLength === "shorter" ? styles.activeMarker : styles.marker}>•</span>
// 						<span className={outputLength === "much_shorter" ? styles.activeMarker : styles.marker}>•</span>
// 					  </div>
// 					  <div className={styles.sliderLabels}>
// 						<span>Same as input</span>
// 						<span>Shorter</span>
// 						<span>Much shorter</span>
// 					  </div>
// 					</div>
					
// 					{/* Radio buttons for selection */}
// 					<div className={styles.lengthOptions}>
// 					  <label className={styles.lengthOption}>
// 						<input 
// 						  type="radio" 
// 						  name="outputLength" 
// 						  value="same"
// 						  checked={outputLength === "same"}
// 						  onChange={(e) => setOutputLength(e.target.value)}
// 						/>
// 						<span>Same as input ({inputWordCount} words)</span>
// 					  </label>
					  
// 					  <label className={styles.lengthOption}>
// 						<input 
// 						  type="radio" 
// 						  name="outputLength" 
// 						  value="shorter"
// 						  checked={outputLength === "shorter"}
// 						  onChange={(e) => setOutputLength(e.target.value)}
// 						/>
// 						<span>Shorter (~{Math.round(inputWordCount * 0.75)} words - 25% less)</span>
// 					  </label>
					  
// 					  <label className={styles.lengthOption}>
// 						<input 
// 						  type="radio" 
// 						  name="outputLength" 
// 						  value="much_shorter"
// 						  checked={outputLength === "much_shorter"}
// 						  onChange={(e) => setOutputLength(e.target.value)}
// 						/>
// 						<span>Much shorter (~{Math.round(inputWordCount * 0.5)} words - 50% less)</span>
// 					  </label>
					  
// 					  <label className={styles.lengthOption}>
// 						<input 
// 						  type="radio" 
// 						  name="outputLength" 
// 						  value="custom"
// 						  checked={outputLength === "custom"}
// 						  onChange={(e) => setOutputLength(e.target.value)}
// 						/>
// 						<span>Custom: </span>
// 						<input
// 						  type="number"
// 						  min="10"
// 						  placeholder="Enter word count"
// 						  value={customWordCount}
// 						  onChange={(e) => setCustomWordCount(e.target.value)}
// 						  disabled={outputLength !== "custom"}
// 						  style={{ width: "100px", marginLeft: "8px" }}
// 						/>
// 						<span> words</span>
// 					  </label>
// 					</div>
// 				  </div>

// 				  {/* 2. STRUCTURE & WRITING PREFERENCES */}
// 				  <h3>Structure & Writing Preferences</h3>
// 				  <div className={styles.structurePrefs}>
					
// 					{/* Organization & Structure */}
// 					<div className={styles.prefSection}>
// 					  <h4>Organization & Structure</h4>
					  
// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.sectionHeadings}
// 						  onChange={() => toggleStructurePref('sectionHeadings')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Section headings</strong> - Add headings to organise sections
// 						  <small className={styles.reference}>WCAG 2.2 & Easy-Read guidelines</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.bulletLists}
// 						  onChange={() => toggleStructurePref('bulletLists')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Bullet/numbered lists</strong> - Use bullet points for lists and steps
// 						  <small className={styles.reference}>Nielsen Norman Group: lists improve comprehension</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.shortParagraphs}
// 						  onChange={() => toggleStructurePref('shortParagraphs')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Short paragraphs</strong> - Maximum 2-3 sentence paragraphs
// 						  <small className={styles.reference}>Easy-Read conventions: ≤ 2 sentences per paragraph</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.addWhiteSpace}
// 						  onChange={() => toggleStructurePref('addWhiteSpace')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>White space between ideas</strong> - Add visual breaks for easier reading
// 						  <small className={styles.reference}>Improves scannability and reduces cognitive load</small>
// 						</span>
// 					  </label>
// 					</div>

// 					{/* Sentence Structure */}
// 					<div className={styles.prefSection}>
// 					  <h4>Sentence Structure</h4>
					  
// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.sentenceSplitting}
// 						  onChange={() => toggleStructurePref('sentenceSplitting')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Break long sentences</strong> - Split sentences longer than 10-15 words
// 						  <small className={styles.reference}>Readable.com & PlainLanguage.gov guidelines</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.activeVoice}
// 						  onChange={() => toggleStructurePref('activeVoice')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Active voice</strong> - Convert passive to active voice
// 						  <small className={styles.reference}>Minimal Text Complexity Guidelines</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.avoidNestedClauses}
// 						  onChange={() => toggleStructurePref('avoidNestedClauses')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Simplify nested clauses</strong> - Break complex sentence structures
// 						  <small className={styles.reference}>Reduces processing difficulty for readers</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.clearPronouns}
// 						  onChange={() => toggleStructurePref('clearPronouns')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Clear pronoun references</strong> - Avoid ambiguous "they," "it," "this"
// 						  <small className={styles.reference}>Prevents confusion about what pronouns refer to</small>
// 						</span>
// 					  </label>
// 					</div>

// 					{/* Vocabulary & Clarity */}
// 					<div className={styles.prefSection}>
// 					  <h4>Vocabulary & Clarity</h4>
					  
// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.useEverydayLanguage}
// 						  onChange={() => toggleStructurePref('useEverydayLanguage')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Use everyday language</strong> - Replace complex words with simple alternatives
// 						  <small className={styles.reference}>Core principle of plain language</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.defineComplexTerms}
// 						  onChange={() => toggleStructurePref('defineComplexTerms')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Define complex terms</strong> - Add simple explanations in parentheses
// 						  <small className={styles.reference}>e.g., "cardiologist (heart doctor)"</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.expandAcronyms}
// 						  onChange={() => toggleStructurePref('expandAcronyms')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Expand acronyms</strong> - Write out abbreviated terms
// 						  <small className={styles.reference}>e.g., "ASAP" → "as soon as possible"</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.avoidJargon}
// 						  onChange={() => toggleStructurePref('avoidJargon')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Remove jargon</strong> - Eliminate technical or specialized language
// 						  <small className={styles.reference}>Makes content accessible to general audiences</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.avoidIdioms}
// 						  onChange={() => toggleStructurePref('avoidIdioms')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Avoid idioms & metaphors</strong> - Replace with literal language
// 						  <small className={styles.reference}>e.g., "hit the books" → "study"</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.avoidDoubleNegatives}
// 						  onChange={() => toggleStructurePref('avoidDoubleNegatives')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Eliminate double negatives</strong> - Use positive statements
// 						  <small className={styles.reference}>e.g., "not uncommon" → "common"</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.consistentTerms}
// 						  onChange={() => toggleStructurePref('consistentTerms')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Use consistent terms</strong> - Avoid synonyms that may confuse
// 						  <small className={styles.reference}>Reduces cognitive load for readers</small>
// 						</span>
// 					  </label>
// 					</div>

// 					{/* Engagement & Formatting */}
// 					<div className={styles.prefSection}>
// 					  <h4>Engagement & Formatting</h4>
					  
// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.directAddress}
// 						  onChange={() => toggleStructurePref('directAddress')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Direct address</strong> - Use "you" or "we" to engage readers
// 						  <small className={styles.reference}>Creates conversational, accessible tone</small>
// 						</span>
// 					  </label>

// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.boldKeyTerms}
// 						  onChange={() => toggleStructurePref('boldKeyTerms')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Highlight key terms</strong> - Use bold for important words and warnings
// 						  <small className={styles.reference}>Aids scanning and comprehension</small>
// 						</span>
// 					  </label>
// 					</div>

// 					{/* Special Features */}
// 					<div className={styles.prefSection}>
// 					  <h4>Review Features</h4>
					  
// 					  <label className={styles.structureOption}>
// 						<input
// 						  type="checkbox"
// 						  checked={structurePrefs.showChanges}
// 						  onChange={() => toggleStructurePref('showChanges')}
// 						/>
// 						<span className={styles.optionText}>
// 						  <strong>Show changes while writing</strong> - Toggle above AI-generated text box
// 						  <small className={styles.reference}>Useful for reviewing what was changed</small>
// 						</span>
// 					  </label>
// 					</div>
// 				  </div>

// 				  {/* 3. TONE PREFERENCES */}
// 				  <h3>Tone Preferences</h3>
// 				  <div className={styles.toneOptions}>
// 					{[
// 					  { value: "neutral", label: "Neutral", default: true },
// 					  { value: "academic", label: "Academic" },
// 					  { value: "formal", label: "Formal" },
// 					  { value: "creative", label: "Creative" }
// 					].map((tone) => (
// 					  <label key={tone.value} className={styles.toneOption}>
// 						<input
// 						  type="radio"
// 						  name="tonePreference"
// 						  value={tone.value}
// 						  checked={tonePreference === tone.value}
// 						  onChange={(e) => setTonePreference(e.target.value)}
// 						/>
// 						<span>{tone.label} {tone.default && "<By default>"}</span>
// 					  </label>
// 					))}
// 				  </div>
				  
// 				</div>
// 			  </div>
// 			</section>

// 			{/*  */}

// 				  <div className={styles.form_container}>
// 					{/* Input Area */}
// 					<div className={styles.input_area}>
// 					  <div className={styles.text_container}>
// 						<label className={styles.label} htmlFor="inputText">
// 						  Input Text
// 						</label>
// 						<textarea
// 						  id="inputText"
// 						  className={`${styles.textarea} ${isLoading ? styles.disabled : ""}`}
// 						//   className={styles.textarea}
// 						  placeholder="Write/Paste your text here or upload a PDF document to extract content automatically."
// 						  value={inputText}
// 						  onChange={(e) => setInputText(e.target.value)}
// 						  disabled={isLoading} // Disable input when loading
// 						></textarea>
					 
// 					 <p className={styles.countText}>Words: {inputWordCount} | Characters: {inputCharCount}
// 					 {pdfPageCount > 0 && ` | Pages: ${pdfPageCount}`}
// 					 </p>
						
// 					  </div>
	  
// 					  {/* OR Divider */}
// 					  <div className={styles.or_divider}>OR</div>
	  
// 					  {/* File Upload */}
// 					  <div className={`${styles.upload_area} ${isLoading ? styles.disabled : ""}`}
// 						onDragOver={(e) => e.preventDefault()} // Prevent default behavior
// 						onDrop={(e) => {
// 							e.preventDefault();
// 							const file = e.dataTransfer.files[0]; // Get the first dropped file
// 							if (file) {
// 							handleFileUpload({ target: { files: [file] } }); // Simulate file selection event
// 							}
// 						}}>
// 						<label htmlFor="fileUpload" className={styles.upload_box}>
							
// 							{isUploading ? (
// 								<span className={styles.loadingText}>Extracting text, please wait...</span>
// 								) : uploadedFileName ? (
// 								<>
// 									File uploaded: <strong>{uploadedFileName}</strong>
// 								</>
// 								) : (
// 								<>
// 									Click to Upload a PDF
// 									<br />
// 									<span>...or drag and drop a file.</span>
// 								</>
// 							)}
				
// 						</label>
// 						<input
// 						  type="file"
// 						  id="fileUpload"
// 						  accept="application/pdf"
// 						  onChange={handleFileUpload}
// 						  className={styles.hidden_input}
// 						  disabled={isUploading || isLoading} // Disable upload while processing
// 						  //disabled={isUploading} // Disable upload while processing
// 						/>
// 					  </div>
// 					</div>
// 				  </div>
// 				  {/* Submit Button */}
// 				  <button
// 					className={styles.submit_btn}
// 					onClick={handleSubmit}
// 					disabled={!inputText.trim() || isLoading || isUploading}
// 					id="simplifyBtn"
// 					//title={!inputText.trim() ? "Enter text or upload a file to enable simplification." : ""}
// 				  >
// 					{isLoading ? "Processing..." : "Simplify Text"}
// 				  </button>
		
// 				  <p className={styles.help_text}>Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a></p>
// 				  <Footer />  
// 		      </div>

// 		      </div>
			  
// 		    </>
// 		  );
// 		};

// 		export default Main;


// v3

import React, { useState, useEffect, useRef, useCallback  } from "react";
import styles from "./styles.module.css";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
// import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import Footer from "../Footer";
import { calcMetrics } from "../../utils/textMetrics";
import StatsButton from "../StatsButton";

pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.mjs`;

const prefsToPlain = (
  inputWordCount,
  outputLength,
  prefs,
  tone,
  additionalInstructions,
) => {
  const sections = [];

  // Calculate target word count based on slider selection
  const lengthRatios = {
    very_simple: 0.4,
    much_shorter: 0.5,
    shorter: 0.75,
    same: 1.0,
  };
  const ratio = lengthRatios[outputLength] ?? 1.0;
  const target = Math.round(inputWordCount * ratio);
  if (outputLength !== "same") {
    sections.push(`• Limit output to about **${target} words**.`);
  }

  // Structure and formatting
  if (prefs.sectionHeadings) {
    sections.push("• Add clear section headings.");
  } else {
    sections.push("• Do not add section headings.");
  }
  if (prefs.bulletLists) {
    sections.push("• Use bullet points or numbered lists for steps and key points.");
  } else {
    sections.push("• Avoid using bullet points or numbered lists.");
  }
  if (prefs.shortParagraphs) {
    sections.push("• Keep paragraphs to 2–3 sentences.");
  } else {
    sections.push("• Paragraph length may remain as in the original text.");
  }

  // Sentence style
  if (prefs.breakLongSentences) {
    sections.push("• Break long sentences into shorter ones.");
  } else {
    sections.push("• Preserve original sentence lengths when possible.");
  }
  if (prefs.activeVoice) {
    sections.push("• Use active voice instead of passive.");
  } else {
    sections.push("• Passive voice is acceptable.");
  }
  if (prefs.simplifyClauses) {
    sections.push("• Simplify nested clauses and complex sentence structures.");
  } else {
    sections.push("• Do not simplify nested clauses.");
  }

  // Vocabulary and clarity
  if (prefs.useSimpleLanguage) {
    sections.push("• Replace complex words with simple, everyday language.");
  } else {
    sections.push("• Keep original vocabulary complexity.");
  }
  if (prefs.defineTerms) {
    sections.push("• Define unavoidable complex terms in parentheses.");
  } else {
    sections.push("• Do not define complex terms.");
  }
  if (prefs.expandAcronyms) {
    sections.push("• Expand acronyms and abbreviations.");
  } else {
    sections.push("• Leave acronyms and abbreviations unchanged.");
  }
  if (prefs.avoidJargon) {
    sections.push("• Avoid jargon, idioms, and culturally specific references.");
  } else {
    sections.push("• Keep original jargon and idioms.");
  }

  // Tone
  if (tone && tone !== "neutral") {
    sections.push(`• Use a **${tone}** tone while maintaining accessibility.`);
  }

  // Additional user instructions
  if (additionalInstructions && additionalInstructions.trim().length > 0) {
    sections.push(`• ${additionalInstructions.trim()}`);
  }

  return sections.join("\n");
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
	const [showCustom,  setShowCustom]  = useState(false);  

	const inputTextSnapshot = useRef("");
	const [pdfPath, setPdfPath] = useState(""); 

	 // Output length

  const lengthOptions = ["same", "shorter", "much_shorter", "very_simple"];

  const [outputLength, setOutputLength] = useState("same");

  const [customWordCount, setCustomWordCount] = useState("");


  const [prefs, setPrefs] = useState({
	// Structure & Formatting
	sectionHeadings: true,
	bulletLists: true,
	shortParagraphs: true,
	// Sentence Style
	breakLongSentences: true,
	activeVoice: true,
	simplifyClauses: true,
	// Vocabulary & Clarity
	useSimpleLanguage: true,
	defineTerms: true,
	expandAcronyms: true,
	avoidJargon: true,
  });

  const [tonePreference, setTonePreference] = useState("neutral");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  // Toggle a preference on/off
  const togglePref = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

	// Helper function to calculate word counts based on input
	const calculateWordCount = (inputWordCount, type) => {
	  switch(type) {
		case "shorter": return Math.round(inputWordCount * 0.75);
		case "much_shorter": return Math.round(inputWordCount * 0.5);
		case "custom": return customWordCount;
		default: return inputWordCount;
	  }
	};



  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/Login"); 
  };

    // Load user's past documents (original texts only)
	useEffect(() => {
		if (!email) return;
	
		const fetchDocuments = async () => {
		  try {
			const response = await fetch(
			  `https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/user/${email}`
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

			await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications", {
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

  const generatePrompt = useCallback(
	(chunk) => {
	  const prefsText = prefsToPlain(
		inputWordCount,
		outputLength,
		prefs,
		tonePreference,
		additionalInstructions,
	  );
	  return `You are an expert in accessible communication.\n\n### USER‑SPECIFIC CUSTOMISATIONS\n${prefsText}\n\n Transform the input into clear, accessible language without losing information. Keep the length similar to the original and avoid hallucinations.\n\n"${chunk}"`;
	},
	[inputWordCount, outputLength, prefs, tonePreference, additionalInstructions],
  );

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
		const response = await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4", {
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
		  <h1
			onClick={() => (window.location.href = "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/")}
			style={{ cursor: "pointer" }}
		  >
			Text Simplification Tool
		  </h1>
		  <button className={styles.white_btn} onClick={handleLogout}>
			Logout
		  </button>
		</nav>
		<div className={styles.container}>
		  {/* Sidebar for document history */}
		  <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
			<button
			  className={styles.historyIcon}
			  onClick={() => setIsSidebarVisible(!isSidebarVisible)}
			>
			  🕒 <p style={{ fontSize: "15px" }}>History</p>
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
					  <strong>Document {documents.length - index}</strong>(
					  {doc.inputText.substring(0, 20)}...)
					</li>
				  ))}
				</ul>
			  </div>
			)}
		  </div>
		  {/* Main content area */}
		  <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
			<div className={styles.description}>
			  <p>
				This tool helps make complex text easier to read while preserving its original meaning.
				Enter text manually or upload a PDF to get started. You can customise the simplification
				guidelines below.
			  </p>
			</div>
			{/* Customisation panel */}
			<section className={styles.customPanel}>
			  <button className={styles.customToggle} onClick={() => setShowCustom((s) => !s)}>
				{showCustom ? "▲ Hide Customisation Options" : "▼ Show Customisation Options"}
			  </button>
			  {showCustom && (
				<div className={styles.customBody}>
				  {/* Output length slider */}
				  <h3>Output Length</h3>
				  <input
					type="range"
					min="0"
					max={lengthOptions.length - 1}
					value={lengthOptions.indexOf(outputLength)}
					onChange={(e) => setOutputLength(lengthOptions[e.target.value])}
					className={styles.sliderInput}
				  />
				  <div className={styles.sliderLabels}>
					{/* Ensure the order matches the slider positions */}
					<span>Very simple</span>
					<span>Much shorter</span>
					<span>Shorter</span>
					<span>Same</span>
				  </div>
				  {/* Structure & Formatting */}
				  <h3>Structure & Formatting</h3>
				  {[
					{ key: "sectionHeadings", label: "Section headings" },
					{ key: "bulletLists", label: "Bullet/numbered lists" },
					{ key: "shortParagraphs", label: "Short paragraphs" },
				  ].map((opt) => (
					<label key={opt.key} className={styles.structureOption}>
					  <input
						type="checkbox"
						checked={prefs[opt.key]}
						onChange={() => togglePref(opt.key)}
					  />
					  <span>{opt.label}</span>
					</label>
				  ))}
				  {/* Sentence Style */}
				  <h3>Sentence Style</h3>
				  {[
					{ key: "breakLongSentences", label: "Break long sentences" },
					{ key: "activeVoice", label: "Active voice" },
					{ key: "simplifyClauses", label: "Simplify nested clauses" },
				  ].map((opt) => (
					<label key={opt.key} className={styles.structureOption}>
					  <input
						type="checkbox"
						checked={prefs[opt.key]}
						onChange={() => togglePref(opt.key)}
					  />
					  <span>{opt.label}</span>
					</label>
				  ))}
				  {/* Vocabulary & Clarity */}
				  <h3>Vocabulary & Clarity</h3>
				  {[
					{ key: "useSimpleLanguage", label: "Use everyday language" },
					{ key: "defineTerms", label: "Define complex terms" },
					{ key: "expandAcronyms", label: "Expand acronyms" },
					{ key: "avoidJargon", label: "Avoid jargon & idioms" },
				  ].map((opt) => (
					<label key={opt.key} className={styles.structureOption}>
					  <input
						type="checkbox"
						checked={prefs[opt.key]}
						onChange={() => togglePref(opt.key)}
					  />
					  <span>{opt.label}</span>
					</label>
				  ))}
				  {/* Tone preferences */}
				  <h3>Tone Preference</h3>
				  <div className={styles.toneOptions}>
					{[
					  { value: "neutral", label: "Neutral (default)" },
					  { value: "formal", label: "Professional/Formal" },
					  { value: "academic", label: "Academic/Instructional" },
					  { value: "casual", label: "Casual/Conversational" },
					  { value: "creative", label: "Creative/Enthusiastic" },
					].map((tone) => (
					  <label key={tone.value} className={styles.toneOption}>
						<input
						  type="radio"
						  name="tonePreference"
						  value={tone.value}
						  checked={tonePreference === tone.value}
						  onChange={(e) => setTonePreference(e.target.value)}
						/>
						<span>{tone.label}</span>
					  </label>
					))}
				  </div>
				  {/* Additional instructions */}
				  <h3>Additional Instructions</h3>
				  <textarea
					className={styles.textarea}
					placeholder="Enter any additional instructions or context here..."
					value={additionalInstructions}
					onChange={(e) => setAdditionalInstructions(e.target.value)}
					rows={3}
				  ></textarea>
				</div>
			  )}
			</section>
			{/* Input area and upload */}
			<div className={styles.form_container}>
			  <div className={styles.input_area}>
				<div className={styles.text_container}>
				  <label className={styles.label} htmlFor="inputText">
					Input Text
				  </label>
				  <textarea
					id="inputText"
					className={`${styles.textarea} ${isLoading ? styles.disabled : ""}`}
					placeholder="Write/Paste your text here or upload a PDF document to extract content automatically."
					value={inputText}
					onChange={(e) => setInputText(e.target.value)}
					disabled={isLoading}
				  ></textarea>
				  <p className={styles.countText}>
					Words: {inputWordCount} | Characters: {inputCharCount}
					{pdfPageCount > 0 && ` | Pages: ${pdfPageCount}`}
				  </p>
				</div>
				<div className={styles.or_divider}>OR</div>
				<div
				  className={`${styles.upload_area} ${isLoading ? styles.disabled : ""}`}
				  onDragOver={(e) => e.preventDefault()}
				  onDrop={(e) => {
					e.preventDefault();
					const file = e.dataTransfer.files[0];
					if (file) handleFileUpload({ target: { files: [file] } });
				  }}
				>
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
					disabled={isUploading || isLoading}
				  />
				</div>
			  </div>
			</div>
			<button
			  className={styles.submit_btn}
			  onClick={handleSubmit}
			  disabled={!inputText.trim() || isLoading || isUploading}
			  id="simplifyBtn"
			>
			  {isLoading ? "Processing..." : "Simplify Text"}
			</button>
			<p className={styles.help_text}>
			  Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a>
			</p>
			<Footer />
		  </div>
		</div>
	  </>
	);

		};

		export default Main;
