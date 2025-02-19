import { Route, Routes, Navigate } from "react-router-dom";
// import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Survey from "./components/Survey";
import Main from "./components/Main";
import Signup from "./components/Signup";
import Login from "./components/Login";

import Review from "./components/Review";
// import Save from "./components/Save";
// import Edit from "./components/Edit";

function App() {
	const user = localStorage.getItem("token");

	return (
		// <Routes>
		// 	{user && <Route path="/" exact element={<Main />} />}
		// 	<Route path="/signup" exact element={<Signup />} />
		// 	<Route path="/login" exact element={<Login />} />
		// 	<Route path="/survey" element={<Survey />} />
		// 	<Route path="/" element={<Navigate replace to="/login" />} />

		// </Routes>
		<Routes>
		{/* Redirect / to /login if not authenticated */}
		{!user && <Route path="/" element={<Navigate replace to="/login" />} />}
  
		{/* Authenticated routes */}
		{user && <Route path="/simplify" element={<Main />} />}
		
		{/* Redirect / to /simplify for logged-in users */}
		{user && <Route path="/" element={<Navigate replace to="/simplify" />} />}
  
		{/* Public routes */}
		<Route path="/signup" element={<Signup />} />
		<Route path="/login" element={<Login />} />
		<Route path="/survey" element={<Survey />} />
		<Route path="/review" element={<Review />} />

		{/* Default fallback */}
		<Route path="*" element={<Navigate replace to={user ? "/simplify" : "/login"} />} />
	  </Routes>
	);
}

export default App;