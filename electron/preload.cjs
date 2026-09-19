const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mshposHardware", {
  listPrinters: () => ipcRenderer.invoke("hardware:list-printers"),
  printBarcode: (html, printerName) =>
    ipcRenderer.invoke("hardware:print-barcode", { html, printerName }),
});
