import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import styles from "./styles.module.css";
import {jwtDecode} from "jwt-decode"; // Import the jwt-decode library

const Login = () => {
	const [data, setData] = useState({ email: "", password: "" });
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false); 

	const handleChange = ({ currentTarget: input }) => {
		setData({ ...data, [input.name]: input.value });
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		console.log("hahahaha");
		try {
			const url = "http://localhost:5001/api/auth";
			const { data: res } = await axios.post(url, data);
			console.log("Response from server:", res);
			// localStorage.setItem("token", res.data);
			// window.location = "/";

			// Save token and user info in localStorage

			localStorage.setItem("token", res.data); // Save token

			const decodedToken = jwtDecode(res.data);
			console.log("Decoded token:", decodedToken);
		
			// Extract email from the decoded token
			const user = {
			  _id: decodedToken._id,
			  email: decodedToken.email,
			};
			console.log("User info extracted from token:", user);
		
			// Save the user object in localStorage
			localStorage.setItem("user", JSON.stringify(user));
		
			window.location = "/"; // Redirect to homepage
		} catch (error) {
			if (
				error.response &&
				error.response.status >= 400 &&
				error.response.status <= 500
			) {
				setError(error.response.data.message);
			}
		}
	};

	return (
		<div className={styles.main_container}>
		{/* Navbar */}
		<nav className={styles.navbar}>
			{/* <h1>Text Simplification Tool</h1> */}
			<h1 
    onClick={() => window.location.href = "http://localhost:5001/"}
    style={{ cursor: "pointer" }} // Makes it look clickable
 		>
		Text Simplification Tool</h1>
		</nav>

		<div className={styles.login_container}>
			<div className={styles.login_form_container}>
				<div className={styles.left}>
					<form className={styles.form_container} onSubmit={handleSubmit}>
						<h1>Login to Your Account</h1>

							{/* Email Input */}
							<input
								type="email"
								placeholder="Email"
								name="email"
								onChange={handleChange}
								value={data.email}
								required
								className={styles.input}
							/>

							{/* Password Input with Show/Hide Toggle */}
							<div className={styles.passwordContainer}>
								<input
									type={showPassword ? "text" : "password"}
									placeholder="Password"
									name="password"
									onChange={handleChange}
									value={data.password}
									required
									className={styles.input}
								/>
								<button
									type="button"
									className={styles.showHideBtn}
									onClick={() => setShowPassword((prev) => !prev)}
								>
									{showPassword ? "Hide" : "Show"}
								</button>
							</div>

						{/* <input
							type="email"
							placeholder="Email"
							name="email"
							onChange={handleChange}
							value={data.email}
							required
							className={styles.input}
						/>
						<input
							type="password"
							placeholder="Password"
							name="password"
							onChange={handleChange}
							value={data.password}
							required
							className={styles.input}
						/> */}
						{error && <div className={styles.error_msg}>{error}</div>}
						<button type="submit" className={styles.green_btn}>
							Sign In
						</button>
					</form>
				</div>
				<div className={styles.right}>
					<h1>New Here ?</h1>
					<Link to="/signup">
						<button type="button" className={styles.white_btn}>
							Sign Up
						</button>
					</Link>
				</div>
			</div>
		</div>
		</div>
	);
};

export default Login;
