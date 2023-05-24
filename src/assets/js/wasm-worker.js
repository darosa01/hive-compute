onmessage = async event => {
  const instance = event.data;
  
  // Call the "compute" function in the WebAssembly module
  const result = instance.exports.compute();
  
  // Send the result back to the main thread
  postMessage(result);
};