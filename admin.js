const express = require('express');
const router = express.Router();

const Database = require('./database');
const Email = require('./email')

const db = new Database();
const email = new Email();

router.use(function checkSession(req, res, next){
  if((req.session.user !== undefined && req.session.user.isAdmin) || req.url == "/login" || req.url == "/login-error"){
    next();
  } else if (req.session.user !== undefined && req.url == '/'){
    res.redirect('/entities/login');
  } else if (req.url == '/'){
    res.redirect('/admin/login');
  } else{
    res.status(403).end();
  }
});

router.get("/", function(req, res){
  res.sendFile(__dirname + "/admin_pages/index.html");
});

router.post("/createResearcher", function(req, res){
  var userData = req.body;

  if(userData){
    userData.entity = req.session.user.entity;
    db.createResearcher(userData).then(password => {
      email.sendWelcomeMail(userData.email, password);
      res.status(200).end();
    }).catch(err => {
      console.log(err);
      res.status(500).end();
    })
  }
});

router.post("/deleteResearcher", function(req, res){
  var userEmail = req.body.email;

  db.deleteResearcher(userEmail).then(() => {
    res.status(200).end();
  }).catch(err => {
    console.log(err);
    res.status(500).end();
  })
});

router.get("/getEntityInfo", function(req, res){
  db.getEntityInfo(req.session.user.entity).then(data => {
    res.json(data);
  }).catch(err => {
    console.log(err);
    res.status(500).end();
  })
});

router.get("/getNumbers", function(req, res){
  db.getUserNumbers(req.session.user.entity).then(data => {
    res.json(data);
  }).catch(err => {
    console.log(err);
    res.status(500).end();
  })
});

router.get("/getResearchers", function(req, res){
  db.getResearchers(req.session.user.entity, req.session.user.email).then(data => {
    res.json(data);
  }).catch(err => {
    console.log(err);
    res.status(500).end();
  })
});

router.get("/login", function(req, res){
  if(req.session.user !== undefined && req.session.user.isAdmin){
    res.redirect("/admin");
  } else if (req.session.user !== undefined){
    res.redirect("/entities");
  } else {
    res.sendFile(__dirname + "/admin_pages/login.html");
  }
});

router.post("/login", function(req, res){
  if(req.session.user !== undefined && req.session.user.isAdmin){
    res.redirect("/admin");
  } else if(req.session.user !== undefined) {
    res.redirect("/entities");
  } else {
    var email = req.body.email;
    var password = req.body.password;
    db.checkUser (email, password).then(userData => {
      if(userData !== null){
        req.session.user = userData;
        if(userData.isAdmin){
          res.redirect("/admin");
        } else {
          res.redirect("/entities");
        }
        
      } else {
        res.sendFile(__dirname + "/admin_pages/login-error.html");
      }
    });
  }
});

router.get("/logout", function(req, res){
  req.session.destroy();
  res.redirect("/admin/login");
});

router.post("/logout", function(req, res){
  req.session.destroy();
  res.redirect("/admin/login");
});

router.post("/resetResearcherPassword", function(req, res){
  var userEmail = req.body.email;

  db.resetResearcherPassword(userEmail).then(password => {
    email.sendResetMail(userEmail, password);
    res.status(200).end();
  }).catch(err => {
    console.log(err);
    res.status(500).end();
  })
});

router.post("/toggleAdmin", function(req, res){
  var userEmail = req.body.email;

  db.researcherToggleAdmin(userEmail).then(() => {
    res.status(200).end();
  }).catch(err => {
    console.log(err);
    res.status(500).end();
  })
});

module.exports = router;