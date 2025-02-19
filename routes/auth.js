const router = require("express").Router();
const { User } = require("../models/user");
const bcrypt = require("bcrypt");
const Joi = require("joi");

router.post("/", async (req, res) => {
	console.log("Login request received:", req.body);

	try {
		const { error } = validate(req.body);
		if (error)
			return res.status(400).send({ message: error.details[0].message });

		const user = await User.findOne({ email: req.body.email });
		if (!user)
			{
				console.log("User not found:", req.body.email);
			return res.status(401).send({ message: "Invalid Email or Password" });
			}

		const validPassword = await bcrypt.compare(
			req.body.password,
			user.password
		);
		if (!validPassword)
		{console.log("Invalid password for user:", req.body.email);
			return res.status(401).send({ message: "Invalid Email or Password" });
		}
			

		const token = user.generateAuthToken();
		//res.status(200).send({ data: token, message: "logged in successfully" });
		
		// Include user details in the response
		console.log("Login successful for user:", req.body.email);
		res.status(200).send({
			data: token,
			user: {
				_id: user._id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
			},
			message: "Logged in successfully",
			});
		} catch (error) {
		res.status(500).send({ message: "Internal Server Error" });
	}
});

const validate = (data) => {
	const schema = Joi.object({
		email: Joi.string().email().required().label("Email"),
		password: Joi.string().required().label("Password"),
	});
	return schema.validate(data);
};

module.exports = router;
