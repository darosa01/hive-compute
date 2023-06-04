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
      this.#p2pClient.init(userId).then(resolve).catch(reject);
    });
  }

  async #computeNewTask(){
    var task = await this.#getNewTask();

    if(task){
      var wasmResponse = await fetch(task.wasmUrl);
      var wasmCode = await wasmResponse.arrayBuffer();
      var data = null;

      if(task.dataDependencies){
        data = await this.#p2pClient.getData(task.dataDependencies);
      }

      const taskPayload = {
        wasm: wasmCode,
        data: data
      }

      try {
        this.#worker = new Worker('wasm-worker.js');
        
        this.#worker.postMessage(taskPayload);
        
        this.#worker.onmessage = (event) => {
          this.#submitCompletedTask({
            taskId: task.name,
            result: event.data
          });
          
          this.#worker.terminate();
          if(this.#isComputing){
            this.#computeNewTask();
          }
        };
      } catch (error) {
        console.error("CODE EXECUTION ERROR: " + error);
      }
    } else {
      console.info("There are no more tasks to solve. Trying again in 1 minute.")
      this.#timeoutRetry = setTimeout(() => {
        this.#computeNewTask();
      }, 1000 * 60);
    }
  }

  #getNewTask(){
    return new Promise((resolve, reject) => {
      fetch('api/getNewTask', {
        method: "GET",
        headers: {
          "User-Id": this.#userId
        }
      }).then(res => res.json()).then(task => {
        if(task){
          resolve(task); // task to resolve
        } else if(task === null){
          resolve(null); // no more tasks available
        } else {
          reject("Error receiving the task.");
        }
      }).catch(reject);
    });
  }

  isComputing(){
    return this.#isComputing;
  }

  startComputing(){
    if(!this.#isComputing){
      this.#isComputing = true;
      this.#computeNewTask();
    }
  }

  stopComputing(){
    if(this.#isComputing){
      this.#isComputing = false;
  
      if(typeof(worker) !== "undefined"){
        this.#worker.terminate();
      }
      if(this.#timeoutRetry !== undefined){
        clearTimeout(this.#timeoutRetry);
      }
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
    }).catch(console.error);
  }
}

export { Compute }
