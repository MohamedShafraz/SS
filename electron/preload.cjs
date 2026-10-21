const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mshposHardware", {
  listPrinters: () => ipcRenderer.invoke("hardware:list-printers"),
  selectBackupFolder: () => ipcRenderer.invoke("hardware:select-backup-folder"),
  printBarcode: (html, printerName, options) =>
    ipcRenderer.invoke("hardware:print-barcode", { html, printerName, options }),
  printBarcodePdf: (pdfBase64, printerName) =>
    ipcRenderer.invoke("hardware:print-barcode-pdf", { pdfBase64, printerName }),
  previewBarcodePdf: (pdfBase64, viewerIds) =>
    ipcRenderer.invoke("hardware:preview-barcode-pdf", { pdfBase64, viewerIds }),
  previewBarcodeHtml: (html, options, viewerIds) =>
    ipcRenderer.invoke("hardware:preview-barcode-html", { html, options, viewerIds }),
  listPdfViewers: () => ipcRenderer.invoke("hardware:list-pdf-viewers"),
  openPdfRepairSettings: () => ipcRenderer.invoke("hardware:open-pdf-repair-settings"),
});
