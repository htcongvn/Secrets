//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our tittle secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


const uri = 'mongodb+srv://' + process.env.MONGODB_USER + ':' + process.env.MONGODB_PW + '@cluster0-vb5ud.mongodb.net/usersDB?retryWrites=true';
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true
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
  username: {
    type: String,
    unique: [true, 'Please check your data entry, the email existed!'],
    // sparse:true
  },
  password: String,
  googleId: {
    type: String,
  },
  facebookId: {
    type: String,
  },
  secret: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);

passport.use(User.createStrategy());

// serializeUser & deserializeUser are of passport's
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo" // fix Google+ API deprecation in Jan 2029
  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);
    // Save profile.id to googleId in mongodb
    User.findOrCreate({ googleId: profile.id, username: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets",
    // profileFields: ['id', 'displayName', 'photos', 'email']
  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);
    // Save profile.id to facebookId in mongodb
    User.findOrCreate({ facebookId: profile.id, username: profile.id }, function(err, user) {
      return cb(err, user);
    });
  }
));

////////////// app
app.get("/", function(req,res) {
  res.render("home");
});

// send login profile to google
app.get("/auth/google", function(req, res) {
  passport.authenticate("google", { scope: ["profile"] })(req, res, function() {});
});

// google sens back logged in profile to callbackURL and
// function(accessToken, refreshToken, profile, cb) is triggerd
app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login", failureFlash: 'Invalid username or password.' }),
  function(req, res) {
    // Successful authentication, redirect secrets page.
    res.redirect('/secrets');
});

app.get("/auth/facebook", function(req, res) {
  passport.authenticate("facebook")(req, res, function() {});
});

app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: "/login", failureFlash: 'Invalid username or password.' }),
  function(req, res) {
    // Successful authentication, redirect secrets page.
    res.redirect('/secrets');
});

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/secrets", function(req, res) {
  User.find({ "secret": {$ne: null} }, function(err, foundUsers) {
    if (err) {
      console.log(err);
    } else {
        if (foundUsers) {
          res.render("secrets", { usersWithSecrets: foundUsers });
        }
    }
  });
});

app.post("/register", function(req, res) {
  User.register({username: req.body.username}, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });
});

// app.post("/login", passport.authenticate('local', { failureRedirect: '/login' }), function(req, res) {
//   res.redirect("/secrets");
// });
app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate('local', { failureRedirect: '/login', failureFlash: 'Invalid username or password.' })(req, res, function () {
            res.redirect('/secrets');
      });
    }
  });
});

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
      res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", function(req, res) {
  const submittedSecret = req.body.secret;

  // console.log(req.user.id);

  User.findById(req.user.id, async function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        try {
          const savedFoundUser = await foundUser.save();
          if (savedFoundUser === foundUser) {
            res.redirect("/secrets");
          }
        } catch (errSave) {
          console.log(errSave);
        }
      }
    }
  });

});

/////////////

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("Server is running on port " + port);
});
