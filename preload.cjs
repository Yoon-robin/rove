// Only Rove's own two views (the top and the overlay) get this; pages get
// nothing. Names outside "rove:" are not passed on.
const { contextBridge, ipcRenderer } = require("electron");

const ok = (name) => typeof name === "string" && name.startsWith("rove:");
contextBridge.exposeInMainWorld("rove", {
  send: (name, ...args) => { if (ok(name)) ipcRenderer.send(name, ...args); },
  ask: (name, ...args) => (ok(name) ? ipcRenderer.invoke(name, ...args) : Promise.resolve(null)),
  on: (name, f) => { if (ok(name)) ipcRenderer.on(name, (e, ...args) => f(...args)); },
});
