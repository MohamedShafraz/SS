const crypto = require("crypto");

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

console.log("LICENSE_PRIVATE_KEY_PEM=");
console.log(privateKey.replace(/\n/g, "\\n"));
console.log("");
console.log("LICENSE_PUBLIC_KEY_PEM=");
console.log(publicKey.replace(/\n/g, "\\n"));
