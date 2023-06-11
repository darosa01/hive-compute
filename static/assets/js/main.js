import { Compute } from "./compute.js";

var isSystemReady = false;

if (typeof(Worker) === "undefined") {
  console.error("Worker not working :(");
  document.location.href = '/not-working.html';
}

var userId;
if (typeof(Storage) !== "undefined") {
  userId = localStorage.getItem("userId")
  if(!userId){
    userId = window.crypto.randomUUID();
    localStorage.setItem("userId", userId);
  }
} else {
  console.warn("LocalStorage not available - Some functions will be disabled.");
  userId = window.crypto.randomUUID();
}

getContributions(userId);

var compute = new Compute();
compute.init(userId).then(() => {
  systemReady();
}).catch(err => {
  console.error(err);
  document.location.href = '/not-working.html';
});

/**
 * EVENT LISTENERS
 */

var statusIcon = document.getElementById('status-icon');
var statusText = document.getElementById('status-text');

var startButton = document.getElementById("start-button");
var alternativeStartButton = document.getElementById("alternative-start-button");
var stopButton = document.getElementById("stop-button");
var activityButton = document.getElementById("activity-button");
var activityCloseButton = document.getElementById("activity-close");

var activityBlock = document.getElementById("activity-background");

var introText = document.getElementById("intro-text");
var introImage = document.getElementById("intro-image");
var statusBar = document.getElementById("status-bar");
var navigationBar = document.getElementById("navigation");

var title = document.getElementById("title");
var titleCollaborating = document.getElementById("title-collaborating");

alternativeStartButton.onclick = function (e) {
  e.preventDefault();
  startComputing();
}

startButton.onclick = function (e) {
  e.preventDefault();
  startComputing();
}

stopButton.onclick = function (e) {
  e.preventDefault();
  stopComputing();
}

activityButton.onclick = function (e) {
  loadLogs();
  activityBlock.style.display = "flex";
}
activityCloseButton.onclick = function (e) {
  activityBlock.style.display = "none";
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();

    document.querySelector(this.getAttribute('href')).scrollIntoView({
      behavior: 'smooth'
    });
  });
});

window.addEventListener('load', resizeElements);
window.addEventListener('resize', resizeElements);

// Event listener to prevent accidental close of the page
window.addEventListener('beforeunload', function (e) {
  e.preventDefault();
  if(compute.isComputing()){
    e.returnValue = 'You are currently running tasks. If you close the page now they will stop and you will stop collaborating.';
  }
});


/**
 * FUNCTIONS
 */

function clearLogs(){
  var acc = document.getElementsByClassName("logs-accordion");
  var i;

  for (i = 0; i < acc.length; i++) {
    acc[i].removeEventListener("click", toggleAccordion);
  }

  var logsBlock = document.getElementById("logs");
  logsBlock.innerHTML = "";
}

function getContributions(userId){
  if(!userId){
    return;
  }

  fetch('api/getContributions', {
    method: "GET",
    headers: {
      "User-Id": userId
    }
  }).then(res => res.json()).then(data => {
    var investigationsSection = document.getElementById("investigations");
    var contributionsSection = document.getElementById("yes-contributions");
    var noContributionsSection = document.getElementById("no-contributions");
    investigationsSection.innerHTML = "";
    data.forEach(elem => {
      var newInvestigation = document.createElement("a");
      newInvestigation.className = "investigation-element";
      newInvestigation.href = elem.url;
      newInvestigation.target = "_blank";
      var newImage = document.createElement("img");
      newImage.src = elem.image;
      newImage.alt = "";
      var newTitle = document.createElement("div");
      newTitle.innerHTML = elem.title;
      var newText = document.createElement("p");
      newText.textContent = elem.text;

      newInvestigation.appendChild(newImage);
      newInvestigation.appendChild(newTitle);
      newInvestigation.appendChild(newText);
      investigationsSection.appendChild(newInvestigation);
    });
    if(data.length < 1){
      contributionsSection.style.display = "none";
      noContributionsSection.style.display = "block";
    } else {
      contributionsSection.style.display = "block";
      noContributionsSection.style.display = "none";
    }
  }).catch(console.error);
}

function loadLogs(){
  var logsBlock = document.getElementById("logs");

  if(console.history){
    clearLogs();
    console.history.forEach(log => {
      var accordion = document.createElement("button");
      var panel = document.createElement("div");
      accordion.className = "logs-accordion";
      switch(log.type){
        case "info":
          accordion.innerHTML = '<img src="assets/img/info.svg">';
          break;
        case "warn":
          accordion.innerHTML = '<img src="assets/img/warning.svg">';
          break;
        case "error":
          accordion.innerHTML = '<img src="assets/img/error-red.svg">';
          break;
      }
      if(log.arguments['0']){
        accordion.innerHTML += log.timestamp + " - <em>" + log.arguments['0'] + "</em>";
      } else {
        accordion.innerHTML += log.timestamp;
      }
      panel.className = "logs-panel";
      var content = document.createElement("pre");
      content.innerHTML = JSON.stringify(log, undefined, 2);
      panel.appendChild(content);
      logsBlock.appendChild(accordion);
      logsBlock.appendChild(panel);
    });

    var acc = document.getElementsByClassName("logs-accordion");
    var i;

    for (i = 0; i < acc.length; i++) {
      acc[i].addEventListener("click", toggleAccordion);
    }
  }

  if(logsBlock.innerHTML === ""){
    logsBlock.innerHTML = '<div class="no-logs">There are no logs to show...</div>';
  }
}

function resizeElements(event){
  function vh(percent) {
    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    return (percent * h) / 100;
  }

  if(Math.max(document.documentElement.clientWidth, window.innerWidth || 0) > 950){
    var newHeight = Math.max((vh(100) - navigationBar.offsetHeight - statusBar.offsetHeight - (16 * 5.4)), 0) + 'px';
    introImage.style.height = newHeight;
  
    var newHeight = Math.max((vh(100) - navigationBar.offsetHeight - (16 * 8.5)), 0) + 'px';
    introText.style.height = newHeight;
  } else {
    introImage.style.height = "";
    introText.style.height = "";
  }
}

function startComputing(){
  if(isSystemReady){
    console.info("COMPUTING STARTED!");
    startButton.disabled = true;
    stopButton.disabled = false;
    title.style.display = "none";
    titleCollaborating.style.display = "block";
    document.getElementById("intro-text").classList.toggle("rainbow-background");
    document.getElementById("use-indicator").style.backgroundColor = "greenyellow";
    compute.startComputing();
    statusText.innerHTML = "Computing!";
    statusIcon.src = "assets/img/cpu.svg";
  }
}

function stopComputing(){
  stopButton.disabled = true;
  startButton.disabled = false;
  title.style.display = "block";
  titleCollaborating.style.display = "none";
  document.getElementById("intro-text").classList.toggle("rainbow-background");
  document.getElementById("use-indicator").style.backgroundColor = "red";
  compute.stopComputing();
  statusText.innerHTML = "Stopped";
  statusIcon.src = "assets/img/stop.svg";
  console.info("COMPUTING STOPPED!");
}

function systemReady(){
  isSystemReady = true;
  startButton.disabled = false;
  statusIcon.src = 'assets/img/check.svg';
  statusText.innerHTML = 'Ready';
  document.getElementById("network-indicator").style.backgroundColor = "greenyellow";
  console.info("System is ready to work.");
}

function toggleAccordion(){
  this.classList.toggle("active");
  var panel = this.nextElementSibling;
  if (panel.style.maxHeight) {
    panel.style.maxHeight = null;
  } else {
    var newHeight = parseInt(panel.scrollHeight) + 15;
    panel.style.maxHeight = newHeight + "px";
    panel.style.overflowX = "auto";
  }
}