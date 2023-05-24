import WebTorrent from 'https://esm.sh/webtorrent'
import { Database } from './database.js';

class P2P {

  #client;
  #db;
  #isReady;

  constructor(){
    this.#isReady = false;
  }

  init(){
    if(this.#isReady){
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.#db = new Database();
      this.#db.init().then(() => {
        if(WebTorrent.WEBRTC_SUPPORT){
          this.#client = new WebTorrent();
          this.#seedFiles();
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

  downloadTorrent(torrentId){
    if(!this.#isReady){
      throw new Error('You are trying to use an uninitialized P2P client.');
    }

    this.#client.add(torrentId, (torrent) => {
      torrent.files.forEach((file) => {
        file.getBuffer((err, buffer) => {
          if (err) {
            console.error(err);
            return;
          }
          this.#db.saveData(buffer, file.name, file.length);
        });
      });
    });
  }

  #seedFiles(){
    this.#db.getAllFiles().then(files => {
      files.forEach(file => {
        this.#client.seed(file.buffer, { name: file.name });
      });
    }).catch(console.error);
  }
}

export { P2P }
