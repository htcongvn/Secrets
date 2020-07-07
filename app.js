//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const saltRounds = 10;


const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

const uri = 'mongodb+srv://' + process.env.MONGODB_USER + ':' + process.env.MONGODB_PW + '@cluster0-vb5ud.mongodb.net/usersDB?retryWrites=true';
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
}, function(err) {
  if (!err) {
    console.log("Succesfully connected to usersDB database!");
  } else {
    mongoose.connection.close();
    console.log("Failed to connect to usersDB database!", err);
    process.exit(500);;
  }
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: [true, 'Please check your data entry, this email existed!'],
    required: [true, 'Please check your data entry, no email specified!']
  },
  password: String
});

const User = mongoose.model('User', userSchema);

////////////// app
app.get("/", function(req,res) {
  res.render("home");
});

app.get("/login", function(req,res) {
  res.render("login");
});

app.get("/register", function(req,res) {
  res.render("register");
});

app.post("/register", function(req,res) {

  bcrypt.hash(req.body.password, saltRounds, async function(err, hashedPassword) {
    if (req.body.username.length > 0) {
      const newUser = new User({
        email: req.body.username,
        password: hashedPassword
      });

      try {
        const savedNewUser = await newUser.save();
        if (savedNewUser === newUser) {
          res.render("secrets");
        }
      } catch (err) {
        if (err.code === 11000) {
          res.send("Email " + err.keyValue["email"] + " already existed!");
        } else {
          res.send(err);
        }
      }
    } else {
      res.send("Email is not specified!");
    }
  });

});

app.post("/login", function(req, res) {
  const username = req.body.username;

  User.findOne({ email: username }, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        bcrypt.compare(req.body.password, foundUser.password, function(err, result) {
          if (result === true) {
            res.render("secrets");
          } else {
            res.send("Password does not match!");
          }
        });
      } else {
        res.send("Username " + username + " does not exist!");
      }
    }
  });

})

/////////////

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("Server is running on port " + port);
});
