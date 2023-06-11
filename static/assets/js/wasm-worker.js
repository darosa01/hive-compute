onmessage = async event => {
  const payload = event.data;

  const wasmCode = payload.wasm;
  const jsModule = payload.js;
  const data = payload.data;

  importScripts(jsModule);

  WebAssembly.Module.onRuntimeInitialized = () => {
    var result = null;

    if(data != null){
      result = exports.compute(data);
    } else {
      result = exports.compute();
    }

    postMessage(result);
  };

  WebAssembly.instantiate(wasmCode).then(res => {
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