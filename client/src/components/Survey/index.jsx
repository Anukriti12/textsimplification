import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./styles.module.css";
import { saveAs } from "file-saver";
import DiffMatchPatch from "diff-match-patch";

const handleFormSubmit = (e) => {
  e.preventDefault();
  alert("Survey responses saved");
};

const SurveyPage = () => {
  const { state } = useLocation();
  //const { email, inputText } = state || {};
  const { email, inputText, outputText: initialOutputText, editHistory } = state || {};


  const [data, setData] = useState(null);

  const [showDifference1, setShowDifference1] = useState(false); // For Input Text vs System-generated Text
  const [showDifference2, setShowDifference2] = useState(false); // For System-generated Text vs Submitted Text
  const [diffHtml1, setDiffHtml1] = useState("");
  const [diffHtml2, setDiffHtml2] = useState("");

  const navigate = useNavigate();

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


  const generateDiff = (input, output) => {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(input, output);
    dmp.diff_cleanupSemantic(diffs); // Optional cleanup for better readability
    return dmp.diff_prettyHtml(diffs);
  };

  useEffect(() => {
    const fetchSimplification = async () => {
      try {
        const response = await fetch("https://textsimplification-eecqhvdcduczf8cz.westus-01.azurewebsites.net/api/simplifications/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, inputText }),
        });
  
        const result = await response.json();
  
        if (response.ok) {
          setData(result.data);
          setDiffHtml1(generateDiff(result.data.inputText, result.data.outputText)); // Input vs System-generated
          setDiffHtml2(generateDiff(result.data.outputText, result.data.latestFinalText)); // System-generated vs Submitted
        }
      } catch (error) {
        console.error("Error fetching simplification data:", error);
      }
    };
  
    if (email && inputText) {
      fetchSimplification();
    }
  }, [email, inputText]);


  if (!data)
    {return <p>Loading...</p>;}

  // const { inputText: input, outputText, editedText } = data;
  const { inputText: input, outputText, latestFinalText } = data;

  return (
    <>
		{/* Navbar */}
		<nav className={styles.navbar}>
		  <h1>Text Simplification Study</h1>
		  <button className={styles.white_btn} onClick={handleLogout}>
			Logout
		  </button>
		</nav>

    <div className={styles.main_container}>
    <div className={styles.description}>
			 
            
      			<div className={styles.textareas_container}>

  {/* Input Text */}
  <div className={styles.text_container}>
    <div className={styles.labelWrapper}>
      <label className={styles.label} htmlFor="inputText">
        Input Text
      </label>

    </div>
    <textarea
      id="inputText"
      className={`${styles.textarea} ${styles.side_by_side}`}
      value={input} readOnly placeholder="Input Text"
    ></textarea>
  </div>

			{/* system generated text Box */}
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
        onClick={() => setShowDifference1(!showDifference1)}
      >
        {showDifference1 ? "Hide the comparison with input text" : "Compare with input text"}
      </button>

    </div>
  </div>
  <textarea
    id="outputText"
    className={`${styles.output_box} ${styles.side_by_side}`}
    value={outputText}
readOnly placeholder="Initial Generated Text"

  ></textarea>
</div>

<div className={styles.text_container}>
  <div className={styles.labelWrapper}>
  <label className={styles.label} htmlFor="outputText">Submitted Text</label>
        {/* <textarea value={latestFinalText} readOnly /> */}


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
        onClick={() => handleDownload(outputText, "SubmittedText", "txt")}
        title="Download as TXT"
      >
        📥 {/* Download Icon */}
      </div>

      <button
        className={styles.toggleDiffBtn}
        onClick={() => setShowDifference2(!showDifference2)}
      >
        {showDifference2 ? "Hide the comparison with system-generated text" : "Compare with system-generated text"}
      </button>

    </div>
  </div>
  {/* <textarea id="EditedText" className={`${styles.output_box} ${styles.side_by_side}`} value={latestFinalText} readOnly/>
  */}
  <textarea
              id="submittedText"
              className={`${styles.output_box} ${styles.side_by_side}`}
              value={latestFinalText}
              readOnly
              placeholder="Submitted Text"
            ></textarea>
</div>
			
			</div>

      <div className={styles.diff_container}>
  {/* Difference for Input vs System-generated Text */}
  {showDifference1 && (
    <div className={styles.diff_box}>
      <label className={styles.label}>Input vs System-generated Text</label>

      <div
        className={`${styles.diff_output}`}
        dangerouslySetInnerHTML={{ __html: diffHtml1 }}
      ></div>
    </div>
  )}

  {/* Difference for System-generated vs Submitted Text */}
  {showDifference2 && (
    <div className={styles.diff_box}>
      <label className={styles.label}>System-generated vs Submitted Text</label>

      <div
        className={`${styles.diff_output}`}
        dangerouslySetInnerHTML={{ __html: diffHtml2 }}
      ></div>
    </div>
  )}
</div>
        {/* Difference for Input vs System-generated Text */}
        {/* {showDifference1 && (
          <div className={styles.text_container}>
            <label className={styles.label}>Input vs System-generated Text</label>
            <div
              className={`${styles.diff_output} ${styles.side_by_side}`}
              dangerouslySetInnerHTML={{ __html: diffHtml1 }}
            ></div>
          </div>
        )}
        <br></br> */}

        {/* Difference for System-generated vs Submitted Text */}
        {/* {showDifference2 && (
          <div className={styles.text_container}>
            <label className={styles.label}>System-generated vs Submitted Text</label>
            <div
              className={`${styles.diff_output} ${styles.side_by_side}`}
              dangerouslySetInnerHTML={{ __html: diffHtml2 }}
            ></div>
          </div>
        )} */}

      <div>

			<h3 class="centered">Survey</h3>

      <p>
        <strong>Kindly answer the questions below. Your feedback is valuable to us.</strong>
      </p>

{/* <form onSubmit={handleFormSubmit}> */}

<form class={styles.surveyForm} onSubmit={handleFormSubmit}>


<div className={styles.surveyQuestion}>
    <label>Is the system generated text clear and free of confusing language?</label>
    <div className={styles.surveyOptions}>
      <label>
        <input type="radio" name="clarity" value="not-clear" /> Not clear at all
      </label>
      <label>
        <input type="radio" name="clarity" value="somewhat-clear" /> Somewhat clear
      </label>
      <label>
        <input type="radio" name="clarity" value="moderately-clear" /> Moderately clear
      </label>
      <label>
        <input type="radio" name="clarity" value="mostly-clear" /> Mostly clear
      </label>
      <label>
        <input type="radio" name="clarity" value="very-clear" /> Very clear
      </label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label>Does the system generated text preserve the original meaning?</label>
    <div className={styles.surveyOptions}>
      <label>
        <input type="radio" name="meaning" value="not-at-all" /> Not at all
      </label>
      <label>
        <input type="radio" name="meaning" value="somewhat-preserves" /> Somewhat preserves
      </label>
      <label>
        <input type="radio" name="meaning" value="moderately-preserves" /> Moderately preserves
      </label>
      <label>
        <input type="radio" name="meaning" value="mostly-preserves" /> Mostly preserves
      </label>
      <label>
        <input type="radio" name="meaning" value="completely-preserves" /> Completely preserves
      </label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label>Are there grammatical errors in the system generated text?</label>
    <div className={styles.surveyOptions}>
      <label>
        <input type="radio" name="grammar" value="many-errors" /> Many errors
      </label>
      <label>
        <input type="radio" name="grammar" value="several-errors" /> Several errors
      </label>
      <label>
        <input type="radio" name="grammar" value="some-errors" /> Some errors
      </label>
      <label>
        <input type="radio" name="grammar" value="few-errors" /> Few errors
      </label>
      <label>
        <input type="radio" name="grammar" value="no-errors" /> No errors
      </label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label>Does the system generated text meet your needs?</label>
    <div className={styles.surveyOptions}>
    <label><input type="radio" name="needs" value="not-at-all" /> Not at all</label>
      <label><input type="radio" name="needs" value="somewhat-meets" /> Somewhat meets</label>
      <label><input type="radio" name="needs" value="moderately-meets" /> Moderately meets</label>
      <label><input type="radio" name="needs" value="mostly-meets" /> Mostly meets</label>
      <label><input type="radio" name="needs" value="completely-meets" /> Completely meets</label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label>Does the system generated text follow the IDD guidelines for sentence structure and organization?</label>
    <div className={styles.surveyOptions}>
    <label><input type="radio" name="guidelines" value="not-at-all" /> Not at all</label>
      <label><input type="radio" name="guidelines" value="somewhat-follows" /> Somewhat follows</label>
      <label><input type="radio" name="guidelines" value="moderately-follows" /> Moderately follows</label>
      <label><input type="radio" name="guidelines" value="mostly-follows" /> Mostly follows</label>
      <label><input type="radio" name="guidelines" value="completely-follows" /> Completely follows</label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label>Is the system generated text coherent in terms of sentence flow and organization?</label>
    <div className={styles.surveyOptions}>
    <label><input type="radio" name="coherent" value="not-at-all" /> Not at all</label>
      <label><input type="radio" name="coherent" value="somewhat-follows" /> Somewhat coherent</label>
      <label><input type="radio" name="coherent" value="moderately-follows" /> Moderately coherent</label>
      <label><input type="radio" name="coherent" value="mostly-follows" /> Mostly coherent</label>
      <label><input type="radio" name="coherent" value="completely-follows" /> Completely coherent</label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label><strong>[OPTIONAL]</strong> How much effort was needed to edit the simplified text to make it acceptable?</label>
    <div className={styles.surveyOptions}>
    <label><input type="radio" name="editing_effort" value="many-errors" /> A lot of effort</label>
      <label><input type="radio" name="editing_effort" value="several-errors" /> Significant effort</label>
      <label><input type="radio" name="editing_effort" value="some-errors" /> Moderate effort</label>
      <label><input type="radio" name="editing_effort" value="few-errors" /> Minimal effort</label>
      <label><input type="radio" name="editing_effort" value="no-errors" /> No effort at all</label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label>Do you have any additional comments about the system generated text? (Open-ended)</label>
    <textarea
      // className={styles.textarea}
      name="comments"
      rows="4"
      cols="50"
      placeholder="Enter your comments here..."
    ></textarea>
  </div>


  <div>
    <button className={styles.submitButton} type="submit">Submit</button>
  </div>
</form>


      </div>
      {/* </div> */}
    </div>
    </div>
   
    </>
  );
};

export default SurveyPage;