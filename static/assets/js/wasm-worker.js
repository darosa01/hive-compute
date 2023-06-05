onmessage = async event => {
  const payload = event.data;

  const wasmCode = payload.wasm;
  const data = payload.data;

  WebAssembly.instantiateStreaming(fetch(wasmCode)).then(res => {
    const exports = res.instance.exports;

    var result = null;

    if(data != null){
      result = exports.main(data);
    } else {
      result = exports.main();
    }

    postMessage(result);
  });
};