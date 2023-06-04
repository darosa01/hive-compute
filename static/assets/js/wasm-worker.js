onmessage = async event => {
  const instance = event.data;
  
  // Call the "main" function in the WebAssembly module
  const result = instance.exports.main();
  
  // Send the result back to the main thread
  postMessage(result);
};