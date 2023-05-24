const mysql = require('mysql');
const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "research"
});

con.connect(function(err) {
  if (err) throw err;
  console.log("INFO: Connected to DB!");
});

function addEntityUser(userData){

  const saltRounds = 12;

  return new Promise((resolve, reject) => {
    bcrypt.hash(userData.password, saltRounds).then(hash => {
      var sqlSentence = "INSERT INTO entitiesUsers (name, surname, email, role, entity, password) VALUES (" + con.escape(userData.name) + ", " + con.escape(userData.surname) + ", " + con.escape(userData.email) + ", " + con.escape(userData.role) + ", " + con.escape(userData.entity) + ", " + hash + ")";
      con.query(sqlSentence, function (err, result, fields) {
        if(err){
          console.error(err);
          reject();
        } else {
          resolve();
        }
      });
    }).catch(error => {
      console.error(error.message);
      reject();
    });
  });
}

function addProject(userEmail, projectData, imagePath){
  return new Promise((resolve, reject) => {
    var sqlSentence = `
    INSERT INTO projects (title, text, url, image, projectKey, entity) 
    VALUES (` + con.escape(projectData.title) + `, 
    ` + con.escape(projectData.text) + `, 
    ` + con.escape(projectData.url) + `, 
    ` + con.escape(imagePath) + `, 
    '` + crypto.randomUUID() + `', (
      SELECT entity
      FROM entitiesusers
      WHERE email = ` + con.escape(userEmail) + `
    ));
    `;
    con.query(sqlSentence, function (err, result, fields) {
      if(err){
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function addTask(){

}

function addUser(userId){
  return new Promise((resolve, reject) => {
    var sqlSentence = "INSERT INTO users (userId) VALUES (" + con.escape(userId) + ")";
    con.query(sqlSentence, function (err, result, fields) {
      if(err){
        reject();
      } else {
        resolve();
      }
    });
  });
}

function banUser(seconds){
  
}

function checkEntityUser(email, password){
  return new Promise((resolve, reject) => {
    var sqlSentence = "SELECT name, email, role, password FROM entitiesUsers WHERE email = " + con.escape(email);
    con.query(sqlSentence, function (err, result, fields) {
      if (err) reject(err);

      if(Object.keys(result).length < 1){
        resolve(null);
      } else {
        var passwordHash = result[0].password;
        bcrypt.compare(password, passwordHash).then(isCorrect => {
          if(isCorrect){
            resolve({
              name: result[0].name,
              email: result[0].email,
              role: result[0].role
            });
          } else {
            resolve(null);
          }
        }).catch(err => console.error(err.message));
      }
    });
  });
}

function checkUser(userId){
  return new Promise((resolve, reject) => {
    var sqlSentence = "SELECT banTime FROM users WHERE userId = " + con.escape(userId);
    con.query(sqlSentence, function (err, result, fields) {
      if (err) reject(err);

      if(Object.keys(result).length < 1){
        addUser(userId).then(ok => {
          // if user just created --> allow access
          resolve(false);
        }).catch(err => {
          // if user can't be added -> forbid access
          resolve(true);
        });
      } else {
        var banTime = new Date(result[0].banTime);
        var currentDate = new Date();
        if(banTime > currentDate){
          // if banTime still active --> forbid access
          resolve(true);
        } else {
          // if banTime expired --> allow access
          resolve(false);
        }
      }
    });
  });
}

function getContributions(userId){
  return new Promise((resolve, reject) => {
    var sqlSentence = `
    SELECT title, text, url, image
    FROM projects
    WHERE id IN (
        SELECT project
        FROM tasks
        WHERE id IN (
            SELECT task 
            FROM executions
            WHERE user IN (
                SELECT id
                FROM users
                WHERE userId = ` + con.escape(userId) + `
            )
        )
    )
    `;
    con.query(sqlSentence, function (err, result, fields) {
      if (err) reject(err);

      var contributions = [];
      result.forEach(element => {
        contributions.push(element);
      });
      resolve(contributions);
    });
  });
}

function getMyProjects(email){
  return new Promise((resolve, reject) => {
    var sqlSentence = `
    SELECT title, text, url, image, projectKey
    FROM projects
    WHERE entity IN (
      SELECT entity
      FROM entitiesusers
      WHERE email = ` + con.escape(email) + `
    )
    `;
    con.query(sqlSentence, function (err, result, fields) {
      if (err) reject(err);
      resolve(result);
    });
  });
}

function getProjectTasks(email, projectKey){
  console.log(projectKey);
  return new Promise((resolve, reject) => {
    var isAllowed = false;

    var sqlSentence = `
    SELECT title
    FROM projects
    WHERE entity IN (
      SELECT entity
      FROM entitiesusers
      WHERE email = ` + con.escape(email) + `
    ) AND projectKey = ` + con.escape(projectKey) + `
    `;
    con.query(sqlSentence, function (err, result, fields) {
      if (err) reject(err);
      console.log(result);
    });
  });
}

/**
 *  SQL Sentence -> Limit task executions
 * 
 * SELECT t.name, t.code
 * FROM tasks as t
 * LEFT JOIN executions as e ON t.id=e.task
 * GROUP BY t.id
 * HAVING COUNT(t.id) < (SELECT configValue FROM config WHERE configKey = 'executionRepetitions')
 * ORDER BY COUNT(t.id)
 * LIMIT 1;
 */

/**
 *  SQL Sentence -> Limit task executions and not allow user task repetition
 * 
 * SELECT t.name as name, t.code as code
 * FROM tasks as t
 * LEFT JOIN executions as e ON t.id=e.task
 * WHERE t.id NOT IN (SELECT distinct t.id
 * FROM tasks as t 
 * LEFT JOIN executions as e ON t.id=e.task 
 * WHERE e.user = (SELECT id FROM users WHERE userId = 'cb99b830-b2b9-4c76-a51a-26afba3a61ef'))
 * GROUP BY t.id
 * HAVING COUNT(t.id) < (SELECT configValue FROM config WHERE configKey = 'executionRepetitions')
 * ORDER BY COUNT(t.id)
 * LIMIT 1;
 */

function getNewTask(userId){
  return new Promise((resolve, reject) => {
    // Es selecciona la tasca amb menys execucions i que no hagi superat el numero d'execucions requerit.
    // Un mateix usuari no pot fer la mateixa tasca dues vegades.
    var sqlSentence = 
    `
    SELECT t.code as code, t.taskKey as taskKey
    FROM tasks as t
    LEFT JOIN executions as e ON t.id=e.task
    WHERE t.id NOT IN (SELECT distinct t.id
	  FROM tasks as t 
	  LEFT JOIN executions as e ON t.id=e.task 
	  WHERE e.user = (SELECT id FROM users WHERE userId = ` + con.escape(userId) + `))
    GROUP BY t.id
    HAVING COUNT(t.id) < (SELECT configValue FROM config WHERE configKey = 'executionRepetitions')
    ORDER BY COUNT(t.id)
    LIMIT 1;
    `;
    con.query(sqlSentence, function (err, result, fields) {
      if (err) reject(err);

      if(Object.keys(result).length < 1){
        resolve(null);
      } else {

        var task = {
          codeUrl: result[0].code + "postMessage(compute());",
          taskKey: result[0].taskKey
        }

        resolve(task);
      }
    });
  });
}

function getTaskWasm(taskId){
  // Idealment els fitxers s'emmagatzemen, per exemple, a Google Cloud Storage

  const filePath = path.join(path.dirname(__filename), 'wasm-tasks', (taskId + '.wasm'));
  return fs.readFile(filePath);
}

function submitExecution(execution){
  return new Promise((resolve, reject) => {
    var sqlSentence = "INSERT INTO executions (user, task, result) VALUES ((SELECT id FROM users WHERE userId = " + con.escape(execution.userId) + "), (SELECT id FROM tasks WHERE name = " + con.escape(execution.taskId) + "), " + con.escape(execution.result) + ")";
    
    con.query(sqlSentence, function (err, result, fields) {
      if (err){
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

module.exports = { addEntityUser, addProject, addTask, checkEntityUser, checkUser, getContributions, getMyProjects, getProjectTasks, getNewTask, submitExecution }