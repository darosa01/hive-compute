
class Database {

  #isReady;
  #objectStore;

  constructor(){
    if(typeof Database.instance === "object"){
      return Database.instance;
    }

    this.#isReady = false;
    this.#objectStore = "files";  

    Database.instance = this;
    return this;
  }

  init(){
    if(this.#isReady){
      return Promise.resolve();
    }

    var trueThis = this;

    return new Promise((resolve, reject) => {
      const dbPromise = window.indexedDB.open('dataDependencies', 1);

      dbPromise.onupgradeneeded = function(e){
        if (!dbPromise.result.objectStoreNames.contains(trueThis.#objectStore)) {
          dbPromise.result.createObjectStore(trueThis.#objectStore, { keyPath: 'name' });
        }
      }  
      dbPromise.onerror = function(e){
        reject("The use of IndexedDB has not been authorized."); 
      }
      dbPromise.onsuccess = function(e){
        trueThis.db = dbPromise.result;
      
        trueThis.db.onerror = function(e) {
          console.error("Database error: " + e.target.errorCode);
        };
  
        trueThis.#isReady = true;
        resolve();
      }
    });
  }

  getAllFiles(){
    if(!this.#isReady){
      throw new Error('You are trying to get data from an uninitialized database.');
    }

    return new Promise((resolve, reject) => {
      var store = this.db.transaction(this.#objectStore, 'readwrite').objectStore(this.#objectStore);
      var request = store.getAll();

      request.onsuccess = function() {
        if(request.result){
          return resolve(request.result);
        } else {
          return resolve([]);
        }
      };
      request.onerror = function() {
        return reject(request.error);
      }
    });
  }

  getData(dataId){
    if(!this.#isReady){
      throw new Error('You are trying to get data from an uninitialized database.');
    }

    return new Promise((resolve, reject) => {  
      var store = this.db.transaction(this.#objectStore, 'readwrite').objectStore(this.#objectStore);
      var request = store.get(dataId);
    
      request.onerror = (e) => {
        reject();
      };
      request.onsuccess = (e) => {
        resolve(request.result);
      };
    });
  }

  saveData(dataId, name, buffer){
    if(!this.#isReady){
      throw new Error('You are trying to save data to an uninitialized database.');
    }

    var store = this.db.transaction(this.#objectStore, 'readwrite').objectStore(this.#objectStore);
    store.put({ dataId: dataId, name: name, buffer: buffer });
  }
}

export { Database };
