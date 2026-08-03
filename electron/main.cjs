const { app, BrowserWindow, dialog } = require("electron");
const { fork } = require("child_process");
const path = require("path");
const net = require("net");
const fs = require("fs");

let serverProcess = null;
let mainWindow = null;

function findFreePort(start = 3040) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => {
      findFreePort(start + 1).then(resolve, reject);
    });
    server.once("listening", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.listen(start, "127.0.0.1");
  });
}

function serverPath() {
  if (!app.isPackaged) {
    return path.join(process.cwd(), ".next", "standalone", "server.js");
  }

  return path.join(process.resourcesPath, "app.asar.unpacked", ".next", "standalone", "server.js");
}

function copyInitialDatabaseIfNeeded() {
  if (!app.isPackaged) return;

  const userDataDb = path.join(app.getPath("userData"), "pos-local-db.sqlite");
  const initialDb = path.join(process.resourcesPath, "initial-data", "pos-local-db.sqlite");

  if (fs.existsSync(userDataDb) || !fs.existsSync(initialDb)) return;

  fs.mkdirSync(path.dirname(userDataDb), { recursive: true });
  fs.copyFileSync(initialDb, userDataDb);
}

function readLicenseConfig() {
  const configPath = app.isPackaged
    ? path.join(process.resourcesPath, "license-config.json")
    : path.join(process.cwd(), "client-build", "license-config.json");

  if (!fs.existsSync(configPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

async function startServer() {
  const port = await findFreePort();
  const userData = app.getPath("userData");
  const licenseConfig = readLicenseConfig();
  copyInitialDatabaseIfNeeded();

  serverProcess = fork(serverPath(), [], {
    cwd: path.dirname(serverPath()),
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      POS_LOCAL_DB_PATH: path.join(userData, "pos-local-db.sqlite"),
      JWT_SECRET: process.env.JWT_SECRET || "offline-pos-local-session-secret-change-before-client-build",
      ACTIVATION_SERVER_URL:
        process.env.ACTIVATION_SERVER_URL || licenseConfig.activationServerUrl || "",
      LICENSE_PUBLIC_KEY_PEM:
        process.env.LICENSE_PUBLIC_KEY_PEM || licenseConfig.licensePublicKeyPem || "",
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "pipe",
    execPath: process.execPath,
  });

  serverProcess.on("error", (error) => {
    dialog.showErrorBox("MSHPOS failed to start", error.message);
  });

  return `http://127.0.0.1:${port}`;
}

async function createWindow() {
  const url = await startServer();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: "MSHPOS",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(url);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
