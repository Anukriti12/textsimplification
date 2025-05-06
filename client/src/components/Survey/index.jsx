import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./styles.module.css";
import { saveAs } from "file-saver";
import DiffMatchPatch from "diff-match-patch";
import Footer from "../Footer";
import StatsButton from "../StatsButton";

// const handleFormSubmit = (e) => {
//   e.preventDefault();
//   alert("Survey responses saved");
// };

const SurveyPage = () => {
  const { state } = useLocation();
  //const { email, inputText } = state || {};
  // const { email, inputText, generatedText: initialgeneratedText, editHistory, saveHistory } = state || {};

  const {
      email,
      inputText,
      generatedText,        // new prop from Review
      finalText,            // new prop from Review
      editHistory,
      saveHistory = [],
    } = state || {};

  // const [data, setData] = useState(null);
       
  const [showDifference1, setShowDifference1] = useState(false); // For Input Text vs System-generated Text
  const [showDifference2, setShowDifference2] = useState(false); // For System-generated Text vs Submitted Text
  const [diffHtml1, setDiffHtml1] = useState("");
  const [diffHtml2, setDiffHtml2] = useState("");


    // Store latest submitted text from history selection
    const [latestFinalText, setLatestFinalText] = useState("");
    const [isSidebarVisible, setIsSidebarVisible] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState(null);
    

  const navigate = useNavigate();

  // Word count states
  const [inputWordCount, setInputWordCount] = useState(0);
  const [outputWordCount, setOutputWordCount] = useState(0);
  const [submittedWordCount, setSubmittedWordCount] = useState(0);

  // Function to count words
  const countWords = (text) => {
    return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  };



    useEffect(() => {
        setInputWordCount   (countWords(inputText));
        setOutputWordCount  (countWords(generatedText));
        setSubmittedWordCount(countWords(latestFinalText));
     }, [inputText, generatedText, latestFinalText]);

  useEffect(() => {
    if (saveHistory.length > 0) {
      setLatestFinalText(saveHistory[saveHistory.length - 1]?.finalText || "");
      setSelectedVersion(saveHistory.length);
      setSubmittedWordCount(countWords(saveHistory[saveHistory.length - 1]?.finalText || ""));
    }
  }, [saveHistory]);

  useEffect(() => {
    setDiffHtml1(generateDiff(inputText, generatedText));
    setDiffHtml2(generateDiff(generatedText, latestFinalText || finalText));
  }, [inputText, generatedText, latestFinalText, finalText]);
  

    useEffect(() => {
        if (saveHistory.length) {
          const last = saveHistory[saveHistory.length - 1]?.finalText || "";
          setLatestFinalText(last);
          setSelectedVersion(saveHistory.length);
        } else {
          setLatestFinalText(finalText);          // from Review
        }
      }, [saveHistory, finalText]);

  
  const handleHistoryClick = (index) => {
    setLatestFinalText(saveHistory[index].finalText);
    setSelectedVersion(index + 1);
  };

  useEffect(() => {
    const handleBackButton = (event) => {
      event.preventDefault();
      const confirmLeave = window.confirm(
        "You have unsaved changes. Going back may result in losing your edits. Do you want to continue?\n\nIf you want to edit your already submitted text, copy it from here."
      );
      if (!confirmLeave) {
        window.history.pushState(null, "", window.location.href); // Prevent navigation
      } else {
        navigate(-1);
      }
    };


    // **Push a history state to detect back button click**
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handleBackButton);

    return () => {
      window.removeEventListener("popstate", handleBackButton);
    };
  }, [navigate]);
  
  const [submitted, setSubmitted] = useState(false);


  const [responses, setResponses] = useState({
    /* Likert-scale questions (radio buttons) */
    needs: null,
    easy: null,
    meaning: null,
    relevancy: null,
    grammar: null,
    guidelines: null,
    clarity: null,
    coherent: null,
    editing_effort: null,
  
    /* Free‑text questions (text‑areas)        */
    main_reasons: "",
    additional_comments: "",
  });

  // Handle input changes     

  // Handle input changes, allowing deselection
const handleOptionChange = (event) => {
  const { name, value } = event.target;
  setResponses((prevResponses) => ({
    ...prevResponses,
    [name]: prevResponses[name] === value ? "" : value,  // Toggle selection
  }));
};
  // Check if all required fields are filled
  // const isFormComplete = Object.values(responses).every((value) => value !== "" && value !== null);


  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/Login"); 
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

  // survey/index.jsx
const handleFormSubmit = async (e) => {
  e.preventDefault();
  // if (!isFormComplete) return alert("Please answer every question.");

  await fetch("http://localhost:5001/api/simplifications/survey", {
    method : "PUT",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ email, inputText, responses }),
  });

  setSubmitted(true);
};


  const handleTextChange = e => {
      const { name, value } = e.target;
      setResponses(prev => ({ ...prev, [name]: value }));
    };

  const generateDiff = (input, output) => {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(input, output);
    dmp.diff_cleanupSemantic(diffs); // Optional cleanup for better readability
    return dmp.diff_prettyHtml(diffs);
  };



  // if (!data)
  //   {return <p>Loading...</p>;}

  // const { inputText: input, generatedText, editedText } = data;
  // const { inputText: input, generatedText, latestText } = data;

  return (
    <>
		{/* Navbar */}
		<nav className={styles.navbar}>
		  {/* <h1>Text Simplification Tool</h1> */}
      <h1 
    onClick={() => window.location.href = "http://localhost:5001/"}
    style={{ cursor: "pointer" }} // Makes it look clickable
 		>
		Text Simplification Tool</h1>
		  <button className={styles.white_btn} onClick={handleLogout}>
			Logout
		  </button>
		</nav>


<div className={styles.container}>
    <div className={`${styles.sidebar} ${isSidebarVisible ? styles.expanded : ""}`}>
         
         <button className={styles.historyIcon} onClick={() => setIsSidebarVisible(!isSidebarVisible)}>
           🕒 <p style={{ fontSize: "15px" }}>History</p>
         </button>
         {isSidebarVisible && (
           <div className={styles.historyContent}>
             <button className={styles.closeButton} onClick={() => setIsSidebarVisible(false)}>✖</button>
             <ul className={styles.historyList}>
               {saveHistory.map((entry, index) => (
                //  <li key={index} className={styles.historyItem} onClick={() => handleHistoryClick(entry)}>
                //    {entry.timestamp}
                //  </li>
                <li key={index} className={`${styles.historyItem} ${selectedVersion === index + 1 ? styles.activeVersion : ""}`} 
                         onClick={() => handleHistoryClick(index)}>
                       Version {index + 1}
                </li>

               ))}
             </ul>
           </div>
         )}
    </div>


    {!submitted ? (

    <div className={`${styles.mainContent} ${isSidebarVisible ? styles.withSidebar : ""}`}>

          <div className={styles.description}>
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
                  onClick={() => handleDownload(inputText, "inputText", "txt")}
                  title="Download as .txt file"
                >
                  📥 {/* Download Icon */}
                </div>
            <StatsButton text={inputText} />
                
              </div>
            </div>

            <p className={styles.wordCount}>Words: {inputWordCount}</p>

            <textarea
              id="inputText"
              className={`${styles.textarea} ${styles.side_by_side}`}
              value={inputText} readOnly placeholder="Input Text"
            ></textarea>
          </div>

            {/* system generated text Box */}
          <div className={styles.text_container}>
            <div className={styles.labelWrapper}>
              <label className={styles.label} htmlFor="generatedText">
                AI-generated Text
              </label>


              <div className={styles.actions}>
                <div
                  className={styles.copyIcon}
                  onClick={() => handleCopy(generatedText)}
                  title="Copy to Clipboard"
                >
                  📋 {/* Clipboard Emoji */}
                </div>

                <div
                  className={styles.copyIcon}
                  onClick={() => handleDownload(generatedText, "GeneratedText", "txt")}
                  title="Download as .txt file"
                >
                  📥 {/* Download Icon */}
                </div>
                                  <StatsButton text={inputText} />
                
                <button
                  className={styles.toggleDiffBtn}
                  onClick={() => setShowDifference1(!showDifference1)}
                >
                  {showDifference1 ? "Hide the comparison" : "Compare with input text"}
                </button>

              </div>
            </div>
            <p className={styles.wordCount}>Words: {outputWordCount}</p>

            <textarea
              id="generatedText"
              className={`${styles.output_box} ${styles.side_by_side}`}
              // value={initialgeneratedText}
              value={generatedText}
          readOnly
          placeholder="Initial AI-Generated Text"

            ></textarea>
              {/* Difference Box appears right below System-generated Text */}
              {showDifference1 && (
              <div className={styles.diff_box}>
                <label className={styles.label}>Input vs AI-generated Text</label>
                <div className={`${styles.diff_output}`} dangerouslySetInnerHTML={{ __html: diffHtml1 }}></div>
              </div>
            )}
          </div>

          <div className={styles.text_container}>
            <div className={styles.labelWrapper}>
            <label className={styles.label} htmlFor="submittedText">Final Revised Text</label>
            {/* <textarea className={styles.textarea} value={latestText} readOnly></textarea> */}

                  {/* <textarea value={latestFinalText} readOnly /> */}


              <div className={styles.actions}>
                <div
                  className={styles.copyIcon}
                  onClick={() => handleCopy(latestFinalText)}
                  title="Copy to Clipboard"
                >
                  📋 {/* Clipboard Emoji */}
                </div>

                <div
                  className={styles.copyIcon}
                  onClick={() => handleDownload(latestFinalText, "SubmittedText", "txt")}
                  title="Download as .txt file"
                >
                  📥 {/* Download Icon */}
                </div>
                  <StatsButton text={inputText} />

                <button
                  className={styles.toggleDiffBtn}
                  onClick={() => setShowDifference2(!showDifference2)}
                >
                  {showDifference2 ? "Hide the comparison" : "Compare with AI-generated text"}
                </button>

              </div>
            </div>
            {/* <textarea id="EditedText" className={`${styles.output_box} ${styles.side_by_side}`} value={latestFinalText} readOnly/>
            */}
                        
                          <p className={styles.wordCount}>Words: {submittedWordCount}</p>

            <textarea
                        id="submittedText"
                        className={`${styles.output_box} ${styles.side_by_side}`}
                        value={latestFinalText}
                        readOnly
                        placeholder="Final Revised Text"
                      ></textarea>

                        {/* Difference Box appears right below Submitted Text */}
            {showDifference2 && (
              <div className={styles.diff_box}>
                <label className={styles.label}>AI-generated vs Final revised Text</label>
                <div className={`${styles.diff_output}`} dangerouslySetInnerHTML={{ __html: diffHtml2 }}></div>
              </div>
            )}
          </div>
            
        

            <div className={styles.diff_container}>

            </div>
        
        </div>

            {/* <div> */}
        <div className={styles.surveyContainer}>

          <form className={styles.surveyForm} onSubmit={handleFormSubmit}>
                <h2>Survey</h2>
                <h3>Your feedback is valuable. Please try to answer all the questions.</h3>


            <div className={styles.surveyQuestion}>
              <label>Does the AI-generated text meet your needs? 
                {/* <span style={{ color: "red" }}>*</span> 
              */}
              </label>
              <div className={styles.surveyOptions}>
              <label><input type="radio" name="needs" value="not-at-all" onChange={handleOptionChange}  />  Not at all</label>
                <label><input type="radio" name="needs" value="somewhat-meets" onChange={handleOptionChange}  />  Somewhat meets</label>
                <label><input type="radio" name="needs" value="moderately-meets" onChange={handleOptionChange}  />  Moderately meets</label>
                <label><input type="radio" name="needs" value="mostly-meets" onChange={handleOptionChange}  />  Mostly meets</label>
                <label><input type="radio" name="needs" value="completely-meets" onChange={handleOptionChange}  />  Completely meets</label>
              </div>
            </div>

          <div className={styles.surveyQuestion}>
              <label>Is the AI-generated text easy to understand?  </label>
              <div className={styles.surveyOptions}>
                <label>
                  <input type="radio" name="easy" value="not-clear" onChange={handleOptionChange}  />  Not easy at all
                </label>
                <label>
                  <input type="radio" name="easy" value="somewhat-clear" onChange={handleOptionChange}  />  Somewhat easy
                </label>
                <label>
                  <input type="radio" name="easy" value="moderately-clear" onChange={handleOptionChange}  />  Moderately easy
                </label>
                <label>
                  <input type="radio" name="easy" value="mostly-clear" onChange={handleOptionChange}  />  Mostly easy
                </label>
                <label>
                  <input type="radio" name="easy" value="very-clear" onChange={handleOptionChange}  />  Completely easy
                </label>
              </div>
            </div>

            <div className={styles.surveyQuestion}>
              <label>Does the AI-generated text preserve the original meaning? </label>
              <div className={styles.surveyOptions}>
                <label>
                  <input type="radio" name="meaning" value="not-at-all" onChange={handleOptionChange}  />  Not at all
                </label>
                <label>
                  <input type="radio" name="meaning" value="somewhat-preserves" onChange={handleOptionChange}  />  Somewhat preserves
                </label>
                <label>
                  <input type="radio" name="meaning" value="moderately-preserves" onChange={handleOptionChange}  />  Moderately preserves
                </label>
                <label>
                  <input type="radio" name="meaning" value="mostly-preserves" onChange={handleOptionChange}  />  Mostly preserves
                </label>
                <label>
                  <input type="radio" name="meaning" value="completely-preserves" onChange={handleOptionChange}  />  Completely preserves
                </label>
              </div>
            </div>

            <div className={styles.surveyQuestion}>
              <label>Does the AI-generated text contain false or irrelevant information?  </label>
              <div className={styles.surveyOptions}>
                <label>
                  <input type="radio" name="relevancy" value="not-at-all" onChange={handleOptionChange}  />  A lot of inaccuracies
                </label>
                <label>
                  <input type="radio" name="relevancy" value="somewhat" onChange={handleOptionChange}  />  Several inaccuracies
                </label>
                <label>
                  <input type="radio" name="relevancy" value="moderately" onChange={handleOptionChange}  />  Some minor inaccuracies
                </label>
                <label>
                  <input type="radio" name="relevancy" value="mostly" onChange={handleOptionChange}  />  Mostly accurate
                </label>
                <label>
                  <input type="radio" name="relevancy" value="completely" onChange={handleOptionChange}  />  Completely accurate
                </label>
              </div>
            </div>

            <div className={styles.surveyQuestion}>
              <label>Are there spelling or grammar mistakes in the AI-generated text? </label>
              <div className={styles.surveyOptions}>
                <label>
                  <input type="radio" name="grammar" value="many-errors" onChange={handleOptionChange}  />  Many mistakes
                </label>
                <label>
                  <input type="radio" name="grammar" value="several-errors" onChange={handleOptionChange}  />  Several mistakes
                </label>
                <label>
                  <input type="radio" name="grammar" value="some-errors" onChange={handleOptionChange}  />  Some mistakes
                </label>
                <label>
                  <input type="radio" name="grammar" value="few-errors" onChange={handleOptionChange}  />  Few mistakes
                </label>
                <label>
                  <input type="radio" name="grammar" value="no-errors" onChange={handleOptionChange}  />  No mistakes
                </label>
              </div>
            </div>



            <div className={styles.surveyQuestion}>
              <label>Does the AI-generated text avoid difficult words?     </label>
              <div className={styles.surveyOptions}>
              <label><input type="radio" name="guidelines" value="not-at-all" onChange={handleOptionChange}  />  Not at all</label>
                <label><input type="radio" name="guidelines" value="somewhat-follows" onChange={handleOptionChange}  />  Somewhat</label>
                <label><input type="radio" name="guidelines" value="moderately-follows" onChange={handleOptionChange}  />  Moderately</label>
                <label><input type="radio" name="guidelines" value="mostly-follows" onChange={handleOptionChange}  />  Mostly</label>
                <label><input type="radio" name="guidelines" value="completely-follows" onChange={handleOptionChange}  />  Completely </label>
              </div>
            </div>

            <div className={styles.surveyQuestion}>
              <label>Does the AI-generated text use short sentences and clear headings?    </label>
              <div className={styles.surveyOptions}>
              <label><input type="radio" name="clarity" value="not-at-all" onChange={handleOptionChange}  />  Not at all</label>
                <label><input type="radio" name="clarity" value="somewhat-follows" onChange={handleOptionChange}  />  Somewhat </label>
                <label><input type="radio" name="clarity" value="moderately-follows" onChange={handleOptionChange}  />  Moderately</label>
                <label><input type="radio" name="clarity" value="mostly-follows" onChange={handleOptionChange}  />  Mostly</label>
                <label><input type="radio" name="clarity" value="completely-follows" onChange={handleOptionChange}  />  Completely </label>
              </div>
            </div>

            <div className={styles.surveyQuestion}>
              <label>Does the AI-generated text flow logically from start to finish? </label>
              <div className={styles.surveyOptions}>
              <label><input type="radio" name="coherent" value="not-at-all" onChange={handleOptionChange}  />  Not at all</label>
                <label><input type="radio" name="coherent" value="somewhat-follows" onChange={handleOptionChange}  />  Somewhat </label>
                <label><input type="radio" name="coherent" value="moderately-follows" onChange={handleOptionChange}  />  Moderately</label>
                <label><input type="radio" name="coherent" value="mostly-follows" onChange={handleOptionChange}  />  Mostly</label>
                <label><input type="radio" name="coherent" value="completely-follows" onChange={handleOptionChange}  />  Completely </label>
              </div>
            </div>

            <div className={styles.surveyQuestion}>
              <label>How much effort did you need to edit the AI-generated text? </label>
              <div className={styles.surveyOptions}>
              <label><input type="radio" name="editing_effort" value="many-errors" checked={responses.editing_effort === "many-errors"} onChange={handleOptionChange}/>  A lot of effort</label>
                <label><input type="radio" name="editing_effort" value="several-errors" checked={responses.editing_effort === "several-errors"} onChange={handleOptionChange}/>  Significant effort</label>
                <label><input type="radio" name="editing_effort" value="some-errors" checked={responses.editing_effort === "some-errors"} onChange={handleOptionChange}/>  Moderate effort</label>
                <label><input type="radio" name="editing_effort" value="few-errors" checked={responses.editing_effort === "few-errors"} onChange={handleOptionChange}/>  Minimal effort</label>
                <label><input type="radio" name="editing_effort" value="no-errors" checked={responses.editing_effort === "no-errors"} onChange={handleOptionChange}/>  No effort at all</label>
              </div>
            </div>

            <div className={styles.surveyQuestion}>
              <label>If you edited the AI-generated text, what were your main reasons for it?</label>
              <textarea
                // className={styles.textarea}
                name="main_reasons"
                rows="3"
                cols="70"
                placeholder=""
                value={responses.main_reasons}
                onChange={handleTextChange}
              ></textarea>
            </div>

            <div className={styles.surveyQuestion}>
              <label>Do you have any additional comments about the AI-generated text? </label>
              <textarea
                // className={styles.textarea}
                name="additional_comments"
                rows="4"
                cols="70"
                placeholder=""
                value={responses.additional_comments}
                onChange={handleTextChange}
              ></textarea>
            </div>

            <div>
              <button className={styles.submitButton} type="submit" >Submit</button>
            </div>

          </form>

        </div>
  {/* disabled={!isFormComplete} */}
  </div>

) : (
  // Thank You Message & Redirect
  <div className={styles.thankYouContainer}>
    <h2>Thank You!</h2>
    <p>Your responses have been saved. We appreciate your feedback.</p>
    <button
      className={styles.redirectButton}
      onClick={() => navigate("/simplify", { replace: true })}
    >
      Start Another Simplification
    </button>
    <Footer />  
  </div>
)}
</div>

<Footer />  
</>
  );
};

export default SurveyPage;