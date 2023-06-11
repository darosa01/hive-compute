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
    return next();
  } else if (req.url == '/'){
    return res.redirect('/entities/login');
  } else{
    return res.status(403).end();
  }
});

router.get("/", function(req, res){
  return res.sendFile(__dirname + "/entities_pages/index.html");
});

router.post("/addData", upload.single('datafile'), function(req, res){
  if(!req.file || !req.body.title){
    return res.status(400).end();
  }

  db.addData(req.body.title, req.file, req.session.user.entity).then(() => {
    return res.status(200).end();
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  });
});

router.post("/addProject", upload.single('image'), function(req, res){
  if(req.file == null || isNullishOrEmpty(req.body.title) || isNullishOrEmpty(req.body.text) || isNullishOrEmpty(req.body.url)){
    return res.status(400).end();
  }

  const entity = req.session.user.entity;
  const projectData = req.body;
  const imageBuffer = req.file.buffer;
  const imageName = req.file.originalname;
  const image = {
    name: imageName,
    buffer: imageBuffer
  }

  db.createProject(projectData, image, entity).then(() => {
    return res.status(200).end();
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  });
});

router.post("/addTask", upload.any(), function(req, res){
  if(req.files == null || isNullishOrEmpty(req.body.title) || isNullishOrEmpty(req.body.project) || req.body.dataDependencies == null){
    return res.status(400).end();
  }

  const taskData = {
    title: req.body.title,
    project: req.body.project,
    dataDependencies: req.body.dataDependencies
  }

  const wasmBuffer = req.file[0].buffer;
  const jsBuffer = req.file[1].buffer;
  const entity = req.session.user.entity;

  db.createTask(entity, taskData, wasmBuffer, jsBuffer).then(() => {
    return res.status(200).end();
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  });
});

router.post("/deleteData", function(req, res){
  const entity = req.session.user.entity;
  const dataId = req.body.dataId;

  db.deleteData(dataId, entity).then(() => {
    return res.status(200).end();
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  });
});

router.post("/deleteProject", function(req, res){
  const entity = req.session.user.entity;
  const projectId = req.body.projectId;

  db.deleteProject(projectId, entity).then(() => {
    return res.status(200).end();
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  });
});

router.post("/deleteTask", function(req, res){
  const entity = req.session.user.entity;
  const taskId = req.body.taskId;

  db.deleteTask(taskId, entity).then(() => {
    return res.status(200).end();
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  });
});

router.get("/getEntityInfo", function(req, res){
  db.getEntityInfo(req.session.user.entity).then(data => {
    return res.json(data);
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  });
});

router.get("/getMyData", function(req, res){
  res.json(req.session.user);
});

router.get("/getMyDataFiles", function(req, res){
  var entity = req.session.user.entity;
  db.getMyDataFiles(entity).then(data => {
    return res.json(data);
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  });
});

router.get("/getMyProjects", function(req, res){
  var entity = req.session.user.entity;
  db.getMyProjects(entity).then(data => {
    return res.json(data);
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  });
});

router.post("/getProjectTasks", function(req, res){
  var userEntity = req.session.user.entity;
  var projectId = req.body.projectId;
  db.getProjectTasks(userEntity, projectId).then(data => {
    return res.json(data);
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  });
});

router.get("/getResearcherNumbers", function(req, res){
  db.getResearcherNumbers(req.session.user.entity).then(data => {
    return res.json(data);
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  })
});

router.get("/login", function(req, res){
  if(req.session.user !== undefined){
    return res.redirect("/entities");
  } else {
    return res.sendFile(__dirname + "/entities_pages/login.html");
  }
});

router.post("/login", function(req, res){
  if(req.session.user !== undefined){
    return res.redirect("/entities");
  } else {
    var email = req.body.email;
    var password = req.body.password;
    db.checkUser (email, password).then(userData => {
      if(userData !== null){
        req.session.user = userData;
        return res.redirect("/entities");
      } else {
        return res.sendFile(__dirname + "/entities_pages/login-error.html");
      }
    });
  }
});

router.get("/logout", function(req, res){
  req.session.destroy();
  return res.redirect("/entities/login");
});

router.post("/logout", function(req, res){
  req.session.destroy();
  return res.redirect("/entities/login");
});

router.post("/toggleTask", function(req, res){
  const entity = req.session.user.entity;
  const taskId = req.body.taskId;
  
  db.toggleTask(entity, taskId).then(() => {
    return res.status(200).end();
  }).catch(err => {
    console.log(err);
    res.status(500).end();
  })
});

router.post("/updateProject", upload.single('image'), function(req, res){
  const entity = req.session.user.entity;
  const updatedProject = {
    id: req.body.id,
    title: req.body.title,
    text: req.body.text,
    url: req.body.url
  }

  db.updateProject(updatedProject, req.file, entity).then(() => {
    return res.status(200).end();
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  })
});

router.post("/updateTask", function(req, res){
  const entity = req.session.user.entity;
  const updatedTask = {
    id: req.body.id,
    title: req.body.title,
    dataDependencies: req.body.dataDependencies,
    project: req.body.project
  }

  db.updateTask(updatedTask, entity).then(() => {
    return res.status(200).end();
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  })
});

router.post("/updateResearcherData", function(req, res){
  var userData = req.body;

  // To prevent manually modificated mail
  userData.email = req.session.user.email;

  db.updateResearcherData(userData).then(() => {
    db.getResearcherData(req.session.user.email).then(data => {
      req.session.user = data;
      return res.status(200).end();
    }).catch(err => {
      console.log(err);
      return res.status(500).end();
    });
  }).catch(err => {
    console.log(err);
    return res.status(500).end();
  })
});

const isNullishOrEmpty = function(element){
  if(element == null || element == ""){
    return true;
  } else {
    return false;
  }
}

module.exports = router;
