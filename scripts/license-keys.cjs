const crypto = require("crypto");

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

console.log("LICENSE_PUBLIC_KEY_PEM=");
console.log(publicKey.export({ type: "spki", format: "pem" }));
console.log("LICENSE_PRIVATE_KEY_PEM=");
console.log(privateKey.export({ type: "pkcs8", format: "pem" }));
