// Development utility only. Do not publish generated credentials.
// Run with: node scripts/generate-hash.js <password>

import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password || password.length < 12) {
  console.error("Provide a password of at least 12 characters.");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(`Hash: ${hash}`);
