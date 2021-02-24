const express = require('express');
const userModel = require('../models/usermodel.js');
const app = express();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");


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


// Authentication Begins

var otp;


app.post('/validate', async (req, res) => {

	if(req.session.user)
	{
		res.status(401).send("Already Logged In");
	}
	else
	{
		const {name,email,password} = req.body;
		const user = await userModel.find({'email':req.body.email});
		try {
			if(user.length == 0)
			{
				otp = Math.floor((Math.random() * 10000) + 1);
				const mailOptions = {
					from: process.env.MAILER_ID,
					to: email,
					subject: 'Welcome to Coding Buddy (Testing)' + name,
					text: 'Welcome to Coding Buddy! Your Code to Complete the Registration Process is - '+otp
				};

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
		const {name,email,password,code,codeforces,github} = req.body;
		if(code==otp)
		{
			var pwdHash = bcrypt.hashSync(password, 10);
			const data = {
				"name": req.body.name,
				"email": req.body.email,
				"password": pwdHash,
				"codeforces": req.body.codeforces,
				"github": req.body.github
			};

			const new_user = new userModel(data);

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
	if (req.session.user) {
		res.status(200).json(req.session.user);
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