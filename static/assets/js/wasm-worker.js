onmessage = async event => {
  const payload = event.data;

  const wasmCode = payload.wasm;
  const file = payload.data;

  const memory = new WebAssembly.Memory({ initial: 1 }); 

  const buffer = memory.buffer;

  const imports = {
    wasmMemory: memory,
    wasi_snapshot_preview1: {
      proc_exit: function() {
        
      }
    },
    env: {
      print: (offset) => {
        const intArray = new Uint8Array(buffer, offset, 1);
        console.log("Memory value:", intArray[0]);
      }
    }
  };

  const res = await WebAssembly.instantiate(wasmCode, imports);
  const exports = res.instance.exports;

  var resultArray = null;

  if(file != null){
    const fileBuffer = await file.arrayBuffer();
    const dataArray = new Uint8Array(fileBuffer);
    const dataSize = dataArray.length;
    const currentSize = exports.memory.buffer.byteLength;
    const neededPages = Math.ceil(dataSize / 65536); // 64KB pages
    exports.memory.grow(neededPages);
    const offset = currentSize;
    const dataView = new Uint8Array(exports.memory.buffer, offset, dataSize);
    dataView.set(dataArray);
    const resultPtr = exports.compute(offset, dataSize);
    const resultSize = exports.resultSize(resultPtr);
    resultArray = new Uint8Array(
      exports.memory.buffer,
      resultPtr,
      resultSize
    );
  } else {
    const resultPtr = exports.compute();
    const resultSize = exports.resultSize(resultPtr);
    resultArray = new Uint8Array(
      exports.memory.buffer,
      resultPtr,
      resultSize
    );
  }

  postMessage(resultArray);
};