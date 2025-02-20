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
  const [submitted, setSubmitted] = useState(false);

  const [responses, setResponses] = useState({
    clarity: "",
    meaning: "",
    grammar: "",
    needs: "",
    guidelines: "",
    coherent: "",
    editing_effort: null, // Track selection for this question
  });

  // Handle input changes
  // const handleOptionChange = (event) => {
  //   setResponses({ ...responses, [event.target.name]: event.target.value });
  // };

  // Handle input changes, allowing deselection
const handleOptionChange = (event) => {
  const { name, value } = event.target;
  setResponses((prevResponses) => ({
    ...prevResponses,
    [name]: prevResponses[name] === value ? null : value, // Toggle selection
  }));
};
  // Check if all required fields are filled
  const isFormComplete = Object.values(responses).every((value) => value !== "");


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

  // Handle form submission
  const handleFormSubmit = (event) => {
    event.preventDefault();

    if (!isFormComplete) {
      alert("Please answer all required questions before submitting.");
      return;
    }

    // Simulate saving responses (replace with API call if needed)
    console.log("Survey Responses:", responses);

    // Show the thank-you message
    setSubmitted(true);
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
		  <h1>Text Simplification Tool</h1>
		  <button className={styles.white_btn} onClick={handleLogout}>
			Logout
		  </button>
		</nav>

    {!submitted ? (
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
        {showDifference1 ? "Hide the comparison" : "Compare with input text"}
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
        {showDifference2 ? "Hide the comparison" : "Compare with system-generated text"}
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


      {/* <div> */}
  <div className={styles.surveyContainer}>

    <form className={styles.surveyForm} onSubmit={handleFormSubmit}>
      <h2>Survey</h2>
      <p><strong>Your feedback is valuable. Please answer all required questions.</strong></p>

			{/* <h3 class="centered">Survey</h3>

      <p>
        <strong>Kindly answer the questions below. Your feedback is valuable to us.</strong>
      </p> */}

{/* <form onSubmit={handleFormSubmit}> */}
{/* 
<form class={styles.surveyForm} onSubmit={handleFormSubmit}> */}

       {/* Survey Questions */}

<div className={styles.surveyQuestion}>
    <label>Is the system generated text clear and free of confusing language? <span style={{ color: "red" }}>*</span> </label>
    <div className={styles.surveyOptions}>
      <label>
        <input type="radio" name="clarity" value="not-clear" onChange={handleOptionChange} required />  Not clear at all
      </label>
      <label>
        <input type="radio" name="clarity" value="somewhat-clear" onChange={handleOptionChange} required />  Somewhat clear
      </label>
      <label>
        <input type="radio" name="clarity" value="moderately-clear" onChange={handleOptionChange} required />  Moderately clear
      </label>
      <label>
        <input type="radio" name="clarity" value="mostly-clear" onChange={handleOptionChange} required />  Mostly clear
      </label>
      <label>
        <input type="radio" name="clarity" value="very-clear" onChange={handleOptionChange} required />  Very clear
      </label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label>Does the system generated text preserve the original meaning? <span style={{ color: "red" }}>*</span> </label>
    <div className={styles.surveyOptions}>
      <label>
        <input type="radio" name="meaning" value="not-at-all" onChange={handleOptionChange} required />  Not at all
      </label>
      <label>
        <input type="radio" name="meaning" value="somewhat-preserves" onChange={handleOptionChange} required />  Somewhat preserves
      </label>
      <label>
        <input type="radio" name="meaning" value="moderately-preserves" onChange={handleOptionChange} required />  Moderately preserves
      </label>
      <label>
        <input type="radio" name="meaning" value="mostly-preserves" onChange={handleOptionChange} required />  Mostly preserves
      </label>
      <label>
        <input type="radio" name="meaning" value="completely-preserves" onChange={handleOptionChange} required />  Completely preserves
      </label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label>Are there grammatical errors in the system generated text? <span style={{ color: "red" }}>*</span> </label>
    <div className={styles.surveyOptions}>
      <label>
        <input type="radio" name="grammar" value="many-errors" onChange={handleOptionChange} required />  Many errors
      </label>
      <label>
        <input type="radio" name="grammar" value="several-errors" onChange={handleOptionChange} required />  Several errors
      </label>
      <label>
        <input type="radio" name="grammar" value="some-errors" onChange={handleOptionChange} required />  Some errors
      </label>
      <label>
        <input type="radio" name="grammar" value="few-errors" onChange={handleOptionChange} required />  Few errors
      </label>
      <label>
        <input type="radio" name="grammar" value="no-errors" onChange={handleOptionChange} required />  No errors
      </label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label>Does the system generated text meet your needs? <span style={{ color: "red" }}>*</span> </label>
    <div className={styles.surveyOptions}>
    <label><input type="radio" name="needs" value="not-at-all" onChange={handleOptionChange} required />  Not at all</label>
      <label><input type="radio" name="needs" value="somewhat-meets" onChange={handleOptionChange} required />  Somewhat meets</label>
      <label><input type="radio" name="needs" value="moderately-meets" onChange={handleOptionChange} required />  Moderately meets</label>
      <label><input type="radio" name="needs" value="mostly-meets" onChange={handleOptionChange} required />  Mostly meets</label>
      <label><input type="radio" name="needs" value="completely-meets" onChange={handleOptionChange} required />  Completely meets</label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label>Does the system generated text follow the IDD guidelines for sentence structure and organization? <span style={{ color: "red" }}>*</span> </label>
    <div className={styles.surveyOptions}>
    <label><input type="radio" name="guidelines" value="not-at-all" onChange={handleOptionChange} required />  Not at all</label>
      <label><input type="radio" name="guidelines" value="somewhat-follows" onChange={handleOptionChange} required />  Somewhat follows</label>
      <label><input type="radio" name="guidelines" value="moderately-follows" onChange={handleOptionChange} required />  Moderately follows</label>
      <label><input type="radio" name="guidelines" value="mostly-follows" onChange={handleOptionChange} required />  Mostly follows</label>
      <label><input type="radio" name="guidelines" value="completely-follows" onChange={handleOptionChange} required />  Completely follows</label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label>Is the system generated text coherent in terms of sentence flow and organization? <span style={{ color: "red" }}>*</span> </label>
    <div className={styles.surveyOptions}>
    <label><input type="radio" name="coherent" value="not-at-all" onChange={handleOptionChange} required />  Not at all</label>
      <label><input type="radio" name="coherent" value="somewhat-follows" onChange={handleOptionChange} required />  Somewhat coherent</label>
      <label><input type="radio" name="coherent" value="moderately-follows" onChange={handleOptionChange} required />  Moderately coherent</label>
      <label><input type="radio" name="coherent" value="mostly-follows" onChange={handleOptionChange} required />  Mostly coherent</label>
      <label><input type="radio" name="coherent" value="completely-follows" onChange={handleOptionChange} required />  Completely coherent</label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label><strong>[OPTIONAL]</strong> How much effort was needed to edit the simplified text to make it acceptable? </label>
    <div className={styles.surveyOptions}>
    <label><input type="radio" name="editing_effort" value="many-errors" checked={responses.editing_effort === "many-errors"} onChange={handleOptionChange}/>  A lot of effort</label>
      <label><input type="radio" name="editing_effort" value="several-errors" checked={responses.editing_effort === "several-errors"} onChange={handleOptionChange}/>  Significant effort</label>
      <label><input type="radio" name="editing_effort" value="some-errors" checked={responses.editing_effort === "some-errors"} onChange={handleOptionChange}/>  Moderate effort</label>
      <label><input type="radio" name="editing_effort" value="few-errors" checked={responses.editing_effort === "few-errors"} onChange={handleOptionChange}/>  Minimal effort</label>
      <label><input type="radio" name="editing_effort" value="no-errors" checked={responses.editing_effort === "no-errors"} onChange={handleOptionChange}/>  No effort at all</label>
    </div>
  </div>

  <div className={styles.surveyQuestion}>
    <label><strong>[OPTIONAL]</strong> Do you have any additional comments about the system generated text? </label>
    <textarea
      // className={styles.textarea}
      name="comments"
      rows="4"
      cols="70"
      placeholder="Enter your feedback or any additional comments here"
    ></textarea>
  </div>

  <div>
    <button className={styles.submitButton} type="submit" disabled={!isFormComplete}>Submit</button>
  </div>

</form>
</div>

</div>
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
  </div>
)}



</>
  );
};

export default SurveyPage;

       {/* <div className={styles.surveyQuestion}>
            <label>Is the system-generated text clear and free of confusing language?</label>
            <div className={styles.surveyOptions}>
              {["not-clear", "somewhat-clear", "moderately-clear", "mostly-clear", "very-clear"].map((option) => (
                <label key={option}>
                  <input type="radio" name="clarity" value={option} onChange={handleOptionChange} required />
                  {option.replace("-", " ")}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.surveyQuestion}>
            <label>Does the system-generated text preserve the original meaning?</label>
            <div className={styles.surveyOptions}>
              {["not-at-all", "somewhat-preserves", "moderately-preserves", "mostly-preserves", "completely-preserves"].map((option) => (
                <label key={option}>
                  <input type="radio" name="meaning" value={option} onChange={handleOptionChange} required />
                  {option.replace("-", " ")}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.surveyQuestion}>
            <label>Are there grammatical errors in the system-generated text?</label>
            <div className={styles.surveyOptions}>
              {["many-errors", "several-errors", "some-errors", "few-errors", "no-errors"].map((option) => (
                <label key={option}>
                  <input type="radio" name="grammar" value={option} onChange={handleOptionChange} required />
                  {option.replace("-", " ")}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.surveyQuestion}>
            <label>Does the system-generated text meet your needs?</label>
            <div className={styles.surveyOptions}>
              {["not-at-all", "somewhat-meets", "moderately-meets", "mostly-meets", "completely-meets"].map((option) => (
                <label key={option}>
                  <input type="radio" name="needs" value={option} onChange={handleOptionChange} required />
                  {option.replace("-", " ")}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.surveyQuestion}>
            <label>Does the system-generated text follow the IDD guidelines for sentence structure and organization?</label>
            <div className={styles.surveyOptions}>
              {["not-at-all", "somewhat-follows", "moderately-follows", "mostly-follows", "completely-follows"].map((option) => (
                <label key={option}>
                  <input type="radio" name="guidelines" value={option} onChange={handleOptionChange} required />
                  {option.replace("-", " ")}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.surveyQuestion}>
            <label>Is the system-generated text coherent in terms of sentence flow and organization?</label>
            <div className={styles.surveyOptions}>
              {["not-at-all", "somewhat-coherent", "moderately-coherent", "mostly-coherent", "completely-coherent"].map((option) => (
                <label key={option}>
                  <input type="radio" name="coherent" value={option} onChange={handleOptionChange} required />
                  {option.replace("-", " ")}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.surveyQuestion}>
            <label>Is the system-generated text coherent in terms of sentence flow and organization?</label>
            <div className={styles.surveyOptions}>
              {["not-at-all", "somewhat-coherent", "moderately-coherent", "mostly-coherent", "completely-coherent"].map((option) => (
                <label key={option}>
                  <input type="radio" name="editing_effort" value={option} onChange={handleOptionChange} required />
                  {option.replace("-", " ")}
                </label>
              ))}
            </div>
          </div>


          <div className={styles.surveyQuestion}>
            <label><strong>[OPTIONAL]</strong> Additional comments:</label>
            <textarea name="comments" rows="4" cols="70" placeholder="Enter your feedback here"></textarea>
          </div> */}
