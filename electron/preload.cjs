const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mshposHardware", {
  listPrinters: () => ipcRenderer.invoke("hardware:list-printers"),
  printBarcode: (html, printerName, options) =>
    ipcRenderer.invoke("hardware:print-barcode", { html, printerName, options }),
  printBarcodePdf: (pdfBase64, printerName) =>
    ipcRenderer.invoke("hardware:print-barcode-pdf", { pdfBase64, printerName }),
  previewBarcodePdf: (pdfBase64) =>
    ipcRenderer.invoke("hardware:preview-barcode-pdf", { pdfBase64 }),
});
