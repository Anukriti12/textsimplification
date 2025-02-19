require("dotenv").config();
console.log("Environment variables loaded:", process.env.PORT);

const express = require("express");
const app = express();
const cors = require("cors");
const connection = require("./db");
const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const simplificationRoutes = require("./routes/simplifications");
const serverRoutes = require("./routes/server");
const path = require("path")
// database connection
connection();

// middlewares
app.use(express.json());
app.use(cors());

// routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/simplifications", simplificationRoutes);
app.use("/api/gpt4", serverRoutes);

app.use(express.static("./client/build"));
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
});

const port = process.env.PORT || 8080;
// app.listen(port, console.log(`Listening on port ${port}...`));
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
