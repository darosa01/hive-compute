import { Compute } from "./compute.js";

if (typeof(Worker) === "undefined") {
  console.error("Worker not working :(");
  document.location.href = '/not-working.html';
}

var userId;
if (typeof(Storage) !== "undefined") {
  userId = localStorage.getItem("userId")
  if(!userId){
    userId = crypto.randomUUID();
    localStorage.setItem("userId", userId);
  }
} else {
  console.warn("LocalStorage not available - Some functions will be disabled.");
  userId = crypto.randomUUID();
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
var stopButton = document.getElementById("stop-button");
var activityButton = document.getElementById("activity-button");
var activityCloseButton = document.getElementById("activity-close");

var activityBlock = document.getElementById("activity-background");

var startText = "You're now collaborating with science!";
var stopText = "Press <em>start</em> to begin collaborating!";

startButton.onclick = function (e) {
  e.preventDefault();
  startButton.disabled = true;
  stopButton.disabled = false;
  document.getElementById("title").innerHTML = startText;
  document.getElementById("use-indicator").style.backgroundColor = "greenyellow";
  compute.startComputing();
  statusText.innerHTML = "Computing!";
  statusIcon.src = "assets/img/cpu.svg";
}

stopButton.onclick = function (e) {
  e.preventDefault();
  stopButton.disabled = true;
  startButton.disabled = false;
  document.getElementById("title").innerHTML = stopText;
  document.getElementById("use-indicator").style.backgroundColor = "red";
  compute.stopComputing();
  statusText.innerHTML = "Stopped";
  statusIcon.src = "assets/img/stop.svg";
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

// Event listener to prevent accidental close of the page
/*
window.addEventListener('beforeunload', function (e) {
  e.preventDefault();
  e.returnValue = '';
});
*/

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

function systemReady(){
  startButton.disabled = false;
  statusIcon.src = 'assets/img/check.svg';
  statusText.innerHTML = 'Ready';
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