var crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const db = require('./database.js');

const storage = multer.diskStorage(
  {
    destination: './src/uploads/',
    filename: function ( req, file, callback ) {
      let ext = path.extname(file.originalname);
      callback(null, crypto.randomUUID() + ext);
    }
  }
);

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, callback) {
    var ext = path.extname(file.originalname);
    if(ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
      return callback(new Error('Only JPG and PNG images are allowed'));
    }
    callback(null, true);
  },
  limits:{
    fileSize: 1024 * 1024 * 5
  }
});

router.use(function checkSession(req, res, next){
  if(req.session.user !== undefined || req.url == "/login" || req.url == "/login-error"){
    next();
  } else{
    res.redirect("/entities/login");
  }
});

router.get("/", function(req, res){
  res.sendFile(__dirname + "/admin_pages/index.html");
});

router.post("/addProject", upload.single('image'), function(req, res){
  if(!req.file || !req.body.title || !req.body.text || !req.body.url){
    res.status(400).end();
  }
  const userEmail = req.session.user.email;
  const projectData = req.body;
  const imagePath = "/uploads/" + req.file.filename;
  db.addProject(userEmail, projectData, imagePath).then(ok => {
    res.status(200).end();
  }).catch(err => {
    console.log(err);
    fs.unlink(req.file.path, () => {});
    res.status(500).end();
  });
});

router.get("/getMyData", function(req, res){
  res.json(req.session.user);
});

router.get("/getMyProjects", function(req, res){
  var userEmail = req.session.user.email;
  db.getMyProjects(userEmail).then(data => {
    res.json(data);
  }).catch(err => console.log(err));
});

router.post("/getProjectTasks", function(req, res){
  var userEmail = req.session.user.email;
  var projectKey = req.body.projectKey;
  console.log(req); 
  db.getProjectTasks(userEmail, projectKey).then(data => {
    res.json(data);
  }).catch(err => console.log(err));
});

router.get("/login", function(req, res){
  if(req.session.user !== undefined){
    res.redirect("/entities");
  } else {
    res.sendFile(__dirname + "/admin_pages/login.html");
  }
});
router.get("/login-error", function(req, res){
  res.sendFile(__dirname + "/admin_pages/login-error.html");
});

router.post("/login", function(req, res){
  if(req.session.user !== undefined){
    res.redirect("/entities");
  } else {
    var email = req.body.email;
    var password = req.body.password;
    db.checkEntityUser(email, password).then(userData => {
      if(userData !== null){
        req.session.user = userData;
        res.redirect("/entities");
      } else {
        res.redirect("/entities/login-error");
      }
    });
  }
});

router.get("/logout", function(req, res){
  req.session.destroy();
  res.redirect("/entities/login");
});

router.post("/logout", function(req, res){
  req.session.destroy();
  res.redirect("/entities/login");
});

module.exports = router;