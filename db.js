const mongoose = require("mongoose");

module.exports = () => {
	const connectionParams = {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	};
	try {
		mongoose.connect(process.env.DB, connectionParams);
		console.log("Connected to database successfully");
	} catch (error) {
		console.log(error);
		console.log("Could not connect database!");
	}
};

// db.js
// const mongoose = require("mongoose");

// module.exports = async function connectDB() {
//   const uri = process.env.DB;
//   if (!uri) throw new Error("MONGO_URI not set");
//   try {
//     await mongoose.connect(uri, {
//       dbName: process.env.DB_NAME || undefined,
//     });
//     console.log("Connected to MongoDB");
//   } catch (err) {
//     console.error("Mongo connect error:", err.message);
//     process.exit(1);
//   }
// };

