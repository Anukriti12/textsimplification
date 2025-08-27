// import React, { useState, useEffect, useRef  } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import { FaRegCopy, FaDownload } from "react-icons/fa"; // Import FontAwesome icons
// import { saveAs } from "file-saver";
// import styles from "./styles.module.css";

// const Review = () => {


//   const { state } = useLocation();
//   const { inputText, outputText: initialOutputText, editHistory: restoredEditHistory } = state || {
//     inputText: "",
//     outputText: "",
//     editHistory: [],
//   };

//   const [outputText, setOutputText] = useState(initialOutputText);
//   const [editHistory, setEditHistory] = useState(restoredEditHistory || []);
//   const [saveHistory, setSaveHistory] = useState([]);


//   const [diffHtml, setDiffHtml] = useState("");
//   const [isSaveButtonEnabled, setIsSaveButtonEnabled] = useState(false);
//   const navigate = useNavigate();


//   const [isEditable, setIsEditable] = useState(false);
//   const [isSidebarVisible, setIsSidebarVisible] = useState(false);
//   const [showDifference, setShowDifference] = useState(false);

//   const [inputWordCount, setInputWordCount] = useState(0);
//   const [inputCharCount, setInputCharCount] = useState(0);

//   const [outputWordCount, setOutputWordCount] = useState(0);
//   const [outputCharCount, setOutputCharCount] = useState(0);



// //   const navigate = useNavigate();


//   const [isHistoryVisible, setIsHistoryVisible] = useState(false); // Show/Hide history sidebar
//   const contentEditableRef = useRef(null); // Reference to the contentEditable div


// 	const [isLoading, setIsLoading] = useState(false);

// 	const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);
// 	const [showSurveyPrompt, setShowSurveyPrompt] = useState(false); // State for survey prompt

//   const surveyRef = useRef(null);

//   const user = JSON.parse(localStorage.getItem("user"));
//   const email = user?.email;

//   const [documents, setDocuments] = useState([]);
//   const [selectedDocument, setSelectedDocument] = useState(null);
//   const [selectedVersion, setSelectedVersion] = useState(null);
//   const [selectedVersionIndex, setSelectedVersionIndex] = useState(0); 
//   const [expandedDocs, setExpandedDocs] = useState({});

//   const [liveEditedText, setLiveEditedText] = useState(initialOutputText);
//   // const contentEditableRef = useRef(null);

//   // const [outputText, setOutputText] = useState("");


//     const handleLogout = () => {
//     localStorage.removeItem("token");
// 	navigate("/Login"); 

//   localStorage.removeItem("reviewPageState"); // Clear the saved state

//    // window.location.reload();
//   };

//   const countWordsAndChars = (text) => {
//     const words = text.trim().split(/\s+/).filter(Boolean).length;
//     const chars = text.length;
//     return { words, chars };
//   };
  
//       // Function to calculate and render diff
//   // const generateDiff = (input, output) => {
//   //       const dmp = new DiffMatchPatch();
//   //       const diffs = dmp.diff_main(input, output);
//   //       dmp.diff_cleanupSemantic(diffs); // Optional cleanup for better readability
//   //       return dmp.diff_prettyHtml(diffs);
//   //     };

//       const generateDiff = (input, output) => {
//         const dmp = new DiffMatchPatch();
//         const diffs = dmp.diff_main(input, output);
//         dmp.diff_cleanupSemantic(diffs);
      
//         const html = diffs
//           .map(([op, text]) => {
//             if (op === DiffMatchPatch.DIFF_INSERT) {
//               return `<span style="background-color: #d4fcdc; color: green;">${text}</span>`;
//             } else if (op === DiffMatchPatch.DIFF_DELETE) {
//               return `<span style="background-color: #ffecec; color: red; text-decoration: line-through;">${text}</span>`;
//             } else {
//               return `<span>${text}</span>`;
//             }
//           })
//           .join("");
      
//         return html;
//       };
      
    
// 	// Function to format the prompt with user input
//   const generatePrompt = (inputText) => {
//     return `
//     You are an expert in accessible communication, tasked with transforming complex text into clear, accessible plain language for individuals with Intellectual and Developmental Disabilities (IDD) or those requiring simplified content. Retain all essential information and intent while prioritizing readability, comprehension, and inclusivity.

//     Text simplification refers to rewriting or adapting text to make it easier to read and understand while keeping the same level of detail and precision. Make sure you focus on simplification and not summarization. The length of generated output text must be similar to that of input text.

//     Guidelines for Simplification:
//     Vocabulary and Terminology:
//     Replace uncommon, technical, or abstract words with simple, everyday language.
//     Define unavoidable complex terms in plain language within parentheses upon first use (example: “cardiologist (heart doctor)”).
//     Avoid idioms, metaphors, sarcasm, or culturally specific references.

//     Sentence Structure:
//     Use short sentences (10--15 words max). Break long sentences into 1–2 ideas each.
//     Prefer active voice (example: “The doctor examined the patient” vs. “The patient was examined by the doctor”).
//     Avoid nested clauses, passive voice, and ambiguous pronouns (example: “they,” “it”).

//     Clarity and Flow:
//     Organize content logically, using headings/subheadings to group related ideas.
//     Use bullet points or numbered lists for steps, options, or key points.
//     Ensure each paragraph focuses on one main idea.

//     Tone and Engagement:
//     Write in a neutral, conversational tone (avoid formal or academic language).
//     Address the reader directly with “you” or “we” where appropriate.
//     Use consistent terms for concepts (avoid synonyms that may confuse).

//     Avoid Exclusionary Elements:
//     Remove jargon, acronyms (unless defined), and expand abbreviations if needed (example: “ASAP” → “as soon as possible”).
//     Eliminate metaphors, idioms, or implied meanings (example: “hit the books” → “study”).
//     Avoid double negatives (example: “not uncommon” → “common”).

//     Structural Support:
//     Add clear headings to label sections (example: “How to Apply for Benefits”).
//     Use formatting tools like bold for key terms or warnings.
//     Chunk information into short paragraphs with line breaks for visual ease.

//     Inclusivity Checks:
//     Ensure content is free of bias, stereotypes, or assumptions about the reader.
//     Use gender-neutral language (example: “they” instead of “he/she”).


//     Output Requirements:
//     Return only the simplified text, without markdown, emojis, or images.
//     Preserve original context, facts, and intent. Do not omit critical details.
//     Prioritize clarity over brevity; focus on simplification and not summarization. The length of generated output text should be same or similar to that of input text.
//     Do not simplify already simple text.

//     Example Transformation:
//     Original: “Individuals experiencing adverse climatic conditions may necessitate relocation to mitigate health risks.”
//     Simplified: “If weather conditions become dangerous, people might need to move to stay safe.”

//     For the provided input text, apply the above guidelines rigorously. Ensure the output is accessible to readers with varied cognitive abilities, emphasizing clarity, simplicity, and logical structure. Verify that the simplified text aligns with plain language standards like WCAG and PlainLanguage.gov.

//     "${inputText}"
//     `;
//     };
  
//     const splitTextIntoChunks = (text, maxTokens) => {
//     const words = text.split(" ");
//     let chunks = [];
//     let currentChunk = [];
    
//     for (let word of words) {
//       if (currentChunk.join(" ").length + word.length < maxTokens) {
//       currentChunk.push(word);
//       } else {
//       chunks.push(currentChunk.join(" "));
//       currentChunk = [word];
//       }
//     }
//     if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));
//     return chunks;
//     };

//   const saveSimplification = async () => {
//     try {
//       const user = JSON.parse(localStorage.getItem("user"));
//       if (!user) return;


//     const numWordsInput = inputText.trim().split(/\s+/).filter(Boolean).length;
//     const numCharsInput = inputText.length;
//     const numWordsOutput = outputText.trim().split(/\s+/).filter(Boolean).length;
//     const numCharsOutput = outputText.length;

//       const response = await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           userId: user._id,
//           inputText,
//           outputText,
//           metrics: { numWordsInput, numCharsInput, numWordsOutput, numCharsOutput }

//         }),
//       });

//       if (response.ok) {
//         console.log("Simplification saved successfully.");
        
//       } else {
//         const error = await response.json();
//         console.error("Error saving simplification:", error.message);
//       }
//     } catch (error) {
//       console.error("Error saving simplification:", error);
//     }
//   };

//   // const handleLiveEdit = (e) => {
//   //   const updatedHTML = e.currentTarget.innerText; // Use innerText to avoid HTML tags
//   //   setLiveEditedText(updatedHTML);
  
//   //   const diffResult = generateDiff(initialOutputText, updatedHTML);
//   //   setDiffHtml(diffResult);
//   //   setIsSaveButtonEnabled(true);
//   // };




//   const handleResimplify = async () => {
//     if (!inputText.trim()) return;
  
//     setIsLoading(true); // Show loading state
  
//     try {

//       const chunks = splitTextIntoChunks(inputText, 10000);
//       let combinedOutput = "";
    
//       for (let chunk of chunks) {
//       const prompt = generatePrompt(chunk);
//       const response = await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ prompt }),
//       });
      
  
//       if (!response.ok) {
//         console.error("Error with API request:", response.status);
//         return;
//       }
  
//       const data = await response.json();
//       console.log("Full API Response: ", data);
//       const newOutput = data?.response?.replace(/^"|"$/g, "") || "No response received.";
  
//       // Update System-generated Text
//       combinedOutput += newOutput + " ";
//       console.log("Final Combined Output: ", combinedOutput);
    
//       }
//       setOutputText(combinedOutput);
//     } catch (error) {
//       console.error("Error fetching GPT-4o response:", error);
//       setOutputText("An error occurred while simplifying the text.");
//     }
  
//     setIsLoading(false);
//   };


  
//   //
//   const saveEditToHistory = async (editedText) => {
//     try {
//       const user = JSON.parse(localStorage.getItem("user"));
//       if (!user) return;

//       const numWords = editedText.trim().split(/\s+/).filter(Boolean).length;
//       const numChars = editedText.length;

//       const response = await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/edit", {
//         method: "PUT",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           email: user.email,
//           inputText,
//           editedText,
//           numWords,
//           numChars
//         }),
//       });

//       if (response.ok) {
//         console.log("Edit saved to history.");
//       } else {
//         const error = await response.json();
//         console.error("Error saving edit to history:", error.message);
//       }
//     } catch (error) {
//       console.error("Error saving edit to history:", error);
//     }
//   };

//   const saveFinalOutput = async () => {

//     // const finalText = contentEditableRef.current?.innerText || "";
//     // console.log("Final text to submit:", finalText);
//     // setOutputText(finalText);


//     setIsLoading(true);

//     try {
//       const user = JSON.parse(localStorage.getItem("user"));
//       if (!user) return;

//       const numWords = outputText.trim().split(/\s+/).filter(Boolean).length;
//       const numChars = outputText.length;
//       const finalText = document.getElementById("outputText")?.value || outputText;

//       const response = await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/save", {
//         method: "PUT",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           email: user.email,
//           inputText,
//           finalText: outputText,
//           numWords,
//           numChars,
//           readability: 4, // Example value, replace with user input
//           accuracy: 5, // Example value, replace with user input
//           comments: "Looks good." // Example value, replace with user input
//         }),
//       });

//     const timestamp = new Date().toISOString();
//     setEditHistory((prev) => [
//       ...prev,
//       { timestamp, text: finalText},
//     ]);

//       if (response.ok) {
//         console.log("Final output saved successfully.");
//         setIsSaveButtonEnabled(false); // Disable save button
//         setShowSurveyPrompt(true);    // Ensure survey prompt is displayed

//         // ✅ Automatically scroll to survey prompt
//         setTimeout(() => {
//             if (surveyRef.current) {
//                 surveyRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
//             }
//         }, 300);

//         const timestamp = new Date().toISOString();
//         setSaveHistory((prev) => [...prev, { timestamp, finalText: finalText}]); // 🔹 Save to history
  
//       } else {
//         const error = await response.json();
//         console.error("Error saving final output:", error.message);
//       }
//     } catch (error) {
//       console.error("Error saving final output:", error);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleEditChange = (event) => {
//     const updatedText = event.target.value;
//     setOutputText(updatedText);
//     setIsSaveButtonEnabled(true); // Enable save button on edit

//     // const timestamp = new Date().toISOString();
//     // setEditHistory((prev) => [
//     //   ...prev,
//     //   { timestamp, text: updatedText },
//     // ]);

//     // Save the change to edit history in MongoDB
//     saveEditToHistory(updatedText);
//   };

//   const handleCopy = (text) => {
//     navigator.clipboard.writeText(text).then(
//       () => {
//         alert("Copied to clipboard!");
//       },
//       (err) => {
//         console.error("Failed to copy text:", err);
//       }
//     );
//   };

//   const handleDownload = (text, filename, format) => {
//     const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
//     saveAs(blob, `${filename}.${format}`);
//   };

//   useEffect(() => {
//     if (!email) return;

//     const fetchDocuments = async () => {
//       try {
//         const response = await fetch(`https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/user/${email}`);
//         const result = await response.json();

//         if (response.ok) {

//           const sortedDocs = result.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//           setDocuments(sortedDocs);
//           if (!state && sortedDocs.length > 0) {
//             setSelectedDocument(sortedDocs[0]);
//             setSelectedVersion(sortedDocs[0].outputText);
//             setOutputText(sortedDocs[0].outputText);
//           }
//         } else {
//           console.error("Error fetching documents:", result.message);
//         }
//       } catch (error) {
//         console.error("Error fetching documents:", error);
//       }
//     };

//     fetchDocuments();
//   }, [email]);

//   const toggleExpandDoc = (docId) => {
//     setExpandedDocs((prev) => ({
//       ...prev,
//       [docId]: !prev[docId],
//     }));
//   };

//   const handleDocumentClick = (doc) => {
//     setSelectedDocument(doc);
//     setSelectedVersion(doc.outputText);
//     setOutputText(doc.outputText);
//     setSelectedVersionIndex(0);
//   };


//   const handleVersionChange = (docId, versionIndex) => {
//     const doc = documents.find((d) => d._id === docId);
//     if (!doc) return;

//     const selectedText =
//       versionIndex === "0"
//         ? doc.outputText
//         : doc.saveHistory[versionIndex - 1].finalText;

//     setSelectedVersion(selectedText);
//     setOutputText(selectedText);
//     setSelectedDocument(doc);
//     setSelectedVersionIndex(versionIndex);
//   };

    
//   useEffect(() => {
//     const reviewPageState = {
//       inputText,
//       outputText,
//       editHistory,
//     };
//     localStorage.setItem("reviewPageState", JSON.stringify(reviewPageState));
//   }, [outputText, editHistory, inputText]);
  
//   useEffect(() => {
//     const savedState = JSON.parse(localStorage.getItem("reviewPageState"));
//     if (savedState) {
//       setOutputText(savedState.outputText || "");
//       setEditHistory(savedState.editHistory || []);
//     } else {
//       setOutputText(initialOutputText);
//       setEditHistory(restoredEditHistory || []);
//     }
  
//     if (!localStorage.getItem("initialAIOutput")) {
//       localStorage.setItem("initialAIOutput", initialOutputText);
//     }

//    saveSimplification(); // Save the initial inputText and outputText
//     setIsSaveButtonEnabled(true);
//   }, [initialOutputText, restoredEditHistory]);
  


  
//   // useEffect(() => {
//   //   // Save initial input and output text in MongoDB
//   //   saveSimplification();
//   // }, []);
//   useEffect(() => {
//     const diffResult = generateDiff(inputText, outputText);
//     setDiffHtml(diffResult);
//    // saveSimplification();
//   }, [inputText, outputText]);

//   useEffect(() => {
//     saveSimplification(); 
//     setIsSaveButtonEnabled(true);

//     const savedState = JSON.parse(localStorage.getItem("reviewPageState"));
//     if (savedState) {
//       setOutputText(savedState.outputText || "");
//       setEditHistory(savedState.editHistory || []);
//     }
//   }, []);
  
//   useEffect(() => {
//     const { words: inputWords, chars: inputChars } = countWordsAndChars(inputText);
//     const { words: outputWords, chars: outputChars } = countWordsAndChars(outputText);
  
//     setInputWordCount(inputWords);
//     setInputCharCount(inputChars);
//     setOutputWordCount(outputWords);
//     setOutputCharCount(outputChars);
//   }, [inputText, outputText]);

  
//   const handleHistoryClick = (edit) => {
//     setOutputText(edit.text);
//     const diffResult = generateDiff(inputText, edit.text);
//     setDiffHtml(diffResult);
//     setIsEditable(false);
//   };


//   return (
//     <>
//       <nav className={styles.navbar}>
//         {/* <h1>Text Simplification Tool</h1> */}
//         <h1 
//     onClick={() => window.location.href = "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/"}
//     style={{ cursor: "pointer" }} // Makes it look clickable
//  		>
// 		Text Simplification Tool</h1>
//         <button className={styles.white_btn} onClick={handleLogout}>
//           Logout
//         </button>
//       </nav>

//       <div className={styles.container}>
//         {/* Sidebar */}
//         <div
//           className={`${styles.sidebar} ${
//             isSidebarVisible ? styles.expanded : ""
//           }`}
//         >
//           <button
//             className={styles.historyIcon}
//             onClick={() => setIsSidebarVisible(!isSidebarVisible)}
//           >
//              🕒   <p style={{ fontSize: "15px" }}> History </p> 
//           </button>

//         {isSidebarVisible && (
//             <div className={styles.historyContent}>
//               <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>✖</button>
//               <ul className={styles.historyList}>
//                 {documents.map((doc, index) => (
//                   <li key={doc._id} className={styles.historyItem}>
//                     {/* <div onClick={() => toggleExpandDoc(doc._id)} className={styles.docHeader}> */}
//                     <div
//                       // onClick={() => toggleExpandDoc(doc._id)}
//                       onClick={() => {
//                         toggleExpandDoc(doc._id);
//                         handleDocumentClick(doc);
//                       }}
//                       className={`${styles.docHeader} ${selectedDocument?._id === doc._id ? styles.activeDoc : ""}`}
//                     >

//                       {/* <strong>Document {index + 1}</strong>  */}
//                       <strong>Document {documents.length - index}</strong> ({doc.inputText.substring(0, 20)}..., {new Date(doc.createdAt).toLocaleDateString()})
//                     </div>

//                     {expandedDocs[doc._id] && (
//                       <ul className={styles.versionList}>
//                         <li key="0" onClick={() => handleVersionChange(doc._id, 0)} className={selectedVersionIndex === 0 && selectedDocument?._id === doc._id ? styles.activeVersion : ""}>
//                           Version 1 (Generated Text)
//                         </li>
//                         {doc.saveHistory.map((version, vIndex) => (
//                           <li
//                             key={vIndex + 1}
//                             onClick={() => handleVersionChange(doc._id, vIndex + 1)}
//                             className={selectedVersionIndex === vIndex + 1 && selectedDocument?._id === doc._id ? styles.activeVersion : ""}
//                           >
//                             Version {vIndex + 2} (Saved on {new Date(version.timestamp).toLocaleDateString()})
//                           </li>
//                         ))}
//                       </ul>
//                     )}
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         {/* <div className={styles.versionSelector}>
//           <label>Select Version:</label>
//           <select onChange={handleVersionChange} value={documents.indexOf(selectedDocument)}>
//             <option value="0">Version 1 (Generated Text)</option>
//             {selectedDocument?.saveHistory.map((version, index) => (
//               <option key={index + 1} value={index + 1}>
//                 Version {index + 2} (Saved on {new Date(version.timestamp).toLocaleDateString()})
//               </option>
//             ))}
//           </select>
//         </div> */}

//         </div>

//         {/* Main Content */}
//         <div
//           className={`${styles.mainContent} ${
//             isSidebarVisible ? styles.withSidebar : ""
//           }`}
//         >
// 			<div className={styles.description}>
// 			<p>
	
//         Please review the simplified text carefully and if needed, correct/edit it to suit your requirements. Once you are satisfied with your revisions, save the final version and complete the short survey to provide your feedback.
//       </p>
// 			</div>

// 			<div className={styles.textareas_container}>

//   {/* Input Text */}
//   <div className={styles.text_container}>
//     <div className={styles.labelWrapper}>
//       <label className={styles.label} htmlFor="inputText">
//         Input Text
//       </label>
//       <div className={styles.actions}>
//       <div
//         className={styles.copyIcon}
//         onClick={() => handleCopy(inputText)}
//         title="Copy to Clipboard"
//       >
        
//         📋 {/* Clipboard Emoji */}
//         </div>

//         <div
//         className={styles.copyIcon}
//         onClick={() => handleDownload(inputText, "InputText", "txt")}
//         title="Download as .txt file"
//       >
//         📥 {/* Download Icon */}
//       </div>

//             {/* New Re-simplify Button */}
//       <div
//         className={styles.copyIcon}
//         onClick={handleResimplify}
//         title="Re-simplify Text"
//         style={{ cursor: "pointer" }}
//       >
//         🔄 
//       </div>

//       </div>
//     </div>
//     <p className={styles.countText}>Words: {inputWordCount} | Characters: {inputCharCount}</p>
//     {/* <textarea id="inputText" className={styles.textarea} value={selectedDocument?.inputText || ""} readOnly></textarea> */}

//     <textarea
//       id="inputText"
//       className={`${styles.textarea} ${styles.side_by_side}`}
//       value={selectedDocument?.inputText || ""}
//       readOnly
//     ></textarea>
//   </div>

// 			{/* Output Text Box */}
// <div className={styles.text_container}>
//   <div className={styles.labelWrapper}>
//     <label className={styles.label} htmlFor="outputText">
//       AI-generated Text
//     </label>
//     <div className={styles.actions}>
//       <div
//         className={styles.copyIcon}
//         onClick={() => handleCopy(outputText)}
//         title="Copy to Clipboard"
//       >
//         📋 {/* Clipboard Emoji */}
//       </div>

//       <div
//         className={styles.copyIcon}
//         onClick={() => handleDownload(outputText, "GeneratedText", "txt")}
//         title="Download as .txt file"
//       >
//         📥 {/* Download Icon */}
//       </div>
//       <button
//         className={styles.toggleDiffBtn}
//         onClick={() => setShowDifference(!showDifference)}
//       >
//         {showDifference ? "Hide Difference with input text" : "Show Difference with input text"}
//       </button>
//     </div>
//   </div>
//     {/* Word and Character Count */}
//     <p className={styles.countText}>Words: {outputWordCount} | Characters: {outputCharCount}</p>

//   <textarea
//     id="outputText"
//     className={`${styles.output_box} ${styles.side_by_side}`}
//     value={outputText}
//     onChange={handleEditChange}
//     readOnly={isEditable}
//     placeholder="Output"

//   ></textarea>

//   {/* <div
//     ref={contentEditableRef}
//     contentEditable={!isEditable}
//     className={`${styles.output_box} ${styles.side_by_side} ${styles.editableDiv}`}
//     onInput={(e) => handleLiveEdit(e)}
//     dangerouslySetInnerHTML={{ __html: diffHtml }}
//   ></div> */}

// </div>

//             {/* Difference Text */}
// 			{showDifference && (
// 				<div className={styles.text_container}>
//           <div className={styles.labelWrapper}>
//             <label className={styles.label} htmlFor="outputText">
//               Difference from input text
//             </label>
//           </div>   
         
// 					<div
//             id="diffText"
//             className={`${styles.output_box} ${styles.side_by_side}`}
//             dangerouslySetInnerHTML={{ __html: diffHtml }}
// 					>
//           </div>
// 				 {/* )} */}
// 				</div>
// 			)}
			
// 			</div>



//           {/* Buttons */}
// 			<div className={styles.button_container}>

    
//     				{/* <button
//     					className={`${styles.save_btn} ${styles.text_btn}`}
//               onClick={saveFinalOutput}
//               disabled={!isSaveButtonEnabled || isLoading}
//               title={!isSaveButtonEnabled ? "Please make an edit before submitting." : ""}

//     				>
//     					Submit
//     				</button> */}

//             <button
//             className={styles.submit_btn}
//             onClick={saveFinalOutput}
//             disabled={!isSaveButtonEnabled || isLoading}
//             title={!isSaveButtonEnabled ? "Please make an edit before saving again." : ""}
//             >
//             Save
//             </button>
//       </div>

//   {/* Survey Prompt (Appears Only After Submitting) */}
//   {showSurveyPrompt && (
//     <div className={styles.survey_prompt} ref={surveyRef}>
//       <p className={styles.survey_text}>
//         Please take the survey to help us improve.
//         <button
//           className={styles.survey_btn}
//           onClick={() => {
//             const currentOutput = document.getElementById("outputText")?.value;
//             const initialAIOutput = localStorage.getItem("initialAIOutput") || initialOutputText;
//             const reviewPageState = { inputText, outputText: currentOutput, editHistory, saveHistory };
//             localStorage.setItem("reviewPageState", JSON.stringify(reviewPageState));

//             navigate("/survey", {
//               state: {
//                 email: JSON.parse(localStorage.getItem("user")).email,
//                 inputText,
//                 outputText: initialAIOutput,
//                 editHistory,
//                 saveHistory: [...saveHistory, { timestamp: new Date().toISOString(), finalText: currentOutput }],
//               },
//             });
//           }}
//         >
//           📑 Take the Survey
//         </button>
//       </p>
//     </div>
//   )}

// <p className={styles.help_text}>Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a></p>




//         </div>
//       </div>
//     </>
//   );
// };

// export default Review;

import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DiffMatchPatch from "diff-match-patch";
import { saveAs } from "file-saver";
import styles from "./styles.module.css";
import Footer from "../Footer";
import StatsButton from "../StatsButton";
// -----------------------------------------------------------------------------
// REVIEW PAGE – keeps input/output/version history perfectly in‑sync
// -----------------------------------------------------------------------------

const Review = () => {
  /* -------------------------------------------------------------------------
   * 1.  INITIAL NAVIGATION STATE
   * ---------------------------------------------------------------------- */
  const { state } = useLocation();
  const {
    inputText: navInputText = "",
    outputText: navOutputText = "",
    editHistory: restoredEditHistory = [],
  } = state || {};

  /* Local editable copies – we never mutate nav* directly */
  const [inputText, setInputText] = useState(navInputText);
  const [outputText, setOutputText] = useState(navOutputText);
  const initialOutputText = navOutputText; // still needed for survey redirect
  const [editHistory, setEditHistory] = useState(restoredEditHistory);
  const [saveHistory, setSaveHistory] = useState([]);

  /* UI‑state */
  const [diffHtml, setDiffHtml] = useState("");
  const [isSaveButtonEnabled, setIsSaveButtonEnabled] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showDifference, setShowDifference] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);

  /* Word / char counters */
  const [inputWordCount, setInputWordCount] = useState(0);
  const [inputCharCount, setInputCharCount] = useState(0);
  const [outputWordCount, setOutputWordCount] = useState(0);
  const [outputCharCount, setOutputCharCount] = useState(0);

  /*  Sidebar – docs & versions  */
  const [documents, setDocuments] = useState([]);
  // const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedDocId,       setSelectedDocId] = useState(null);
  const [selectedVersionIdx,  setSelectedVersionIdx]  = useState(0); 
  // const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  const [expandedDocs, setExpandedDocs] = useState({});

  /* Misc */
  const navigate = useNavigate();
  const surveyRef = useRef(null);
  const email = JSON.parse(localStorage.getItem("user"))?.email;


  /* -------------------------------------------------------------------------
   * 2.  HELPERS
   * ---------------------------------------------------------------------- */
  // const countWordsAndChars = (txt) => ({
  //   words: txt.trim().split(/\s+/).filter(Boolean).length,
  //   chars: txt.length,
  // });
  const countWordsAndChars = (txt = "") => {
    const safe = typeof txt === "string" ? txt : "";
    return {
      words: safe.trim().split(/\s+/).filter(Boolean).length,
      chars: safe.length,
    };
  };

  /** pretty diff → HTML */


  // ---------------------------------------------
// diff helper – now 100 % null‑safe
// ---------------------------------------------
const generateDiff = (a = "", b = "") => {
  const dmp   = new DiffMatchPatch();
  const diffs = dmp.diff_main(a ?? "", b ?? "");   // extra guard, just in case
  dmp.diff_cleanupSemantic(diffs);

  return diffs
    .map(([op, txt]) => {
      if (op === DiffMatchPatch.DIFF_INSERT)
        return `<span style="background:#d4fcdc;color:green;">${txt}</span>`;
      if (op === DiffMatchPatch.DIFF_DELETE)
        return `<span style="background:#ffecec;color:red;text-decoration:line-through;">${txt}</span>`;
      return txt;
    })
    .join("");
};

  /** chunker for long prompts */
  const splitTextIntoChunks = (txt, maxTokens) => {
    const words = txt.split(" ");
    const chunks = [];
    let chunk = [];
    words.forEach((w) => {
      if (chunk.join(" ").length + w.length < maxTokens) chunk.push(w);
      else {
        chunks.push(chunk.join(" "));
        chunk = [w];
      }
    });
    if (chunk.length) chunks.push(chunk.join(" "));
    return chunks;
  };

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

  /* -------------------------------------------------------------------------
   * 3.  NETWORK HELPERS (save / resimplify)
   * ---------------------------------------------------------------------- */
  const saveSimplification = async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;
    const { words: wIn, chars: cIn } = countWordsAndChars(inputText);
    const { words: wOut, chars: cOut } = countWordsAndChars(outputText);
    await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user._id,
        inputText,
        outputText,
        metrics: { numWordsInput: wIn, numCharsInput: cIn, numWordsOutput: wOut, numCharsOutput: cOut },
      }),
    }).catch((err) => console.error(err));
  };

  const saveEditToHistory = async (txt) => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;
    const { words, chars } = countWordsAndChars(txt);
    await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/edit", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, inputText, editedText: txt, numWords: words, numChars: chars }),
    });
  };

  /* -------------------------------------------------------------------------
   * 4.  EFFECTS – fetch docs, sync diff, counters, localStorage state
   * ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const res = await fetch(`https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/user/${email}`);
        const result = await res.json();
        if (res.ok) {
          const sorted = result.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setDocuments(sorted);
          if (!state && sorted.length) {
            // default selection: newest doc, generated version
            const first = sorted[0];
            setSelectedDocId(first._id);
            setSelectedVersionIdx(0);
            setInputText(first.inputText);
            setOutputText(first.outputText);
          }
        }
      } catch (err) {
        console.error("fetch docs", err);
      }
    })();
  }, [email, state]);

  // diff when either side changes
  useEffect(() => setDiffHtml(generateDiff(inputText, outputText)), [inputText, outputText]);

  // word/char counters
  useEffect(() => {
    const { words: wIn, chars: cIn } = countWordsAndChars(inputText);
    const { words: wOut, chars: cOut } = countWordsAndChars(outputText);
    setInputWordCount(wIn);
    setInputCharCount(cIn);
    setOutputWordCount(wOut);
    setOutputCharCount(cOut);
  }, [inputText, outputText]);

  // persist review page snapshot (so back/refresh is safe)
  useEffect(() => {
    localStorage.setItem("reviewPageState", JSON.stringify({ inputText, outputText, editHistory }));
  }, [inputText, outputText, editHistory]);

  /* -------------------------------------------------------------------------
   * 5.  HANDLERS – sidebar, editing, resimplify, save, etc.
   * ---------------------------------------------------------------------- */
  // const handleDocumentClick = (doc) => {
  //   setSelectedDocument(doc);
  //   setInputText(doc.inputText);
  //   setOutputText(doc.outputText);
  //   setSelectedVersionIndex(0);
  // };

  const handleDocumentClick = (doc) => {
     setSelectedDocId(doc._id);
      setSelectedVersionIdx(0);        // generated text
      setInputText(doc.inputText);
      setOutputText(doc.outputText);
     };
//  const handleVersionChange = (docId, idx) => {
//     const doc = documents.find((d) => d._id === docId);
//     if (!doc) return;
//     const txt = idx === 0 ? doc.outputText : (doc.saveHistory ?? [])[idx - 1]?.finalText ?? doc.outputText;
//     setSelectedDocId(docId);
//     setSelectedVersionIdx(idx);
//     setInputText(doc.inputText);
//     setOutputText(txt);
//   };


  const handleVersionChange = (docId, idx) => {
    const doc = documents.find((d) => d._id === docId);
    if (!doc) return;
    const txt = idx === 0 ? doc.outputText : (doc.saveHistory ?? [])[idx - 1]?.finalText ?? doc.outputText;
    setSelectedDocId(docId);
    setSelectedVersionIdx(idx);
    setInputText(doc.inputText);
    setOutputText(txt);
  };

  const handleEditChange = (e) => {
    const txt = e.target.value;
    setOutputText(txt);
    setIsSaveButtonEnabled(true);
    saveEditToHistory(txt);
  };

  const handleResimplify = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    try {
      const chunks = splitTextIntoChunks(inputText, 10000);
      let combo = "";
      for (const ch of chunks) {
        const res = await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/gpt4", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: generatePrompt(ch) }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        combo += (data?.response || "").replace(/^"|"$/g, "") + " ";
      }
      setOutputText(combo.trim());
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const saveFinalOutput = async () => {
    setIsLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) return;
      const { words, chars } = countWordsAndChars(outputText);
      const res = await fetch("https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/api/simplifications/final", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          inputText,
          finalText: outputText,
          numWords: words,
          numChars: chars,
          readability: 4,
          accuracy: 5,
          comments: "Looks good.",
        }),
      });

       if (res.ok) {
                /* keep UI changes … */
                setIsSaveButtonEnabled(false);
                setShowSurveyPrompt(true);
                setSaveHistory((p) => [...p, { timestamp: new Date().toISOString(), finalText: outputText }]);
                setTimeout(() => surveyRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
        
                /* -------- prepare data for Survey page -------- */
                const currentDoc      = documents.find((d) => d._id === selectedDocId);
                const generatedText   = currentDoc ? currentDoc.outputText : initialOutputText;   // version‑1 text
        
                navigate("/survey", {
                  state : {
                    email,
                    inputText,                    // original input
                    generatedText,                // **AI‑generated version‑1 text**
                    finalText   : outputText,     // what’s currently on screen (may be edited)
                    editHistory,
                    saveHistory : [...saveHistory, { timestamp: new Date().toISOString(), finalText: outputText }],
                  },
                });
              }

      
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("reviewPageState");
    navigate("/Login");
  };

  const handleCopy = (txt) => navigator.clipboard.writeText(txt);
  const handleDownload = (txt, name) => saveAs(new Blob([txt], { type: "text/plain;charset=utf-8" }), `${name}.txt`);

  /* -------------------------------------------------------------------------
   * 6.  RENDER
   * ---------------------------------------------------------------------- */
  return (
    <>
      <nav className={styles.navbar}>
        <h1 onClick={() => (window.location.href = "https://textsimplification12-a0a8gqfbhnhxbgbv.westus-01.azurewebsites.net/")} style={{ cursor: "pointer" }}>
          Text Simplification Tool
        </h1>
        <button className={styles.white_btn} onClick={handleLogout}>
          Logout
        </button>
      </nav>

      <div className={styles.container}>
        {/* ---------------- SIDEBAR ---------------- */}
        <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
          <button className={styles.historyIcon} onClick={() => setIsSidebarVisible((s) => !s)}>
            🕒 <p style={{ fontSize: 15 }}> History </p>
          </button>

          {isSidebarVisible && (
            <div className={styles.historyContent}>
              <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>
                ✖
              </button>
              <ul className={styles.historyList}>
                {documents.map((doc, idx) => (
                  <li key={doc._id} className={styles.historyItem}>
                    <div
                      onClick={() => {
                        setExpandedDocs((p) => ({ ...p, [doc._id]: !p[doc._id] }));
                        handleDocumentClick(doc);
                      }}
                      className={`${styles.docHeader} ${selectedDocId === doc._id ? styles.activeDoc : ""}`}
                      // className={`${styles.docHeader} ${selectedDocument?._id === doc._id ? styles.activeDoc : ""}`}
                    
                    >
                      <strong>Document {documents.length - idx}</strong> ({doc.inputText.slice(0, 20)}...)
                    </div>
                    {expandedDocs[doc._id] && (
                      <ul className={styles.versionList}>
                        <li
                          key="0"
                          onClick={() => handleVersionChange(doc._id, 0)}
                          // className={selectedVersionIndex === 0 && selectedDocument?._id === doc._id ? styles.activeVersion : ""}
                          
                          className={selectedDocId === doc._id && selectedVersionIdx === 0 ? styles.activeVersion : ""}

                        >
                          Version 1 (Generated)
                        </li>
                        {/* {doc.saveHistory.map((v, vIdx) => ( */}
                          {(doc.saveHistory ?? []).map((v, vIdx) => (
                          <li
                            key={vIdx + 1}
                            onClick={() => handleVersionChange(doc._id, vIdx + 1)}
                            // className={
                            //   selectedVersionIndex === vIdx + 1 && selectedDocument?._id === doc._id ? styles.activeVersion : ""
                            
                            // }
                            className={selectedDocId === doc._id && selectedVersionIdx === vIdx + 1 ? styles.activeVersion : ""}
                          >
                            Version {vIdx + 2} ({new Date(v.timestamp).toLocaleDateString()})
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ---------------- MAIN ---------------- */}
        <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>
          <div className={styles.description}>
            <p>
              Please review the simplified text, edit if necessary, then save and complete the short survey to help us improve.
            </p>
          </div>

          <div className={styles.textareas_container}>
            {/* Input */}
            <div className={styles.text_container}>
              <div className={styles.labelWrapper}>
                <label className={styles.label}>Input Text</label>
                <div className={styles.actions}>
                  <div className={styles.copyIcon} title="Copy" onClick={() => handleCopy(inputText)}>📋</div>
                  <div className={styles.copyIcon} title="Download" onClick={() => handleDownload(inputText, "InputText")}>📥</div>
                  <StatsButton text={inputText} />
                  <div className={styles.copyIcon} title="Re‑simplify" onClick={handleResimplify}>🔄</div>
                </div>
              </div>
              <p className={styles.countText}>
                Words: {inputWordCount} | Characters: {inputCharCount}
              </p>
              <textarea className={`${styles.textarea} ${styles.side_by_side}`} value={inputText} readOnly />
            </div>

            {/* Output */}
            <div className={styles.text_container}>
              <div className={styles.labelWrapper}>
                <label className={styles.label}>AI‑generated Text</label>
                <div className={styles.actions}>
                  <div className={styles.copyIcon} title="Copy" onClick={() => handleCopy(outputText)}>📋</div>
                  <div className={styles.copyIcon} title="Download" onClick={() => handleDownload(outputText, "GeneratedText")}>📥</div>
                  <StatsButton text={outputText} />
                  <button className={styles.toggleDiffBtn} onClick={() => setShowDifference((s) => !s)}>
                    {showDifference ? "Hide Difference" : "Show Difference"}
                  </button>
                </div>
              </div>
              <p className={styles.countText}>
                Words: {outputWordCount} | Characters: {outputCharCount}
              </p>
              <textarea
                id="outputText"
                className={`${styles.output_box} ${styles.side_by_side}`}
                value={outputText}
                onChange={handleEditChange}
                readOnly={isEditable}
              />
            </div>

            {/* Diff */}
            {showDifference && (
              <div className={styles.text_container}>
                <label className={styles.label}>Difference from input</label>
                <div className={`${styles.output_box} ${styles.side_by_side}`} dangerouslySetInnerHTML={{ __html: diffHtml }} />
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className={styles.button_container}>
            <button
              className={styles.submit_btn}
              onClick={saveFinalOutput}
              disabled={!isSaveButtonEnabled || isLoading}
              title={!isSaveButtonEnabled ? "Make an edit before saving." : ""}
            >
              Save
            </button>
          </div>

          {/* Survey Prompt */}
          {showSurveyPrompt && (
            <div className={styles.survey_prompt} ref={surveyRef}>
              <p className={styles.survey_text}>
                Please take the survey to help us improve.
                <button
                  className={styles.survey_btn}
                  onClick={() => {
    
                  const doc           = documents.find(d => d._id === selectedDocId);
                  const generatedText = doc ? doc.outputText : initialOutputText;   // fallback

                    navigate("/survey", {
                      state : {
                        email,
                        inputText,           // original user input
                        generatedText,       // ► AI‑generated Version‑1 text
                        finalText : outputText,              // ► whatever is in the box NOW
                        editHistory,
                        saveHistory : [
                          ...saveHistory,
                          { timestamp : new Date().toISOString(), finalText : outputText }
                        ]
                      }
                    });
                    // navigate("/survey", {
                    //   state : {
                    //     email,
                    //     inputText,
                    //     outputText,          // ← whatever is on‑screen right now
                    //     editHistory,
                    //     saveHistory : [
                    //       ...saveHistory,
                    //       { timestamp : new Date().toISOString(), finalText : outputText }
                    //     ]
                    //   }
                    // });

                  }}
                >
                  📑 Take the Survey
                </button>
              </p>
            </div>
          )}

          <p className={styles.help_text}>
            Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a>
          </p>
          <Footer />  
        </div>
      </div>
    </>
  );
};

export default Review;