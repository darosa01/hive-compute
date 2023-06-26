// import WebTorrent from 'https://esm.sh/webtorrent'
import { Database } from './database.js';

class P2P {

  #client;
  #db;
  #isReady;
  #userId;

  constructor(){
    this.#isReady = false;
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
          this.#isReady = true;
          this.#seedPreviousFiles().then(resolve).catch(reject);
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

  #downloadTorrent(torrentUrl, dataId, name){
    if(!this.#isReady){
      throw new Error('You are trying to use an uninitialized P2P client.');
    }

    console.info("Downloading data from torrent.");
    return new Promise((resolve, reject) => {
      this.#client.add(torrentUrl, (torrent) => {
        var file = torrent.files[0];
        file.getBuffer((err, buffer) => {
          if (err) {
            return reject(err);
          }
          this.#db.saveData(dataId, name, buffer);
          return resolve(buffer);
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
          console.info("Getting necessary data from local DB.");
          return resolve(dataFromDB.file);
        }

        console.info("Downloading torrent file.");
        fetch('/api/getData', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Id': this.#userId
          },
          body: JSON.stringify({dataId: dataId})
        }).then(res => res.json()).then(data => {
          this.#downloadTorrent(data.torrentUrl, dataId, data.fileName).then(resolve).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }

  #seedPreviousFiles(){
    console.info("P2P: Seeding preexisting files.");
    return new Promise((resolve, reject) => {
      this.#db.getAllFiles().then(files => {
        files.forEach(file => {
          var newFile = new File(file.buffer, file.name);
          this.#client.seed(newFile);
        });
        resolve();
      }).catch(reject);
    });
  }
}

export { P2P }
