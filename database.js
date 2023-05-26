const bcrypt = require('bcrypt');
// const crypto = require('crypto');
// crypto.randomUUID()

const { Datastore } = require('@google-cloud/datastore');
const { Storage } = require('@google-cloud/storage');

class Database{

  #bucketName;
  #datastore;
  #storage;
  #taskDistributionMethod;

  constructor(){
    this.#bucketName = 'hive-compute.appspot.com';
    this.#datastore = new Datastore();
    this.#storage = new Storage();
    this.#taskDistributionMethod = "fair";
  }

  checkAdmin(email, password){
    return new Promise((resolve, reject) => {
      const kind = "admin";
      const adminKey = this.#datastore.key([kind, email]);

      this.#datastore.get(adminKey).then(data => {
        const userData = data[0];
        if(userData){
          const passwordHash = userData.password;
  
          bcrypt.compare(password, passwordHash).then(isCorrect => {
            if(isCorrect){
              this.#removeOldSessions(); 

              resolve({
                name: userData.name,
                surname: userData.surname ?? "",
                email: userData.email
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

  checkInvestigator(email, password){
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
                entity: userData.entity
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

  createAdmin(adminData){
    return new Promise((resolve, reject) => {
      const kind = "admin";
      const adminKey = this.#datastore.key([kind, adminData.email]);
  
      const newPassword = this.#generatePassword();
  
      const admin = {
        key: adminKey,
        data: {
          name: adminData.name,
          surname: adminData.surname,
          password: newPassword.hash,
          email: adminData.email
        }
      }
  
      this.#datastore.save(admin).then(() => {
        resolve(newPassword.password);
      }).catch(reject);
    });
  }
  
  createProject(projectData){
    return new Promise((resolve, reject) => {
      const kind = "project";
      const projectKey = this.#datastore.key([kind]);

      const project = {
        key: projectKey,
        data: projectData
      }

      this.#datastore.save(project).then(resolve).catch(reject);
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

  deleteResearcher(email){
    return new Promise((resolve, reject) => {
      const transaction = this.#datastore.transaction();
      const userKey = this.#datastore.key(['researcher', email]);

      try {
        transaction.run().then(() => {
          transaction.delete(userKey).then(() => {
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
        });
      } catch (err) {
        transaction.rollback();
        reject(err);
      }
    });
  }

  #generatePassword(){
    const saltRounds = 12;

    const newPassword = Math.random().toString(36).slice(-8);
    const hash = bcrypt.hashSync(newPassword, saltRounds);

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

  getMyProjects(entity){
    return new Promise((resolve, reject) => {
      var query = this.#datastore.createQuery('project').filter('entity', '=', entity);
      this.#datastore.runQuery(query).then(data => {
        resolve(data);
      }).catch(reject);
    });
  }

  async getNewTask(){
    var query = this.#datastore.createQuery('config');
    var config = await this.#datastore.runQuery(query);

    query = this.#datastore.createQuery('task');
    var tasks = await this.#datastore.runQuery(query);

    query = this.#datastore.createQuery('execution');
    var executions = await this.#datastore.runQuery(query);

    const executionsPerTask = Object.entries(executions.reduce((acc, { task }) => {
      acc[task] = (acc[task] || 0) + 1;
      return acc;
    }, {})).map( ([k,v]) => ({task: parseInt(k,10), count: v}));

    switch(this.#taskDistributionMethod){
      case 'fair':
        return this.#fairTaskDistribution(config, executionsPerTask, tasks);
      case 'none':
        return;
    }
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

    if(executionsPerTask.length < 1 || executionsPerTask[0].count >= config.executionRepetition){
      return null;
    }

    return tasks.find(t => t[this.#datastore.KEY].name == executionsPerTask[0].task);
  }
}

export { Database }