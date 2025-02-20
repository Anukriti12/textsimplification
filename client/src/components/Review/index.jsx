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

  const [diffHtml, setDiffHtml] = useState("");
  const [isSaveButtonEnabled, setIsSaveButtonEnabled] = useState(false);
  const navigate = useNavigate();


  const [isEditable, setIsEditable] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showDifference, setShowDifference] = useState(false);


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


  const saveSimplification = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) return;

      const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user._id,
          inputText,
          outputText,
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

  
  const saveEditToHistory = async (editedText) => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) return;

      const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications/edit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          inputText,
          editedText,
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

      const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications/save", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          inputText,
          finalText: outputText,
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
    saveSimplification(); // Save the initial inputText and outputText
    setIsSaveButtonEnabled(true);

    const savedState = JSON.parse(localStorage.getItem("reviewPageState"));
    if (savedState) {
      setOutputText(savedState.outputText || "");
      setEditHistory(savedState.editHistory || []);
    }
  }, []);
  
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
        <h1>Text Simplification Tool</h1>
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
        title="Download as TXT"
      >
        📥 {/* Download Icon */}
      </div>
      </div>
    </div>
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
        title="Download as TXT"
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
            <p className={styles.help_text}>Need Help? <a href="mailto:anukumar@uw.edu">Contact Support</a></p>

  {/* Survey Prompt (Appears Only After Submitting) */}
  {showSurveyPrompt && (
    <div className={styles.survey_prompt}>
      <p className={styles.survey_text}>
        Please take the survey to help us improve.
        <button
          className={styles.survey_btn}
          onClick={() => {
            const reviewPageState = { inputText, outputText, editHistory };
            localStorage.setItem("reviewPageState", JSON.stringify(reviewPageState));
            navigate("/survey", {
              state: {
                email: JSON.parse(localStorage.getItem("user")).email,
                inputText,
                outputText,
                editHistory,
              },
            });
          }}
        >
          📑 Take the Survey
        </button>
      </p>
    </div>
  )}


          {/* Survey Prompt */}
    	  {/* {showSurveyPrompt && (
                  <div className={styles.survey_prompt}>
                    <p>
                      Please take the survey {" "}
                      <button
                        className={styles.link_btn}
 
                      onClick={() => {
                        const reviewPageState = {
                          inputText,
                          outputText,
                          editHistory,
                        };
                        localStorage.setItem("reviewPageState", JSON.stringify(reviewPageState));
                        navigate("/survey", {
                          state: {
                            email: JSON.parse(localStorage.getItem("user")).email,
                            inputText,
                            outputText,
                            editHistory,
                          },
                        });
                      }}
                    >
                        📑 Take the Survey
                      </button>
                    
                    to help us improve!
                    </p>
                  </div>
                )} */}


        </div>
      </div>
    </>
  );
};

export default Review;



// import React, { useState, useEffect, useRef } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import { FaRegCopy, FaDownload } from "react-icons/fa"; // Import FontAwesome copy icon
// import { FaCopy } from "react-icons/fa";
// import { saveAs } from "file-saver";
// import styles from "./styles.module.css";

// const Review = () => {
//   const { state } = useLocation();
//   const { inputText, outputText: initialOutputText } = state || {
//     inputText: "",
//     outputText: "",
//   };
//   const [outputText, setOutputText] = useState(initialOutputText);
//   const [diffHtml, setDiffHtml] = useState("");
//   const [isEditable, setIsEditable] = useState(false);
//   const [editHistory, setEditHistory] = useState([]);
//   const [isSidebarVisible, setIsSidebarVisible] = useState(false);
//   const [showDifference, setShowDifference] = useState(false);

//   const navigate = useNavigate();


//   const [isHistoryVisible, setIsHistoryVisible] = useState(false); // Show/Hide history sidebar
//   const contentEditableRef = useRef(null); // Reference to the contentEditable div

// 	const [isLoading, setIsLoading] = useState(false);

// 	const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);
// 	const [showSurveyPrompt, setShowSurveyPrompt] = useState(false); // State for survey prompt


//   // Function to calculate and render diff
//   const generateDiff = (input, output) => {
//     const dmp = new DiffMatchPatch();
//     const diffs = dmp.diff_main(input, output);
//     dmp.diff_cleanupSemantic(diffs); // Optional cleanup for better readability
//     return dmp.diff_prettyHtml(diffs);
//   };

//   const handleLogout = () => {
//     localStorage.removeItem("token");
// 	navigate("/Login"); 
//    // window.location.reload();
//   };

//    // Function to save the original input and output text to MongoDB
//    const saveSimplification = async () => {
//     try {
//       const user = JSON.parse(localStorage.getItem("user"));

//       const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           userId: user._id,
//           inputText,
//           outputText,
//         }),
//       });

//       if (response.ok) {
//         console.log("Simplification saved successfully.");
//       } else {
//         const data = await response.json();
//         console.error("Error saving simplification:", data.message);
//       }
//     } catch (error) {
//       console.error("Error saving simplification:", error);
//     }
//   };

//   // Function to save an edit to MongoDB
//   const saveEdit = async (editedText) => {
//     try {
//       const user = JSON.parse(localStorage.getItem("user"));

//       const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications/edit", {
//         method: "PUT",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           email: user.email,
//           inputText,
//           editedText,
//         }),
//       });

//       if (response.ok) {
//         console.log("Edit saved successfully.");
//       } else {
//         const data = await response.json();
//         console.error("Error saving edit:", data.message);
//       }
//     } catch (error) {
//       console.error("Error saving edit:", error);
//     }
//   };

//   // Effect to calculate diff whenever text changes
//   // useEffect(() => {
//   //   const diffResult = generateDiff(inputText, outputText);
//   //   setDiffHtml(diffResult);
//   // }, [inputText, outputText]);

//     // Effect to calculate diff and save the initial data
//     useEffect(() => {
//       const diffResult = generateDiff(inputText, outputText);
//       setDiffHtml(diffResult);
  
//       // Save the original input and output text to MongoDB
//       saveSimplification();
//     }, [inputText, outputText]);

//   const handleCopy = (text) => {
// 	navigator.clipboard.writeText(text).then(
// 	  () => {
// 		alert("Copied to clipboard!");
// 	  },
// 	  (err) => {
// 		console.error("Failed to copy text: ", err);
// 	  }
// 	);
//   };
  
//   // Function to handle download
//   const handleDownload = (text, filename, format) => {
//     const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
//     const link = document.createElement("a");
//     link.href = URL.createObjectURL(blob);
//     link.download = `${filename}.${format}`;
//     link.click();
//   };
  
// //   const handleEdit = () => {
// //     setIsEditable(true);
// //   };

// //   const handleSave = () => {
// //     // Save the current state to history
// //     setEditHistory((prev) => [
// //       ...prev,
// //       { timestamp: new Date().toLocaleString(), text: outputText },
// //     ]);
// //     alert("Saved successfully!");
// //     setIsEditable(false);
// //   };
// const handleSave = async () => {
//   const editedText = outputText;

//   // Save the edit to MongoDB
//   await saveEdit(editedText);

//   // Update the edit history
//   setEditHistory((prev) => [
//     ...prev,
//     { timestamp: new Date().toLocaleString(), text: editedText },
//   ]);

//   setIsEditable(false);
//   alert("Edited text saved successfully.");
// };

// //     const handleSave = async (isAuto = false) => {
// // //		setIsSaveButtonVisible(false);
// // if (isAuto && isAuto.nativeEvent) {
// // 	isAuto = false; // Default behavior if called by an event
// // }

		  
// // 		try {
// // 		  const user = JSON.parse(localStorage.getItem("user")); // Retrieve user info
// // 		  if (!user) {
// // 			alert("User not logged in!");
// // 			return;
// // 		  }
	  
// // 		  const payload = {
// // 			userId: user._id,
// // 			email: user.email,
// // 			inputText,
// // 			...(isEditable ? { editedText: outputText } : { outputText, editableText: outputText }),
// // 		  };
	  
// // 		  const endpoint = isEditable
// // 			? "https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications/edit" // Endpoint for updating
// // 			: "https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications"; // Endpoint for initial save
	  
// // 		  const method = isEditable ? "PUT" : "POST"; // Use PUT for updates, POST for saves
	  
// // 		  const response = await fetch(endpoint, {
// // 			method,
// // 			headers: { "Content-Type": "application/json" },
// // 			body: JSON.stringify(payload),
// // 		  });
	  
// // 		  if (response.ok) {
// // 			const data = await response.json();
            
// // 			alert(isEditable ? "Edited text saved successfully!" : "Simplification saved successfully!");

// // 			//setShowSurveyPrompt(true); 
// // 			console.log("isSaveButtonVisible", isSaveButtonVisible);
// // 			console.log("isEditable", isEditable);
// // 			console.log("isAuto", isAuto);
// // 			if (!isSaveButtonVisible) {  //edit, save, edit
// // 				setShowSurveyPrompt(false); // Show the survey prompt
// // 			  }
// // 			else if (isSaveButtonVisible && !isEditable && isAuto)  //true false -- first time save or edit button clicked
// // 			{
// // 				setShowSurveyPrompt(false);
// // 			}
// // 			else if (isSaveButtonVisible && isEditable)
// // 			{
// // 				setShowSurveyPrompt(true);
// // 			} 
// // 			else if (isSaveButtonVisible && !isEditable && !isAuto)  //true false -- first time save or edit button clicked
// // 			{
// // 				setShowSurveyPrompt(true);
// // 			}

// // 			setEditHistory((prev) => [
// // 				...prev,
// // 				{ timestamp: new Date().toLocaleString(), text: outputText },
// // 			  ]);

// // 			if (isEditable) {
// // 			 {
// // 				setIsEditable(false); // Exit editing mode after saving edits
// // 			  // disable saving button
// // 			  setIsSaveButtonVisible(false); // Hide the save button
// // 			   // Show the survey prompt
// // 			 // setShowSurveyPrompt(true); 
// // 			 }


// // 		  }} else {
// // 			const error = await response.json();
// // 			alert(error.message || "Failed to save simplification.");
// // 		  }
// // 		} catch (error) {
// // 		  console.error("Error saving simplification:", error);
// // 		  alert("An error occurred. Please try again.");
// // 		}

// // 	  };
// const handleEdit = () => {
//   setIsEditable(true);
// };


// 	// const handleEdit = () => {
// 	//   let isAuto = true;
// 	//   handleSave(isAuto); // Save the current output text
// 	//   setIsEditable(true); // Enable editing mode
// 	//   setIsSaveButtonVisible(true);

// 	// };

//   const handleHistoryClick = (edit) => {
//     setOutputText(edit.text);
//     const diffResult = generateDiff(inputText, edit.text);
//     setDiffHtml(diffResult);
//     setIsEditable(false);
//   };

//   return (
//     <>
//       <nav className={styles.navbar}>
//         <h1>Text Simplification Study</h1>
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
//              🕒   <p style={{ fontSize: "15px" }}> History </p> {/* History Icon */}
//           </button>
//           {isSidebarVisible && (
//             <div className={styles.historyContent}>
//               <button
//                 className={styles.closeButton}
//                 onClick={() => setIsSidebarVisible(false)}
//               >
//                ✖
//               </button>
//               {/* <h3>History</h3> */}
//               <ul className={styles.historyList}>
//                 {editHistory.map((edit, index) => (
//                   <li
//                     key={index}
//                     className={styles.historyItem}
//                     onClick={() => handleHistoryClick(edit)}
//                   >
//                     {edit.timestamp}
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>

//         {/* Main Content */}
//         <div
//           className={`${styles.mainContent} ${
//             isSidebarVisible ? styles.withSidebar : ""
//           }`}
//         >
// 			<div className={styles.description}>
// 			<p>
// 				Review the generated output and make any necessary edits. Changes
// 				are highlighted in real-time for easy visualization.
// 			</p>
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
//         </div>
//         📋 {/* Clipboard Emoji */}
//         <div
//         className={styles.copyIcon}
//         onClick={() => handleDownload(inputText, "InputText", "txt")}
//         title="Download as TXT"
//       >
//         📥 {/* Download Icon */}
//       </div>
//       </div>
//     </div>
//     <textarea
//       id="inputText"
//       className={`${styles.textarea} ${styles.side_by_side}`}
//       value={inputText}
//       readOnly
//     ></textarea>
//   </div>

// 			{/* Output Text Box */}
// 			{/* Output Text Box */}
// <div className={styles.text_container}>
//   <div className={styles.labelWrapper}>
//     <label className={styles.label} htmlFor="outputText">
//       System-generated Text
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
//         title="Download as TXT"
//       >
//         📥 {/* Download Icon */}
//       </div>
//       <button
//         className={styles.toggleDiffBtn}
//         onClick={() => setShowDifference(!showDifference)}
//       >
//         {showDifference ? "Hide Difference" : "Show Difference"}
//       </button>
//     </div>
//   </div>
//   <textarea
//     id="outputText"
//     className={`${styles.output_box} ${styles.side_by_side}`}
//     value={outputText}
//     onChange={(e) => setOutputText(e.target.value)}
//     readOnly={isEditable}
//     placeholder="Output"
//   ></textarea>
// </div>

//             {/* Difference Text */}
// 			{showDifference && (
// 				<div className={styles.text_container}>
// 				<label className={styles.label} htmlFor="outputText">
// 					Difference from original text
// 				</label>

// 					<div
// 					id="diffText"
// 					className={`${styles.output_box} ${styles.side_by_side}`}
// 					dangerouslySetInnerHTML={{ __html: diffHtml }}
// 					></div>
// 				 {/* )} */}
// 				</div>
// 			)}
			
// 			</div>



//           {/* Buttons */}
// 			<div className={styles.button_container}>

    
//     				{isSaveButtonVisible && (
//     				<button
//     					className={`${styles.save_btn} ${styles.text_btn}`}
//     					onClick={handleSave}
//     					disabled={isLoading}
//     				>
//     					Save
//     				</button>
//     				)}
    
//     				{!isEditable && (
//     					<button
//     					className={`${styles.edit_btn} ${styles.text_btn}`}
//     					onClick={handleEdit}
//     					>
//     					Edit
//     					</button>
//     				)}
//     				</div>
//           {/* Survey Prompt */}
//     	  {showSurveyPrompt && (
//                   <div className={styles.survey_prompt}>
//                     <p>
//                       Please take the survey to help us improve {" "}
//                       <button
//                         className={styles.link_btn}
//                         onClick={() =>
//                           navigate("/survey", {
//                             state: { email: JSON.parse(localStorage.getItem("user")).email, inputText },
//                           })
//                         }
//                       >
//                         Take the Survey
//                       </button>
//                     </p>
//                   </div>
//                 )}
    



//         </div>
//       </div>
//     </>
//   );
// };

// export default Review;


// import React from "react";
// import { useState, useEffect, useRef } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import styles from "./styles.module.css";

// const Review = () => {
//   const { state } = useLocation();
//   const { inputText, outputText: initialOutputText } = state || {
//     inputText: "",
//     outputText: "",
//   };
//   const [outputText, setOutputText] = useState(initialOutputText);
//   const [diffHtml, setDiffHtml] = useState(""); // State for storing diff HTML
//   const [isEditable, setIsEditable] = useState(false);
//   const [editHistory, setEditHistory] = useState([]); // Array to store edit history
//   const [isHistoryVisible, setIsHistoryVisible] = useState(false); // Show/Hide history sidebar
//   const navigate = useNavigate();
//   const contentEditableRef = useRef(null); // Reference to the contentEditable div

// 	const [isLoading, setIsLoading] = useState(false);

// 	const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);
// 	const [showSurveyPrompt, setShowSurveyPrompt] = useState(false); // State for survey prompt



//   // Function to calculate and render diff
//   const generateDiff = (input, output) => {
//     const dmp = new DiffMatchPatch();
//     const diffs = dmp.diff_main(input, output);
//     dmp.diff_cleanupSemantic(diffs); // Optional cleanup for better readability
//     return dmp.diff_prettyHtml(diffs); // Generate diff HTML
	
//   };


  

//   // Effect to calculate diff whenever text changes
//   useEffect(() => {
//     const diffResult = generateDiff(inputText, outputText);
//     setDiffHtml(diffResult);
//   }, [inputText, outputText]);

//   const handleLogout = () => {
//     localStorage.removeItem("token");
//     window.location.reload();
//   };

//   	const handleSave = async (isAuto = false) => {
// //		setIsSaveButtonVisible(false);
// if (isAuto && isAuto.nativeEvent) {
// 	isAuto = false; // Default behavior if called by an event
// }

		  
// 		try {
// 		  const user = JSON.parse(localStorage.getItem("user")); // Retrieve user info
// 		  if (!user) {
// 			alert("User not logged in!");
// 			return;
// 		  }
	  
// 		  const payload = {
// 			userId: user._id,
// 			email: user.email,
// 			inputText,
// 			...(isEditable ? { editedText: outputText } : { outputText, editableText: outputText }),
// 		  };
	  
// 		  const endpoint = isEditable
// 			? "https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications/edit" // Endpoint for updating
// 			: "https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications"; // Endpoint for initial save
	  
// 		  const method = isEditable ? "PUT" : "POST"; // Use PUT for updates, POST for saves
	  
// 		  const response = await fetch(endpoint, {
// 			method,
// 			headers: { "Content-Type": "application/json" },
// 			body: JSON.stringify(payload),
// 		  });
	  
// 		  if (response.ok) {
// 			const data = await response.json();
            
// 			alert(isEditable ? "Edited text saved successfully!" : "Simplification saved successfully!");

// 			//setShowSurveyPrompt(true); 
// 			console.log("isSaveButtonVisible", isSaveButtonVisible);
// 			console.log("isEditable", isEditable);
// 			console.log("isAuto", isAuto);
// 			if (!isSaveButtonVisible) {  //edit, save, edit
// 				setShowSurveyPrompt(false); // Show the survey prompt
// 			  }
// 			else if (isSaveButtonVisible && !isEditable && isAuto)  //true false -- first time save or edit button clicked
// 			{
// 				setShowSurveyPrompt(false);
// 			}
// 			else if (isSaveButtonVisible && isEditable)
// 			{
// 				setShowSurveyPrompt(true);
// 			} 
// 			else if (isSaveButtonVisible && !isEditable && !isAuto)  //true false -- first time save or edit button clicked
// 			{
// 				setShowSurveyPrompt(true);
// 			}

// 			setEditHistory((prev) => [
// 				...prev,
// 				{ timestamp: new Date().toLocaleString(), text: outputText },
// 			  ]);

// 			if (isEditable) {
// 			 {
// 				setIsEditable(false); // Exit editing mode after saving edits
// 			  // disable saving button
// 			  setIsSaveButtonVisible(false); // Hide the save button
// 			   // Show the survey prompt
// 			 // setShowSurveyPrompt(true); 
// 			 }


// 		  }} else {
// 			const error = await response.json();
// 			alert(error.message || "Failed to save simplification.");
// 		  }
// 		} catch (error) {
// 		  console.error("Error saving simplification:", error);
// 		  alert("An error occurred. Please try again.");
// 		}

// 	  };

// 	  const handleHistoryClick = (edit) => {
// 		setOutputText(edit.text);
// 		const diffResult = generateDiff(inputText, edit.text);
// 		setDiffHtml(diffResult);
// 		setIsEditable(false);
// 	  };

// 	const handleEdit = () => {
// 	  let isAuto = true;
// 	  handleSave(isAuto); // Save the current output text
// 	  setIsEditable(true); // Enable editing mode
// 	  setIsSaveButtonVisible(true);

// 	};
  
//   return (
//     <>
//       <nav className={styles.navbar}>
//         <h1>Text Simplification Study</h1>
//         <button className={styles.white_btn} onClick={handleLogout}>
//           Logout
//         </button>
//       </nav>

//       <div className={styles.main_container}>
//         <div className={styles.description}>
//           <p>
//             Review the generated output and make any necessary edits. Changes
//             are highlighted in real-time for easy visualization.
//           </p>

//       {/* Sidebar */}
//       <div className={styles.sidebar}>
//         <button
//           className={styles.historyIcon}
//           onClick={() => setIsHistoryVisible(!isHistoryVisible)}
//         >
//           🕒 {/* History Icon */}
//         </button>
//         {isHistoryVisible && (
//           <div className={styles.historyPanel}>
//             <h3>Edit History</h3>
//             <ul className={styles.historyList}>
//               {editHistory.map((edit, index) => (
//                 <li
//                   key={index}
//                   className={styles.historyItem}
//                   onClick={() => handleHistoryClick(edit)}
//                 >
//                   {edit.timestamp}
//                 </li>
//               ))}
//             </ul>
//           </div>
//         )}
//       </div>

//           <div className={styles.form_container}>
//             {/* Input and Diff Boxes */}
//             <div className={styles.textareas_container}>
//               {/* Input Text Box */}
//               <div className={styles.text_container}>
//                 <label className={styles.label} htmlFor="inputText">
//                   Input Text
//                 </label>
//                 <textarea
//                   id="inputText"
//                   className={`${styles.textarea} ${styles.side_by_side}`}
//                   value={inputText}
//                   readOnly
//                 ></textarea>
//               </div>
// <div className={styles.text_container}>
//   <label className={styles.label} htmlFor="outputText">
//     System-generated Text
//   </label>

// {isEditable ? (
//     <>
//       <textarea
//         id="outputText"
//         className={`${styles.textarea} ${styles.side_by_side}`}
//         value={outputText}
//         onChange={(e) => {
//           const updatedText = e.target.value;
//           setOutputText(updatedText); // Update the output text state
//           const updatedDiff = generateDiff(inputText, updatedText); // Recalculate the diff
//           setDiffHtml(updatedDiff); // Update the diff HTML in real-time
		
//         }}
//         placeholder="Output"
//       ></textarea>

//     </>
//   ) : (
//     <div
//       id="diffText"
//       className={`${styles.output_box} ${styles.side_by_side}`}
//       dangerouslySetInnerHTML={{ __html: diffHtml }}
//     ></div>
//   )} 
// </div>




//             </div>


//     				<div className={styles.button_container}>

    
//     				{isSaveButtonVisible && (
//     				<button
//     					className={`${styles.save_btn} ${styles.text_btn}`}
//     					onClick={handleSave}
//     					disabled={isLoading}
//     				>
//     					Save
//     				</button>
//     				)}
    
//     				{!isEditable && (
//     					<button
//     					className={`${styles.edit_btn} ${styles.text_btn}`}
//     					onClick={handleEdit}
//     					>
//     					Edit
//     					</button>
//     				)}
//     				</div>
//           {/* Survey Prompt */}
//     	  {showSurveyPrompt && (
//                   <div className={styles.survey_prompt}>
//                     <p>
//                       Please take the survey to help us improve {" "}
//                       <button
//                         className={styles.link_btn}
//                         onClick={() =>
//                           navigate("/survey", {
//                             state: { email: JSON.parse(localStorage.getItem("user")).email, inputText },
//                           })
//                         }
//                       >
//                         Take the Survey
//                       </button>
//                     </p>
//                   </div>
//                 )}
    
//     			</div>

//     		</div> 
//     		</div>
//     	  </>
//   );
// };


// export default Review;

{/* 
			  <div className={styles.text_container}>
  <label className={styles.label} htmlFor="outputText">
    System-generated Text
  </label>
  {isEditable ? (
    <textarea
      id="outputText"
      className={`${styles.textarea} ${styles.side_by_side}`}
      value={outputText}
      onChange={(e) => setOutputText(e.target.value)} // Handle user edits
      placeholder="Output"
    ></textarea>
  ) : (
    <div
      id="diffText"
      className={`${styles.output_box} ${styles.side_by_side}`}
      dangerouslySetInnerHTML={{ __html: diffHtml }}
    ></div>
  )}
</div> */}



// import React from "react";
// import { useState, useEffect } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import DiffMatchPatch from "diff-match-patch";
// import styles from "./styles.module.css";

// const Review = () => {
//   const { state } = useLocation();
// //   const { inputText, outputText } = state || { inputText: "", outputText: "" };
// //   const navigate = useNavigate();
// const { inputText, outputText: initialOutputText } = state || {
//     inputText: "",
//     outputText: "",
//   };
//   const [outputText, setOutputText] = useState(initialOutputText);
// 	const [isLoading, setIsLoading] = useState(false);
// 	const [isEditable, setIsEditable] = useState(false); // For toggling edit mode
// 	const [diffHtml, setDiffHtml] = useState(""); 
// 	const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);
// 	const [showSurveyPrompt, setShowSurveyPrompt] = useState(false); // State for survey prompt
//     const navigate = useNavigate();

// 	const handleLogout = () => {
// 	  localStorage.removeItem("token");
// 	  window.location.reload();
// 	};

// 	// Function to calculate and render diff
// 	const generateDiff = (input, output) => {
// 	const dmp = new DiffMatchPatch();
// 	const diffs = dmp.diff_main(input, output);
// 	dmp.diff_cleanupSemantic(diffs); // Optional cleanup for better readability
// 	return dmp.diff_prettyHtml(diffs); // Generate diff HTML
// 	};

// 	// Effect to calculate diff whenever text changes
// 	useEffect(() => {
// 	const diffResult = generateDiff(inputText, outputText);
// 	setDiffHtml(diffResult);
// 	}, [inputText, outputText]);
	


//   	const handleSave = async (isAuto = false) => {
// //		setIsSaveButtonVisible(false);
// if (isAuto && isAuto.nativeEvent) {
// 	isAuto = false; // Default behavior if called by an event
// }

		  
// 		try {
// 		  const user = JSON.parse(localStorage.getItem("user")); // Retrieve user info
// 		  if (!user) {
// 			alert("User not logged in!");
// 			return;
// 		  }
	  
// 		  const payload = {
// 			userId: user._id,
// 			email: user.email,
// 			inputText,
// 			...(isEditable ? { editedText: outputText } : { outputText, editableText: outputText }),
// 		  };
	  
// 		  const endpoint = isEditable
// 			? "https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications/edit" // Endpoint for updating
// 			: "https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications"; // Endpoint for initial save
	  
// 		  const method = isEditable ? "PUT" : "POST"; // Use PUT for updates, POST for saves
	  
// 		  const response = await fetch(endpoint, {
// 			method,
// 			headers: { "Content-Type": "application/json" },
// 			body: JSON.stringify(payload),
// 		  });
	  
// 		  if (response.ok) {
// 			const data = await response.json();
            
// 			alert(isEditable ? "Edited text saved successfully!" : "Simplification saved successfully!");

// 			//setShowSurveyPrompt(true); 
// 			console.log("isSaveButtonVisible", isSaveButtonVisible);
// 			console.log("isEditable", isEditable);
// 			console.log("isAuto", isAuto);
// 			if (!isSaveButtonVisible) {  //edit, save, edit
// 				setShowSurveyPrompt(false); // Show the survey prompt
// 			  }
// 			else if (isSaveButtonVisible && !isEditable && isAuto)  //true false -- first time save or edit button clicked
// 			{
// 				setShowSurveyPrompt(false);
// 			}
// 			else if (isSaveButtonVisible && isEditable)
// 			{
// 				setShowSurveyPrompt(true);
// 			} 
// 			else if (isSaveButtonVisible && !isEditable && !isAuto)  //true false -- first time save or edit button clicked
// 			{
// 				setShowSurveyPrompt(true);
// 			}


// 			if (isEditable) {
// 			 {
// 				setIsEditable(false); // Exit editing mode after saving edits
// 			  // disable saving button
// 			  setIsSaveButtonVisible(false); // Hide the save button
// 			   // Show the survey prompt
// 			 // setShowSurveyPrompt(true); 
// 			 }
// 		  }} else {
// 			const error = await response.json();
// 			alert(error.message || "Failed to save simplification.");
// 		  }
// 		} catch (error) {
// 		  console.error("Error saving simplification:", error);
// 		  alert("An error occurred. Please try again.");
// 		}

// 	  };
	  
	
  
// 	const handleEdit = () => {
// 	  let isAuto = true;
// 	  handleSave(isAuto); // Save the current output text
// 	  setIsEditable(true); // Enable editing mode
// 	  setIsSaveButtonVisible(true);

// 	  //navigate("/edit"); // Navigate to edit page

// 	  //setShowSurveyPrompt(false);

// 	  // Add back button
// 	};
  
//   return (
//     <>
//     <nav className={styles.navbar}>
//       <h1>Text Simplification Study</h1>
//       <button className={styles.white_btn} onClick={handleLogout}>
//         Logout
//       </button>
//     </nav>

//     <div className={styles.main_container}>
//         <div className={styles.description}>
// 			  <p>
// 				Review the generated output and make any necessary edits. Click the "Edit" button to make changes to the text. Once you are satisfied with the text, click the "Save" button to save your changes.
// 			  </p>
			
//             <br></br>
            
//      			<div className={styles.form_container}>
//      			  {/* Input and Output Boxes */}
//      			  <div className={styles.textareas_container}>
//      				{/* Input Text Box */}
//      				<div className={styles.text_container}>
//      				  <label className={styles.label} htmlFor="inputText">
//      					Input Text
//      				  </label>
//     				  <textarea
//     					id="inputText"
//     					className={`${styles.textarea} ${styles.side_by_side}`}
//     					value={inputText}
//     					//onChange={(e) => setInputText(e.target.value)}
//     					readOnly
//     				  ></textarea>
//     				</div>
      
//     				{/* Output Text Box */}
//     				<div className={styles.text_container}>
//     				  <label className={styles.label} htmlFor="diffText">
//     					System-generated Text
//     				  </label>
//     				  <textarea
//     					id="diffText"
//     					className={`${styles.output_box} ${styles.side_by_side}`}
//     					value={outputText}
//     					onChange={(e) => setOutputText(e.target.value)}
// 						dangerouslySetInnerHTML={{ __html: diffHtml }}
//     					readOnly={!isEditable}
//     					placeholder="Output"
//     				  ></textarea>
//     				</div>

//     			  </div>
    
    
//     				{/* Save and Edit Buttons */}
//     				<div className={styles.button_container}>

    
//     				{isSaveButtonVisible && (
//     				<button
//     					className={`${styles.save_btn} ${styles.text_btn}`}
//     					onClick={handleSave}
//     					disabled={isLoading}
//     				>
//     					Save
//     				</button>
//     				)}
    
//     				{!isEditable && (
//     					<button
//     					className={`${styles.edit_btn} ${styles.text_btn}`}
//     					onClick={handleEdit}
//     					>
//     					Edit
//     					</button>
//     				)}
//     				</div>
//           {/* Survey Prompt */}
//     	  {showSurveyPrompt && (
//                   <div className={styles.survey_prompt}>
//                     <p>
//                       Please take the survey to help us improve {" "}
//                       <button
//                         className={styles.link_btn}
//                         onClick={() =>
//                           navigate("/survey", {
//                             state: { email: JSON.parse(localStorage.getItem("user")).email, inputText },
//                           })
//                         }
//                       >
//                         Take the Survey
//                       </button>
//                     </p>
//                   </div>
//                 )}
    
//     			</div>
//     		</div> 
//     		</div>
//     	  </>
//   );
// };

// export default Review;