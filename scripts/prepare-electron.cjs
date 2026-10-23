const fs = require("fs");
const path = require("path");

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const standaloneNext = path.join(standalone, ".next");
const staticSource = path.join(root, ".next", "static");
const staticTarget = path.join(standaloneNext, "static");
const publicSource = path.join(root, "public");
const publicTarget = path.join(standalone, "public");

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
}

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  throw new Error("Missing .next/standalone/server.js. Run npm.cmd run build first.");
}

copyDir(staticSource, staticTarget);
copyDir(publicSource, publicTarget);

// Next standalone tracing can copy the development data directory into the
// deployable server folder. The packaged app must always create/open its
// database in Electron's per-user data directory instead.
const bundledDataDirectory = path.join(standalone, "data");
if (fs.existsSync(bundledDataDirectory)) {
  fs.rmSync(bundledDataDirectory, { recursive: true, force: true });
}

for (const filename of fs.readdirSync(standalone)) {
  if (filename === ".env" || filename.startsWith(".env.")) {
    fs.rmSync(path.join(standalone, filename), { force: true });
  }
}

console.log("Electron assets prepared");
