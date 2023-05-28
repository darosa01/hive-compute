const bcrypt = require('bcrypt');
// const crypto = require('crypto');
// crypto.randomUUID()
const options = require('./options');

const { Datastore } = require('@google-cloud/datastore');
const { Storage } = require('@google-cloud/storage');

class Database{

  #bucketName;
  #config;
  #datastore;
  #saltRounds;
  #storage;
  #taskDistributionMethod;

  constructor(){
    this.#bucketName = 'hive-compute.appspot.com';
    this.#config = options;
    this.#datastore = new Datastore();
    this.#saltRounds = 12;
    this.#storage = new Storage();
    this.#taskDistributionMethod = "fair";
  }

  checkUser(email, password){
    return new Promise((resolve, reject) => {
      const kind = "researcher";
      const researcherKey = this.#datastore.key([kind, email]);

      this.#datastore.get(researcherKey).then(data => {
        const userData = data[0];
        if(userData){
          const passwordHash = userData.password;
  
          bcrypt.compare(password, passwordHash).then(isCorrect => {
            if(isCorrect){
              this.#removeOldSessions(); 

              resolve({
                name: userData.name,
                surname: userData.surname ?? "",
                email: userData.email,
                entity: userData.entity,
                isAdmin: userData.isAdmin ?? false
              });
            } else {
              resolve(null);
            }
          }).catch(reject);
        } else {
          resolve(null)
        }
      }).catch(reject);
    });
  }

  createEntity(entityData){
    // TO DO !!!
  }
  
  createProject(projectData, projectImage, entity){
    return new Promise((resolve, reject) => {
      const kind = "project";
      const projectKey = this.#datastore.key([kind]);

      projectData.entity = entity;

      const extension = projectImage.name.split('.').at(-1);

      var destFileName = "image-" + crypto.randomUUID() + "." + extension;

      projectData.imageName = destFileName;
      
      this.#storage.bucket(this.#bucketName).file(destFileName).save(projectImage.buffer).then(() => {
        const fileRef = this.#storage.bucket(this.#bucketName).file(destFileName);

        fileRef.getSignedUrl({
          action: "read"
        }).then(imageUrl => {
          projectData.imageUrl = imageUrl;
  
          const project = {
            key: projectKey,
            data: projectData
          }
      
          this.#datastore.save(project).then(resolve).catch(reject);
        });
      }).catch(reject);
    });
  }

  createResearcher(researcherData){
    return new Promise((resolve, reject) => {
      const kind = "researcher";
      const researcherKey = this.#datastore.key([kind, researcherData.email]);
  
      const newPassword = this.#generatePassword();
  
      const researcher = {
        key: researcherKey,
        data: {
          name: researcherData.name,
          surname: researcherData.surname,
          password: newPassword.hash,
          email: researcherData.email,
          entity: researcherData.entity
        }
      }
  
      this.#datastore.save(researcher).then(() => {
        resolve(newPassword.password);
      }).catch(reject);
    });
  }

  createTask(entity, taskData){
    return new Promise((resolve, reject) => {

      const projectKey = this.#datastore.key(["project", taskData.project]);

      this.#datastore.get(projectKey).then(data => {
        const projectData = data[0];

        if(projectData.entity !== entity){
          return reject("Error creating task: not your project.");
        }

        const kind = "task";
        const taskKey = this.#datastore.key([kind]);
  
        const task = {
          key: taskKey,
          data: taskData
        }
  
        this.#datastore.save(task).then(resolve).catch(reject);
      }).catch(reject);
    });
  }

  createUser(userId){
    return new Promise((resolve, reject) => {
      const kind = "user";
      const userKey = this.#datastore.key([kind, userId]);
  
      const user = {
        key: userKey,
        data: {
          userId: userId,
          lastSeen: new Date()
        }
      }
  
      this.#datastore.save(user).then(resolve).catch(reject);
    });
  }

  deleteProject(){
    // TO DO !!!
  }

  deleteResearcher(email){
    return new Promise((resolve, reject) => {
      const transaction = this.#datastore.transaction();
      const userKey = this.#datastore.key(['researcher', email]);

      try {
        transaction.run().then(() => {
          transaction.delete(userKey);
          // Delete user cookie to prevent future actions
          const querySessions = transaction.createQuery('express-sessions');
          transaction.runQuery(querySessions).then(data => {
            const sessionList = data[0];
            var sessionsToRemove = [];
  
            sessionList.forEach(session => {
              var sessionData = JSON.parse(session.data);
              if(sessionData.user.email == email){
                sessionsToRemove.push(session[this.#datastore.KEY].name);
              }
            });
  
            var sessionPromises = [];
  
            sessionsToRemove.forEach(sessionId => {
              var sessionKey = this.#datastore.key(['express-session', sessionId]);
              sessionPromises.push(transaction.delete(sessionKey));
            });
  
            Promise.all(sessionPromises).then(() => {
              transaction.commit().then(resolve).catch(reject);
            });
          });
        });
      } catch (err) {
        transaction.rollback();
        reject(err);
      }
    });
  }

  deleteTask(){
    // TO DO !!!
  }

  #generatePassword(){
    const newPassword = Math.random().toString(36).slice(-8);
    const hash = bcrypt.hashSync(newPassword, this.#saltRounds);

    return {
      password: newPassword,
      hash: hash
    }
  }

  getContributions(userId){
    return new Promise((resolve, reject) => {
      var query = this.#datastore.createQuery('execution').filter('user', '=', userId);
      this.#datastore.runQuery(query).then(data => {
        var tasks = data[0].map(a => a.task);
        const uniqueTasks = [...new Set(tasks)];

        if(uniqueTasks.length < 1){
          return resolve([]);
        }

        var query = this.#datastore.createQuery('task').filter('name', 'IN', uniqueTasks);
        this.#datastore.runQuery(query).then(data => {
          var projects = data[0].map(a => a.project);
          const uniqueProjects = [...new Set(projects)];

          var query = this.#datastore.createQuery('project').filter('name', 'IN', uniqueProjects);
          this.#datastore.runQuery(query).then(data => {
            resolve(data);
          }).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  getEntityInfo(entityId){
    return new Promise((resolve, reject) => {
      const entityKey = this.#datastore.key(['entity', this.#datastore.int(entityId)]);

      this.#datastore.get(entityKey).then(data => {
        resolve(data[0]);
      }).catch(reject);
    });
  }

  getMyProjects(entity){
    return new Promise((resolve, reject) => {
      var query = this.#datastore.createQuery('project').filter('entity', '=', entity);
      this.#datastore.runQuery(query).then(data => {
        resolve(data);
      }).catch(reject);
    });
  }

  async getNewTask(userId){
    var query = this.#datastore.createQuery('task');
    var tasks = await this.#datastore.runQuery(query);

    var query = this.#datastore.createQuery('execution');
    var executions = await this.#datastore.runQuery(query);

    const executionsPerTask = Object.entries(executions.reduce((acc, { task }) => {
      acc[task] = (acc[task] || 0) + 1;
      return acc;
    }, {})).map( ([k,v]) => ({task: parseInt(k,10), count: v}));

    switch(this.#taskDistributionMethod){
      case 'fair':
        return this.#fairTaskDistribution(this.#config, executionsPerTask, tasks, userId);
      case 'none':
        return;
    }
  }

  getResearcherData(email){
    return new Promise((resolve, reject) => {
      const kind = "researcher";
      const researcherKey = this.#datastore.key([kind, email]);

      this.#datastore.get(researcherKey).then(data => {
        const userData = data[0];
        if(userData){
          resolve({
            name: userData.name,
            surname: userData.surname ?? "",
            email: userData.email,
            entity: userData.entity,
            isAdmin: userData.isAdmin ?? false
          });
        }
      }).catch(reject);
    });
  }

  getResearchers(entity, myMail){
    return new Promise((resolve, reject) => {
      const query = this.#datastore.createQuery('researcher').filter('entity', '=', entity);
      this.#datastore.runQuery(query).then(data => {
        const researchers = data[0].filter(r => r.email != myMail);

        resolve(researchers);
      }).catch(reject);
    });
  }

  getUserNumbers(entity){
    return new Promise((resolve, reject) => {
      const query = this.#datastore.createQuery('researcher').filter('entity', '=', entity);
      this.#datastore.runQuery(query).then(data => {
        const admins = data[0].filter(r => r.isAdmin);

        const numbers = {
          researchers: data[0].length,
          admins: admins.length
        }

        resolve(numbers);
      }).catch(reject);
    });
  }

  #removeOldSessions(){
    return new Promise((resolve, reject) => {
      const querySessions = this.#datastore.createQuery('express-sessions');
      this.#datastore.runQuery(querySessions).then(data => {
        const sessionList = data[0];
        var sessionsToRemove = [];
  
        var currentDate = new Date();
  
        sessionList.forEach(session => {
          var sessionData = JSON.parse(session.data);
          if(new Date(sessionData.cookie.expires) < currentDate){
            sessionsToRemove.push(session[this.#datastore.KEY].name);
          }
        });
  
        var sessionPromises = [];
  
        sessionsToRemove.forEach(sessionId => {
          var sessionKey = this.#datastore.key(['express-session', sessionId]);
          sessionPromises.push(this.#datastore.delete(sessionKey));
        });
  
        Promise.all(sessionPromises).then(resolve).catch(reject);
      }).catch(reject);
    });
  }

  researcherToggleAdmin(email){
    return new Promise((resolve, reject) => {
      const transaction = this.#datastore.transaction();
      const userKey = this.#datastore.key(['researcher', email]);

      try {
        transaction.run().then(() => {
          transaction.get(userKey).then(data => {
            var userData = data[0];

            if(userData.isAdmin){
              userData.isAdmin = false;
            } else {
              userData.isAdmin = true;
            }

            const user = {
              key: userKey,
              data: userData
            }

            transaction.save(user);
            transaction.commit().then(resolve).catch(reject);
          }).catch(reject);
        });
      } catch (err) {
        transaction.rollback();
        reject(err);
      }
    });
  }

  resetResearcherPassword(email){
    return new Promise((resolve, reject) => {
      const transaction = this.#datastore.transaction();
      const userKey = this.#datastore.key(['researcher', email]);

      try {
        transaction.run().then(() => {
          transaction.get(userKey).then(data => {
            var userData = data[0];

            const newPassword = this.#generatePassword();

            userData.password = newPassword.hash;

            const user = {
              key: userKey,
              data: userData
            }

            transaction.save(user);
            transaction.commit().then(() => {
              resolve(newPassword.password);
            }).catch(reject);
          }).catch(reject);
        });
      } catch (err) {
        transaction.rollback();
        reject(err);
      }
    });
  }

  submitExecution(executionData){
    return new Promise((resolve, reject) => {
      const kind = "execution";
      const executionKey = this.#datastore.key([kind]);

      const execution = {
        key: executionKey,
        data: executionData
      }

      this.#datastore.save(execution).then(resolve).catch(reject);
    });
  }

  updateLastSeen(userId){
    return new Promise((resolve, reject) => {
      const userKey = this.#datastore.key(['user', userId]);

      const user = {
        key: userKey,
        data: {
          userId: userId,
          lastSeen: new Date()
        }
      }

      this.#datastore.save(user).then(resolve).catch(reject);
    });
  }

  updateResearcherData(user){
    return new Promise((resolve, reject) => {
      const transaction = this.#datastore.transaction();
      const userKey = this.#datastore.key(['researcher', user.email]);

      try {
        transaction.run().then(() => {
          transaction.get(userKey).then(data => {
            var userData = data[0];

            if(user.name && user.name != ""){
              userData.name = user.name;
            }

            if(user.surname && user.surname != ""){
              userData.surname = user.surname;
            }

            if(user.password && user.password != ""){
              const hash = bcrypt.hashSync(user.password, this.#saltRounds);
              userData.password = hash;
            }

            const modifiedUser = {
              key: userKey,
              data: userData
            }

            transaction.save(modifiedUser);
            transaction.commit().then(resolve).catch(reject);
          }).catch(reject);
        });
      } catch (err) {
        transaction.rollback();
        reject(err);
      }
    });
  }

  // Task distribution methods

  #fairTaskDistribution(config, executionsPerTask, tasks){

    const nonExecutedTasks = tasks.filter(x => {
      return !executionsPerTask.some(e => e.task === x);
    });

    nonExecutedTasks.forEach(t => {
      executionsPerTask.push({
        task: t,
        count: 0
      });
    });

    // Sort tasks by executed times (less executions first)
    executionsPerTask.sort((a,b) => a.count - b.count);

    if(executionsPerTask.length < 1){
      return null;
    }

    for(let i=0; i < executionsPerTask.length; i++){
      if(executionsPerTask[i].count >= config.executionRepetition){
        return null;
      }

      // Prevents a user from running the same task multiple times
      if(!executions.find(e => e.task === executionsPerTask[i].task && e.user === userId)){
        return tasks.find(t => t[this.#datastore.KEY].name == executionsPerTask[0].task);
      }
    }
    return null;
  }
}

module.exports = Database;