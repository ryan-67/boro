const fs = require("fs"); 
const [,, dest, src] = process.argv; 
let data = fs.readFileSync(src, "utf8").replace(/\\r/g, "").replace(/\\n/g, ""); 
fs.writeFileSync(dest, Buffer.from(data, "base64")); 
console.log("done", dest); 
