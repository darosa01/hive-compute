const bcrypt = require('bcrypt');
const crypto = require('crypto');

const options = require('./options');

const { Datastore } = require('@google-cloud/datastore');
const { Storage } = require('@google-cloud/storage');


class Database{

  #baseStorageUrl;
  #bucketName;
  #createTorrent;
  #datastore;
  #options;
  #saltRounds;
  #storage;
  #taskDistributionMethod;

  constructor(){
    this.#baseStorageUrl = 'https://storage.googleapis.com/';
    this.#bucketName = 'hive-compute.appspot.com';
    this.#options = options;
    this.#datastore = new Datastore();
    this.#saltRounds = options.saltRounds;
    this.#storage = new Storage();
    this.#taskDistributionMethod = options.taskDistributionMethod;

    import('create-torrent').then(({ default: createTorrent }) => {
      this.#createTorrent = createTorrent;
    });
  }

  /**
   * Adds a new data dependency to the database
   * @param {String} name Title used to identify the data dependency
   * @param {Multer.file} file File containing the data
   * @param {String} entity Entity id
   * @returns {Promise} Promise object that resolves when data has been added
   */
  addData(name, file, entity){
    return new Promise((resolve, reject) => {

      const newFile = file.buffer;

      const extension = file.originalname.split('.').at(-1);

      const destFileName = "data-" + crypto.randomUUID() + "." + extension;
      
      this.#storage.bucket(this.#bucketName).file(destFileName).save(newFile).then(() => {
        const fileRef = this.#storage.bucket(this.#bucketName).file(destFileName);

        fileRef.makePublic().then(() => {
          const dataUrl = this.#baseStorageUrl.concat(this.#bucketName, '/', destFileName);

          this.#createTorrent(newFile, {
            name: destFileName,
            urlList: dataUrl
          }, (err, torrent) => {
            if(err){
              return reject(err);
            }

            const torrentFileName = "torrent-" + crypto.randomUUID() + ".torrent";

            this.#storage.bucket(this.#bucketName).file(torrentFileName).save(torrent).then(() => {
              const torrentRef = this.#storage.bucket(this.#bucketName).file(torrentFileName);

              torrentRef.makePublic().then(() => {
                const torrentUrl = this.#baseStorageUrl.concat(this.#bucketName, '/', torrentFileName);

                const dataKey = this.#datastore.key(['datafile']);

                const data = {
                  key: dataKey,
                  data: {
                    title: name,
                    fileUrl: dataUrl,
                    fileName: destFileName,
                    torrentUrl: torrentUrl,
                    torrentName: torrentFileName,
                    entity: entity
                  }
                }
            
                this.#datastore.save(data).then(resolve).catch(reject);
              }).catch(reject);
            }).catch(reject);
          });
        }).catch(reject);
      }).catch(reject);
    });
  }

  /**
   * Checks if a task has the minimum required number of equal results to be marked as resolved.
   * If the condition is satisfied, it activates the "isResolved" flag in the database entry.
   * @param {String} taskId Task id
   * @returns {Promise} Promise object that resolves when the operation is completed
   */
  #checkIfTaskIsDone(taskId){
    return new Promise((resolve, reject) => {

      var query = this.#datastore.createQuery('execution').filter('task', '=', taskId);
        this.#datastore.runQuery(query).then(data => {
          const executions = data[0];

          const resultCount = {};
          
          executions.forEach(e => {
            resultCount[e.result] = (resultCount[e.result] || 0) + 1;
          });

          var results = Object.keys(resultCount);
          var isTaskCompleted = false;

          for(let i = 0; i < results.length; i++){
            if(resultCount[results[i]] >= this.#options.minimumEqualAnswersToValidate){
              isTaskCompleted = true;
              this.#markTaskAsCompleted(taskId, results[i].split(',')).then(resolve).catch(reject);
              break;
            }
          }

          if(!isTaskCompleted){
            return resolve();
          }
        }).catch(reject);
    });
  }

  /**
   * Checks if the email and password corresponds to an existent user
   * @param {*} email User email
   * @param {*} password User password
   * @returns {Promise<object|null>} Promise object that resolves to an object containing the user data 
   * if it exists or to null if it does not.
   */
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
    // This function will not be implemented in this stage.
  }
  
  /**
   * Creates a new project
   * @param {Object} projectData Object containing the project data
   * @param {Multer.file} projectImage Representative image of the project
   * @param {String} entity Entity id
   * @returns {Promise} Promise object that resolves when the project has been created
   */
  createProject(projectData, projectImage, entity){
    return new Promise((resolve, reject) => {
      const kind = "project";
      const projectKey = this.#datastore.key([kind]);

      projectData.entity = entity;

      const extension = projectImage.originalname.split('.').at(-1);

      var destFileName = "image-" + crypto.randomUUID() + "." + extension;

      projectData.imageName = destFileName;
      
      this.#storage.bucket(this.#bucketName).file(destFileName).save(projectImage.buffer).then(() => {
        const fileRef = this.#storage.bucket(this.#bucketName).file(destFileName);

        fileRef.makePublic().then(() => {
          const imageUrl = this.#baseStorageUrl.concat(this.#bucketName, '/', destFileName);

          projectData.imageUrl = imageUrl;
  
          const project = {
            key: projectKey,
            data: projectData
          }
      
          this.#datastore.save(project).then(resolve).catch(reject);
        }).catch(reject);
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

  createTask(entity, taskData, wasmBuffer){
    return new Promise((resolve, reject) => {

      const projectKey = this.#datastore.key(["project", this.#datastore.int(taskData.project)]);

      this.#datastore.get(projectKey).then(data => {
        const projectData = data[0];

        if(projectData.entity !== entity){
          return reject("Error creating task: not your project.");
        }

        const destFileName = "wasm-" + crypto.randomUUID() + ".wasm";

        this.#storage.bucket(this.#bucketName).file(destFileName).save(wasmBuffer).then(() => {
          const fileRef = this.#storage.bucket(this.#bucketName).file(destFileName);

          fileRef.makePublic().then(() => {
            const wasmUrl = this.#baseStorageUrl.concat(this.#bucketName, '/', destFileName);
  
            const taskKey = this.#datastore.key(['task']);

            taskData.wasmUrl = wasmUrl;
            taskData.wasmName = destFileName;
            taskData.isActive = false;

            const task = {
              key: taskKey,
              data: taskData
            }
        
            this.#datastore.save(task).then(resolve).catch(reject);
          }).catch(reject);
        }).catch(reject);
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

  deleteData(dataId, entity){
    return new Promise((resolve, reject) => {
      const dataKey = this.#datastore.key(["datafile", this.#datastore.int(dataId)]);

      this.#datastore.get(dataKey).then(data => {
        const dataData = data[0];

        if(dataData.entity != entity){
          return reject('Error deleting: Not your data files.');
        }

        this.#storage.bucket(this.#bucketName).file(dataData.torrentName).delete().then(() => {
          this.#storage.bucket(this.#bucketName).file(dataData.fileName).delete().then(() => {
            this.#datastore.delete(dataKey).then(resolve).catch(reject);
          }).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  deleteProject(projectId, entity){
    return new Promise((resolve, reject) => {

      const projectKey = this.#datastore.key(['project', this.#datastore.int(projectId)]);

      this.#datastore.get(projectKey).then(data => {
        const projectData = data[0];

        if(projectData.entity != entity){
          return reject('Error deleting project: not your project.');
        }

        var query = this.#datastore.createQuery('task').filter('project', '=', projectId);
        this.#datastore.runQuery(query).then(data => {
          const tasks = data[0];
          const promiseList = [];

          tasks.forEach(task => {
            var newPromise = this.deleteTaskTrusted(task[this.#datastore.KEY].id);
            promiseList.push(newPromise);
          });

          var newPromise = this.#storage.bucket(this.#bucketName).file(projectData.imageName).delete();
          promiseList.push(newPromise);

          var newPromise = this.#datastore.delete(projectKey);
          promiseList.push(newPromise);

          Promise.all(promiseList).then(resolve).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
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

  deleteTask(taskId, entity){
    return new Promise((resolve, reject) => {
      const taskKey = this.#datastore.key(['task', this.#datastore.int(taskId)]);

      this.#datastore.get(taskKey).then(data => {
        const taskData = data[0];

        const projectKey = this.#datastore.key(['project', this.#datastore.int(taskData.project)]);
        this.#datastore.get(projectKey).then(data2 => {
          const projectData = data2[0];

          if(projectData.entity != entity){
            return reject('Error deleting task: not your task.');
          }

          this.#storage.bucket(this.#bucketName).file(taskData.wasmName).delete().then(() => {
            this.#datastore.delete(taskKey).then(resolve).catch(reject);
          }).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  deleteTaskTrusted(taskId){
    return new Promise((resolve, reject) => {
      const taskKey = this.#datastore.key(['task', this.#datastore.int(taskId)]);

      this.#datastore.get(taskKey).then(data => {
        const taskData = data[0];

        this.#storage.bucket(this.#bucketName).file(taskData.wasmName).delete().then(() => {
          this.#datastore.delete(taskKey).then(resolve).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
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
      var query = this.#datastore.createQuery('execution').filter('userId', '=', userId);
      this.#datastore.runQuery(query).then(data => {
        var tasks = data[0].map(a => a.task);
        const uniqueTasks = [...new Set(tasks)];

        if(uniqueTasks.length < 1){
          return resolve([]);
        }

        var taskKeys = [];

        uniqueTasks.forEach(t => {
          taskKeys.push(this.#datastore.key(['task', this.#datastore.int(t)]));
        });

        var query = this.#datastore.createQuery('task').filter('__key__', 'IN', taskKeys);
        this.#datastore.runQuery(query).then(data => {
          var projects = data[0].map(a => a.project);
          const uniqueProjects = [...new Set(projects)];

          var projectKeys = [];

          uniqueProjects.forEach(p => {
            projectKeys.push(this.#datastore.key(['project', this.#datastore.int(p)]));
          });

          // Could happen if tasks have been deleted
          if(projectKeys.length < 1){
            return resolve([]);
          }

          var query = this.#datastore.createQuery('project').filter('__key__', 'IN', projectKeys);
          this.#datastore.runQuery(query).then(data => {
            var limitedData = data[0].map(p => {
              return {
                title: p.title,
                text: p.text,
                url: p.url,
                imageUrl: p.imageUrl
              }
            });
            resolve(limitedData);
          }).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  getData(dataId){
    return new Promise((resolve, reject) => {
      const dataKey = this.#datastore.key(['datafile', this.#datastore.int(dataId)]);

      this.#datastore.get(dataKey).then(data => {
        resolve(data[0]);
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

  getMyDataFiles(entity){
    return new Promise((resolve, reject) => {
      var query = this.#datastore.createQuery('datafile').filter('entity', '=', entity);
      this.#datastore.runQuery(query).then(data => {
        data[0].forEach(elem => {
          elem.id = elem[this.#datastore.KEY].id;
        });
        resolve(data[0]);
      }).catch(reject);
    });
  }

  getMyProjects(entity){
    return new Promise((resolve, reject) => {
      var query = this.#datastore.createQuery('project').filter('entity', '=', entity);
      this.#datastore.runQuery(query).then(data => {
        data[0].forEach(elem => {
          elem.id = elem[this.#datastore.KEY].id;
        });
        resolve(data[0]);
      }).catch(reject);
    });
  }

  async getNewTask(userId){
    var query = this.#datastore.createQuery('task');
    var tasks = await this.#datastore.runQuery(query);
    tasks = tasks[0];

    // Remove inactive tasks
    tasks = tasks.filter(t => t.isActive && !t.isResolved);

    tasks = tasks.map(t => t.id = t[this.#datastore.KEY].id);

    var query = this.#datastore.createQuery('execution');
    var executions = await this.#datastore.runQuery(query);
    executions = executions[0];

    var taskId = null;

    switch(this.#taskDistributionMethod){
      case 'fair':
        taskId = this.#fairTaskDistribution(executions, tasks, userId);
        break;
      case 'simple':
        taskId = this.#simpleTaskDistribution(executions, tasks, userId);
        break;
    }

    if(taskId == null){
      return null;
    } else {
      return await this.getTask(taskId);
    }
  }

  getProjectTasks(userEntity, projectId){
    return new Promise((resolve, reject) => {
      const projectKey = this.#datastore.key(["project", this.#datastore.int(projectId)]);
      this.#datastore.get(projectKey).then(data => {
        const projectData = data[0];
        if(!projectData || projectData.entity != userEntity){
          return reject("You are trying to access a project that is not yours.");
        }

        var query = this.#datastore.createQuery('task').filter('project', '=', projectId);
        this.#datastore.runQuery(query).then(data => {
          data[0].forEach(elem => {
            elem.id = elem[this.#datastore.KEY].id;
          });
          const tasks = data[0];
          resolve(tasks);
        }).catch(reject);
      }).catch(reject);
    });
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

  getResearcherNumbers(entity){
    return new Promise((resolve, reject) => {
      var query = this.#datastore.createQuery('project').filter('entity', '=', entity);
      this.#datastore.runQuery(query).then(data => {
        const projects = data[0].map(p => p[this.#datastore.KEY].id);

        if(projects.length < 1){
          const numbers = {
            projects: 0,
            tasks: 0
          }
          return resolve(numbers);
        }

        var query = this.#datastore.createQuery('task').filter('project', 'IN', projects);

        this.#datastore.runQuery(query).then(data2 => {
          const tasks = data2[0];

          const numbers = {
            projects: projects.length,
            tasks: tasks.length
          }

          resolve(numbers);
        }).catch(reject);
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

  getTask(taskId){
    return new Promise((resolve, reject) => {
      const taskKey = this.#datastore.key(['task', this.#datastore.int(taskId)]);

      this.#datastore.get(taskKey).then(data => {
        var task = data[0];
        task.id = task[this.#datastore.KEY].id;
        resolve(task);
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

  #isNullishOrEmpty(element){
    if(element == null || element == ""){
      return true;
    } else {
      return false;
    }
  }

  #markTaskAsCompleted(taskId, result){
    return new Promise((resolve, reject) => {
      const transaction = this.#datastore.transaction();
      const taskKey = this.#datastore.key(['task', this.#datastore.int(taskId)]);

      try {
        transaction.run().then(() => {
          transaction.get(taskKey).then(data => {
            var taskData = data[0];

            taskData.isActive = false;
            taskData.isResolved = true;
            taskData.result = result;

            const task = {
              key: taskKey,
              data: taskData
            }

            transaction.save(task);
            transaction.commit().then(resolve).catch(reject);
          }).catch(reject);
        });
      } catch (err) {
        transaction.rollback();
        reject(err);
      }
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

      this.#datastore.save(execution).then(() => {
        this.#checkIfTaskIsDone(executionData.task).then(resolve).catch(reject);
      }).catch(reject);
    });
  }

  toggleTask(entity, taskId){
    return new Promise((resolve, reject) => {
      const transaction = this.#datastore.transaction();
      const taskKey = this.#datastore.key(['task', this.#datastore.int(taskId)]);

      try {
        transaction.run().then(() => {
          transaction.get(taskKey).then(taskData => {
            var task = taskData[0];

            const projectKey = this.#datastore.key(['project', this.#datastore.int(task.project)]);

            transaction.get(projectKey).then(projectData => {
              const project = projectData[0];

              if(project.entity == entity){
                task.isActive = !task.isActive;

                const newTask = {
                  key: taskKey,
                  data: task
                }

                transaction.save(newTask);
              }
              transaction.commit().then(resolve).catch(reject);
            }).catch(reject);
          }).catch(reject);
        });
      } catch (err) {
        transaction.rollback();
        reject(err);
      }
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

  updateProject(project, newImage, entity){
    return new Promise((resolve, reject) => {
      const transaction = this.#datastore.transaction();
      const projectKey = this.#datastore.key(['project', this.#datastore.int(project.id)]);

      try {
        transaction.run().then(() => {
          transaction.get(projectKey).then(data => {
            var projectData = data[0];
            
            if(projectData.entity != entity){
              return reject('Error updating: Not your project.');
            }

            if(!this.#isNullishOrEmpty(project.title)){
              projectData.title = project.title;
            }

            if(!this.#isNullishOrEmpty(project.text)){
              projectData.text = project.text;
            }

            if(!this.#isNullishOrEmpty(project.url)){
              projectData.url = project.url;
            }

            if(this.#isNullishOrEmpty(newImage)){
              const updatedProject = {
                key: projectKey,
                data: projectData
              }
  
              transaction.save(updatedProject);
              transaction.commit().then(resolve).catch(reject);
            } else {
              this.#storage.bucket(this.#bucketName).file(projectData.imageName).delete().catch(reject);

              const extension = newImage.originalname.split('.').at(-1);
              const destFileName = "image-" + crypto.randomUUID() + "." + extension;

              this.#storage.bucket(this.#bucketName).file(destFileName).save(newImage.buffer).then(() => {
                projectData.imageName = destFileName;

                const fileRef = this.#storage.bucket(this.#bucketName).file(destFileName);

                fileRef.makePublic().then(() => {
                  const imageUrl = this.#baseStorageUrl.concat(this.#bucketName, '/', destFileName);

                  projectData.imageUrl = imageUrl;

                  const updatedProject = {
                    key: projectKey,
                    data: projectData
                  }
      
                  transaction.save(updatedProject);
                  transaction.commit().then(resolve).catch(reject);
                }).catch(reject);
              }).catch(reject);
            }
          }).catch(reject);
        });
      } catch (err) {
        transaction.rollback();
        reject(err);
      }
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

  updateTask(task, entity){
    return new Promise((resolve, reject) => {
      const transaction = this.#datastore.transaction();
      const taskKey = this.#datastore.key(['task', this.#datastore.int(task.id)]);

      try {
        transaction.run().then(() => {
          transaction.get(taskKey).then(data => {
            var taskData = data[0];

            if(!this.#isNullishOrEmpty(task.title)){
              taskData.title = task.title;
            }

            if(task.dataDependencies != null){
              taskData.dataDependencies = task.dataDependencies;
            }

            if(!this.#isNullishOrEmpty(task.project)){
              taskData.project = task.project;
            }

            const projectKey = this.#datastore.key(['project', this.#datastore.int(task.project)]);
            transaction.get(projectKey).then(data2 => {
              const projectData = data2[0];

              if(projectData.entity != entity){
                return reject('Error updating task: not your project.');
              }

              const modifiedTask = {
                key: taskKey,
                data: taskData
              }
  
              transaction.save(modifiedTask);
              transaction.commit().then(resolve).catch(reject);
            }).catch(reject);
          }).catch(reject);
        }).catch(reject);
      } catch (err) {
        transaction.rollback();
        reject(err);
      }
    });
  }

  // Task distribution methods

  #fairTaskDistribution(executions, tasks, userId){
    const executionsPerTask = Object.entries(executions.reduce((acc, { task }) => {
      acc[task] = (acc[task] || 0) + 1;
      return acc;
    }, {})).map( ([k,v]) => ({task: k, count: v}));

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
      // Prevents a user from running the same task multiple times
      if(!executions.some(e => e.task === executionsPerTask[i].task && e.userId === userId)){
        return executionsPerTask[i].task;
      }
    }
    return null;
  }

  #simpleTaskDistribution(executions, tasks, userId){
    for(let i=0; i < tasks.length; i++){
      // Prevents a user from running the same task multiple times
      if(!executions.some(e => e.task === tasks[i] && e.userId === userId)){
        return tasks[i];
      }
    }
    return null;
  }
}

module.exports = Database;
