// require("dotenv").config();
// console.log("Environment variables loaded:", process.env.PORT);

// const path = require("path")
// const express = require("express");
// const cors = require("cors");
// const connection = require("./db");

// const userRoutes = require("./routes/users");
// const authRoutes = require("./routes/auth");
// const simplificationRoutes = require("./routes/simplifications");
// const serverRoutes = require("./routes/server");

// const app = express();



// // middlewares
// app.use(express.json());
// app.use(cors({
//     origin: true,            // allow all origins (or lock down to your host)
//     credentials: true,
//   }));

// /* -------------------- health -------------------- */
// // app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// // routes
// app.use("/api/users", userRoutes);
// app.use("/api/auth", authRoutes);
// app.use("/api/simplifications", simplificationRoutes);
// app.use("/api/gpt4", serverRoutes);

// app.use(express.static("./client/build"));
// app.get("*", (req, res) => {
//   res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
// });

// const port = process.env.PORT || 3000;
// (async () => {
//   await connection();
//   app.listen(port, () => console.log(`Server running on port ${port}`));
// })();

// // app.listen(port, () => {
// //   console.log(`Server running on port ${port}`);
// // });
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const connection = require("./db");

const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const simplificationRoutes = require("./routes/simplifications");
const serverRoutes = require("./routes/server");

const app = express();

// -------------------- middleware --------------------
app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// -------------------- API routes FIRST --------------------
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/simplifications", simplificationRoutes);
app.use("/api/gpt4", serverRoutes);

// -------------------- static frontend LAST --------------------
const buildPath = path.join(__dirname, "client", "build");
app.use(express.static(buildPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// -------------------- start server --------------------
const port = process.env.PORT || 3000;
(async () => {
  await connection();
  app.listen(port, () => console.log(`Server running on port ${port}`));
})();
