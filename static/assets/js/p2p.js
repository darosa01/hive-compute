// import WebTorrent from 'https://esm.sh/webtorrent'
import { Database } from './database.js';

class P2P {

  #client;
  #db;
  #isReady;

  #userId;

  constructor(){
    this.#isReady = false;
    this.#userId = userId;
  }

  init(userId){
    if(this.#isReady){
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.#userId = userId;
      this.#db = new Database();
      this.#db.init().then(() => {
        if(WebTorrent.WEBRTC_SUPPORT){
          this.#client = new WebTorrent();
          this.#seedPreviousFiles();
          this.#isReady = true;
          resolve();
        } else {
          reject("WebRTC is not supported by the browser.");
        }
      }).catch(reject);
    });
  }

  closeAndClean(){
    if(this.#client){
      this.#client.destroy();
    }
  }

  #downloadTorrent(torrentBuffer, dataId, name){
    if(!this.#isReady){
      throw new Error('You are trying to use an uninitialized P2P client.');
    }

    this.#client.add(torrentBuffer, (torrent) => {
      torrent.files.forEach((file) => {
        file.getBuffer((err, buffer) => {
          if (err) {
            console.error(err);
            return;
          }
          this.#db.saveData(dataId, name, buffer);
        });
      });
    });
  }

  getData(dataId){
    if(!this.#isReady){
      throw new Error('You are trying to use an uninitialized P2P client.');
    }

    return new Promise((resolve, reject) => {
      this.#db.getData(dataId).then(dataFromDB => {
        if(dataFromDB != null){
          return resolve(dataFromDB.file);
        }

        fetch('/api/getData', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Id': userId
          },
          body: JSON.stringify({dataId: dataId})
        }).then(res => res.json()).then(data => {
          fetch(data.torrentUrl).then(res => res.arrayBuffer()).then(torrentBuffer => {
            this.#downloadTorrent(torrentBuffer, dataId, data.fileName);
          }).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  #seedPreviousFiles(){
    this.#db.getAllFiles().then(files => {
      files.forEach(file => {
        this.#client.seed(file.buffer, { name: file.name });
      });
    }).catch(console.error);
  }
}

export { P2P }
