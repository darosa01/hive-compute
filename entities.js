const express = require('express');
const multer = require('multer');
const router = express.Router();

const Database = require('./database');

const db = new Database();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:{
    fileSize: 1024 * 1024 * 100 // 100MB
  }
});

router.use(function checkSession(req, res, next){
  if(req.session.user !== undefined || req.url == "/login" || req.url == "/login-error"){
    next();
  } else if (req.url == '/'){
    res.redirect('/entities/login');
  } else{
    res.status(403).end();
  }
});

router.get("/", function(req, res){
  res.sendFile(__dirname + "/entities_pages/index.html");
});

router.post("/addProject", upload.single('image'), function(req, res){
  if(!req.file || !req.body.title || !req.body.text || !req.body.url){
    res.status(400).end();
  }
  const entity = req.session.user.entity;
  const projectData = req.body;
  const imageBuffer = req.file.buffer;
  const imageName = req.file.originalname;
  const image = {
    name: imageName,
    buffer: imageBuffer
  }
  db.addProject(projectData, image, entity).then(() => {
    res.status(200).end();
  }).catch(err => {
    console.log(err);
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
    res.sendFile(__dirname + "/entities_pages/login.html");
  }
});

router.post("/login", function(req, res){
  if(req.session.user !== undefined){
    res.redirect("/entities");
  } else {
    var email = req.body.email;
    var password = req.body.password;
    db.checkUser (email, password).then(userData => {
      if(userData !== null){
        req.session.user = userData;
        res.redirect("/entities");
      } else {
        res.sendFile(__dirname + "/entities_pages/login-error.html");
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