const express = require('express');
const userModel = require('../models/usermodel.js');
const app = express();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const mongoose = require('mongoose');

//setting up the mailer

let loggeduser;

const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.MAILER_ID ,
		pass: process.env.MAILER_PASS
	},
	tls: {
		rejectUnauthorized: false
	}
});
transporter.verify(function(error, success) {
	if (error) {
		console.log(error);
	} else {
		console.log('Server is ready to take our messages');
	}
});

// question model, since we will use them multiple times for different collections

const questionSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true
	},
	link: {
		type: String,
		required: true,
		trim: true
	},
	completed: {
		type: Boolean,
		required: true,
		default: false
	},
});


// Authentication Begins

var otp;


app.post('/validate', async (req, res) => {

	if(req.session.user)
	{
		res.status(401).send("Already Logged In");
	}
	else
	{
		const {name,email,password,github,codeforces} = req.body;
		const user = await userModel.find({'email':req.body.email});
		try {
			if(user.length == 0)
			{
				var otp = Math.floor((Math.random() * 10000) + 1);
				const mailOptions = {
					from: process.env.MAILER_ID,
					to: email,
					subject: 'Welcome to Coding Buddy (Testing)' + name,
					text: 'Welcome to Coding Buddy! Your Code to Complete the Registration Process is - '+otp
				};

				var pwdHash = bcrypt.hashSync(password, 10);
				var otpHash = bcrypt.hashSync(String(otp), 10);
				const tempuser = 
				{
					"name": name,
					"email": email,
					"password": pwdHash,
					"github": github,
					"codeforces": codeforces,
					"otp": otpHash
				}
				req.session.temp = tempuser;

				transporter.sendMail(mailOptions, function(err, data) { 
					if(err) { 
						console.log('Error Occured in sending mail' + err);
						res.status(500).send("Couldn't send Email");
					} else { 
						console.log('Email sent successfully'); 
						res.status(200).send("Email sent successfully!");
					} 
				});
			}
			else
			{
				res.status(500).send("Email already registered!");
			}
		} 
		catch (err) 
		{
			console.log("Error with database");
			console.log(err);
			res.status(500).send(err); 
		}
	}

});



app.post('/signup', async (req, res) => {

	if(req.session.user)
	{
		res.status(401).send("Already Logged In");
	}
	else
	{
		const {name,email,password,otp,codeforces,github} = req.session.temp;
		const code = req.body.code;
		if(bcrypt.compareSync(code, req.session.temp.otp))
		{
			const data = {
				"name": req.session.temp.name,
				"email": req.session.temp.email,
				"password": req.session.temp.password,
				"codeforces": req.session.temp.codeforces,
				"github": req.session.temp.github
			};


			const datadef = {
				"name": "Hello World",
				"link": "https://www.hackerrank.com/challenges/30-hello-world/problem",
				"completed": false
			};

			const new_user = new userModel(data);

			var uniquequestion = "question"+req.session.temp.email;

			var questionuser = mongoose.model(uniquequestion, questionSchema);

			var defquestion = new questionuser(datadef);

			try{
				await defquestion.save();
				console.log("Default Question has been saved");
			}
			catch (err)
			{
				console.log(err);
				console.log("Default Question cannot be saved");
			}

			try {
				await new_user.save();
				res.status(200).send("Your Profile has been created!");
			} catch (err) {
				console.log(err);
				res.status(500).send("Cannot Create Profile! Try Again");
			}

		}
		else
		{
			res.status(401).send("OTP isn't verified! Please try again");
		}
	}

});

app.post('/login', async (req,res) => {
	if(req.session.user)
	{
		res.status(401).send("Already Logged In");
	}
	else
	{
		const {email,password} = req.body;
		const user = await userModel.find({'email':req.body.email});
		try {
			if(user.length>0)
			{
				const result = bcrypt.compareSync(password, user[0].password);
				if(result)
				{
					req.session.user = user[0];
					res.status(200).json(req.session.user);
				}
				else
				{
					res.status(401).send("Incorrect Password");
				}
			}
			else
			{
				res.status(401).send("The email isn't registered.");
			}
		}
		catch(err)
		{
			res.status(500).send("Cannot Connect to Database!");
		}
	}

});

app.get("/logout", (req, res) => {
	if (req.session.user) {
		req.session.destroy(() => {
			res.status(200).send("Successfully Logged Out");
		})
	}
	else 
	{
		res.status(401).send("You are not logged in");
	}
});

// Authentication Ends Here

// User-related Requests

app.patch("/edit", async (req, res) => {
	if (req.session.user) {
		var user = await userModel.findOneAndUpdate({'email':req.session.user.email},{ "$set": { "name": req.body.name, "github": req.body.github, "codeforces": req.body.codeforces}},{new: true});
		try
		{
			req.session.user = user;
			res.status(200).json(req.session.user);
		}
		catch(err)
		{
			res.status(500).send("Error occured while Updating Database");
		}
	}
	else 
	{
		res.status(401).send("Please Log In to continue");
	}
});


app.get("/dashboard", async (req, res) => {
	console.log(req.session.user);
	if (req.session.user) {
		res.status(200).json(req.session.user);
	}
	else 
	{
		res.status(401).send("Please log in to continue");
	}
});


app.get("/question", async (req, res) => {
	if (req.session.user) {

		var uniquequestion = "question"+req.session.user.email;

		var questionuser = mongoose.model(uniquequestion, questionSchema);

		const list = await questionuser.find({});
		try 
		{
			res.status(200).json(list);
		} 
		catch (err) 
		{
			console.log(err);
			res.status(500).send("Could not connect to the database");
		}
	}
	else 
	{
		res.status(401).send("Please Log In to continue");
	}
});



app.post("/question", async (req, res) => {
	if (req.session.user) {

		var uniquequestion = "question"+req.session.user.email;

		var questionuser = mongoose.model(uniquequestion, questionSchema);

		const data = {
			"name": req.body.name,
			"link": req.body.link,
			"completed": false
		};

		var question = new questionuser(data);

		try{
			await question.save();
			res.status(200).json(question);
		}
		catch (err)
		{
			console.log(err);
			res.status(500).json("Question cannot be saved");
		}

	}
	else 
	{
		res.status(401).send("Please Log In to continue");
	}
});




app.patch("/question", async (req, res) => {
	if (req.session.user) {

		var uniquequestion = "question"+req.session.user.email;

		var questionuser = mongoose.model(uniquequestion, questionSchema);

		var question = await questionuser.findOneAndUpdate({'_id':req.body._id},{ "$set": { "name": req.body.name, "link": req.body.link}},{new: true});

		try{
			res.status(200).json(question);
		}
		catch (err)
		{
			console.log(err);
			res.status(500).json("Question cannot be edited");
		}

	}
	else 
	{
		res.status(401).send("Please Log In to continue");
	}
});



app.patch("/question-edit", async (req, res) => {
	if (req.session.user) {

		var uniquequestion = "question"+req.session.user.email;

		var questionuser = mongoose.model(uniquequestion, questionSchema);

		var question = await questionuser.findOneAndUpdate({'_id':req.body._id},{ "$set": { "completed": req.body.status}},{new: true});

		try{
			res.status(200).json(question);
		}
		catch (err)
		{
			console.log(err);
			res.status(500).json("Question Status cannot be edited");
		}

	}
	else 
	{
		res.status(401).send("Please Log In to continue");
	}
});




// PUBLIC API Endpoints

app.get("/profile", async (req, res) => {

	var user = await userModel.findOne({'_id':req.query.id});
	try
	{
		res.status(200).json(user);
	}
	catch(err)
	{
		res.status(500).send("Error occured while Updating Database");
	}
});




module.exports = app