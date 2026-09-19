const fs = require("fs");
const path = require("path");

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const standaloneNext = path.join(standalone, ".next");
const staticSource = path.join(root, ".next", "static");
const staticTarget = path.join(standaloneNext, "static");
const publicSource = path.join(root, "public");
const publicTarget = path.join(standalone, "public");
const initialDb = path.join(root, "client-build", "data", "pos-local-db.sqlite");
const licenseConfig = path.join(root, "client-build", "license-config.json");

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
}

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  throw new Error("Missing .next/standalone/server.js. Run npm.cmd run build first.");
}

if (!fs.existsSync(initialDb)) {
  throw new Error(
    "Missing client-build/data/pos-local-db.sqlite. Run npm.cmd run register-client -- --company=\"Client Name\" --fresh first."
  );
}

if (!fs.existsSync(licenseConfig)) {
  fs.mkdirSync(path.dirname(licenseConfig), { recursive: true });
  fs.writeFileSync(licenseConfig, JSON.stringify({}, null, 2));
}

copyDir(staticSource, staticTarget);
copyDir(publicSource, publicTarget);

console.log("Electron assets prepared");
