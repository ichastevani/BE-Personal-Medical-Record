// node data/aes_key.js
const crypto = require("crypto");

const key = crypto.randomBytes(32).toString("hex"); // Kunci 256-bit
const iv = crypto.randomBytes(16).toString("hex");  // IV 16-byte

console.log("Key:");
console.log(key);
console.log("");
console.log("IV:");
console.log(iv);
