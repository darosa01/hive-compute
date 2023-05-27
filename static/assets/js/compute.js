import { P2P } from "./p2p.js";

class Compute {

  #isComputing;
  #p2pClient;
  #timeoutRetry;
  #userId;
  #worker;

  constructor(){
    this.#isComputing = false;
  }

  init(userId){
    return new Promise((resolve, reject) => {
      this.#userId = userId;
      this.#p2pClient = new P2P();
      this.#p2pClient.init().then(resolve).catch(reject);
    });
  }

  #computeNewTask(){
    this.#getNewTask().then(task => {
      if(task){
        try {
          const codeBlob = new Blob([task.code], {
            type: 'text/javascript'
          });
          const codeURL = URL.createObjectURL(codeBlob);
  
          worker = new Worker(codeURL);
  
          this.#getTaskWasm(task.name).then(results => {
            const { instance } = results;
            
            // Create a Web Worker
            const worker = new Worker('wasm-worker.js');
            
            // Send the WebAssembly module to the worker
            worker.postMessage(instance);
            
            worker.onmessage = function(event){
            
              this.#submitCompletedTask({
                taskId: task.name,
                result: event.data
              });
              
              worker.terminate();
              if(this.#isComputing){
                this.#computeNewTask();
              }
            };
          });
        } catch (error) {
          console.error("CODE EXECUTION ERROR: " + error);
        }
      } else {
        // if we don't have a task to solve -> wait for a minute and start again
        console.info("There are no more tasks to solve. Trying again in 1 minute.")
        timeoutRetry = setTimeout(() => {
          this.#computeNewTask();
        }, 1000 * 60);
      }
    }).catch(console.error);  
  }

  #getNewTask(){
    return new Promise((resolve, reject) => {
      fetch('api/getNewTask', {
        method: "GET",
        headers: {
          "User-Id": userId
        }
      }).then(res => res.json()).then(task => {
        if(task){
          resolve(task); // task to resolve
        } else if(task === null){
          resolve(null); // no more tasks available
        } else{
          reject("Error receiving the task.");
        }
      }).catch(reject);
    });
  }

  #getTaskWasm(taskId){
    return new Promise((resolve, reject) => {
      fetch('api/getTaskWasm', {
        method: 'GET',
        headers: {
          "User-Id": userId,
          "Task-Id": taskId
        }
      })
      .then(response => response.arrayBuffer())
      .then(bytes => WebAssembly.instantiate(bytes))
      .then(resolve)
      .catch(reject);
    });
  }

  startComputing(){
    this.#isComputing = true;
    this.#computeNewTask();
  }

  stopComputing(){

    this.#isComputing = false;
  
    if(typeof(worker) !== "undefined"){
      this.#worker.terminate();
    }
    if(this.#timeoutRetry !== undefined){
      clearTimeout(this.#timeoutRetry);
    }
  }

  #submitCompletedTask(data){
    fetch('api/submitCompletedTask', {
      method: "POST",
      headers: {
        "User-Id": this.#userId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }).catch(err => console.error(err));
  }
}

export { Compute }
