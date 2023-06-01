const express = require('express');
const router = express.Router();
const Database = require('./database');

const db = new Database();

/**
 * TEST userID -> 6a58164f-cc02-4885-9292-0acaee941324
 */

function sampleContributions(){
  return [{
    title: "Cancer Risk in Childhood Cancer Survivors (CRICCS)",
    url: "https://criccs.iarc.who.int/",
    text: "Cancer Risk in Childhood Cancer Survivors (CRICCS) is a collaborative population-based project funded by Children with Cancer UK. The project was launched on 2 November 2020 and will be conducted over a 3-year period.",
    imageUrl: "assets/img/scientific-research.jpg"
  }, {
    title: "BCNET Biobank and Cohort Building Network",
    url: "https://bcnet.iarc.who.int/",
    text: "The Low- and Middle-Income Countries (LMICs) Biobank and Cohort Building Network (BCNet) initiative arose from the realization that despite improvements in developed countries, population cohorts and biobanking facilities are either underdeveloped or non-existent in LMICs. In this context and in line with IARC’s mission to contribute to worldwide cancer research, BCNet was set up as an opportunity for LMICs to work together in a coordinated and effective manner and jointly address the many challenges in biobanking infrastructure, including ethical, legal, and social issues (ELSIs).",
    imageUrl: "assets/img/scientific-research.jpg"
  }]
}

// middleware that is specific to this router
router.use(function checkUser(req, res, next) {
  var userId = req.get('User-Id');
  if(userId === undefined){
    res.status(403).end();
  } else {
    db.updateLastSeen(userId).then(() => {
      next();
    }).catch(err => {
      console.error(err);
      res.status(500).end();
    });
  }
});

router.get('/', function(req, res) {
  //res.send('API home page');

  // JUST A TEST 
  db.getNewTask().then(task => {
    res.send(task);
  });
});

router.get('/getContributions', function(req, res) {
  var userId = req.get('User-Id');
  db.getContributions(userId).then(data => {
    res.json(data);
  }).catch(err => {
    console.log(err);
    res.status(500).end();
  });
});

router.get('/getNewTask', function(req, res) {
  var userId = req.get('User-Id');
  db.getNewTask(userId).then(task => {
    res.json(task);
  }).catch(err => {
    console.log(err);
    res.status(500).end();
  });
});

router.post('/submitCompletedTask', function(req, res) {
  var userId = req.get('User-Id');
  var execution = req.body;

  db.submitExecution({
    task: execution.task,
    userId: userId,
    result: execution.result
  }).then(() => {
    res.status(200).end();
  }).catch(err => {
    console.log(err);
    res.status(500).end();
  });
});

module.exports = router;
