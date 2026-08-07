const { app, BrowserWindow, dialog } = require("electron");
const { fork, spawn } = require("child_process");
const path = require("path");
const net = require("net");
const fs = require("fs");

let serverProcess = null;
let mainWindow = null;

const AGREEMENT_VERSION = 1;
const AGREEMENT_TEXT =
  "This software is strictly licensed for use in lawful businesses (such as Sports, Mechanic, and Electronics shops). Use of this software to facilitate the sale of alcohol, gambling, pork products, or other unlawful goods is strictly prohibited and violates this license.";

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

function agreementPath() {
  return path.join(app.getPath("userData"), "license-usage-agreement.json");
}

function hasAcceptedUsageAgreement() {
  const filePath = agreementPath();
  if (!fs.existsSync(filePath)) return false;

  try {
    const record = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return record.accepted === true && record.version === AGREEMENT_VERSION;
  } catch {
    return false;
  }
}

function saveUsageAgreementAcceptance() {
  const filePath = agreementPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        accepted: true,
        version: AGREEMENT_VERSION,
        acceptedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
}

async function requireUsageAgreement(parentWindow) {
  if (hasAcceptedUsageAgreement()) return true;

  const result = await dialog.showMessageBox(parentWindow, {
    type: "warning",
    title: "License & Usage Agreement",
    message: "License & Usage Agreement",
    detail: AGREEMENT_TEXT,
    buttons: ["I Agree and Accept", "Exit"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    normalizeAccessKeys: true,
  });

  if (result.response !== 0) return false;

  saveUsageAgreementAcceptance();
  return true;
}

function getMicrosoftStoreProductId() {
  const licenseConfig = readLicenseConfig();

  // Put your Microsoft Store add-on/Product ID in one of these places:
  // 1. MICROSOFT_STORE_PRODUCT_ID at build/runtime, or
  // 2. client-build/license-config.json as { "microsoftStoreProductId": "YOUR_STORE_ID" }.
  return (
    process.env.MICROSOFT_STORE_PRODUCT_ID ||
    licenseConfig.microsoftStoreProductId ||
    ""
  ).trim();
}

function storeBridgePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "store-iap", "StoreIapBridge.exe");
  }

  return path.join(
    process.cwd(),
    "native",
    "StoreIapBridge",
    "bin",
    "Release",
    "net8.0-windows10.0.26100.0",
    "win-x64",
    "publish",
    "StoreIapBridge.exe"
  );
}

function getWindowHandle(window) {
  const handle = window.getNativeWindowHandle();
  if (handle.length >= 8 && typeof handle.readBigUInt64LE === "function") {
    return handle.readBigUInt64LE(0).toString();
  }

  return String(handle.readUInt32LE(0));
}

function runStoreBridge(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(storeBridgePath(), args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Store bridge exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Store bridge returned invalid JSON: ${error.message}`));
      }
    });
  });
}

async function ensureMicrosoftStoreLicense(parentWindow) {
  if (process.platform !== "win32") return true;

  const productId = getMicrosoftStoreProductId();
  if (!productId) {
    if (!app.isPackaged) return true;

    await dialog.showMessageBox(parentWindow, {
      type: "error",
      title: "Microsoft Store product is not configured",
      message: "Microsoft Store product is not configured.",
      detail:
        "Set MICROSOFT_STORE_PRODUCT_ID or add microsoftStoreProductId to client-build/license-config.json before building the Store package.",
    });
    return false;
  }

  const bridgePath = storeBridgePath();
  if (!fs.existsSync(bridgePath)) {
    if (!app.isPackaged) return true;

    await dialog.showMessageBox(parentWindow, {
      type: "error",
      title: "Microsoft Store purchase component is missing",
      message: "Microsoft Store purchase component is missing.",
      detail: `Expected StoreIapBridge.exe at: ${bridgePath}`,
    });
    return false;
  }

  try {
    const result = await runStoreBridge([
      "--product-id",
      productId,
      "--hwnd",
      getWindowHandle(parentWindow),
      "--purchase-if-needed",
    ]);

    if (result.licensed === true) return true;

    await dialog.showMessageBox(parentWindow, {
      type: "warning",
      title: "Purchase required",
      message: "A Microsoft Store license is required to use MSHPOS.",
      detail: result.message || "The purchase was not completed.",
    });
    return false;
  } catch (error) {
    await dialog.showMessageBox(parentWindow, {
      type: "error",
      title: "Microsoft Store purchase failed",
      message: "Microsoft Store purchase failed.",
      detail: error.message,
    });
    return false;
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: "MSHPOS",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const accepted = await requireUsageAgreement(mainWindow);
  if (!accepted) {
    app.quit();
    return;
  }

  const licensed = await ensureMicrosoftStoreLicense(mainWindow);
  if (!licensed) {
    app.quit();
    return;
  }

  const url = await startServer();
  await mainWindow.loadURL(url);
  mainWindow.show();
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
