// This script helps generate bcrypt password hashes for users
// Run with: node scripts/generate-hash.js

import bcrypt from "bcryptjs";

const password = process.argv[2] || "admin123";

const hash = bcrypt.hashSync(password, 10);
console.log(`Password: ${password}`);
console.log(`Hash: ${hash}`);
