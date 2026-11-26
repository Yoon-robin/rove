// node test/drive.mjs test/drawer-icons.mjs: history and bookmark rows show the site's own icon
// (kept per host in icons.json, from normal windows only); a private window's sites are not kept, and
// a host left in neither list is dropped. Uses the network (Wikipedia, GitHub). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.KEPT = () => { const fs = process.mainModule.require("fs"), p = process.mainModule.require("path").join(process.env.ROVE_HOME, "icons.json"); try { return Object.keys(JSON.parse(fs.readFileSync(p, "utf8"))); } catch { return []; } };
globalThis.ROWS = async (panel) => { R.showOverlay({ kind: "drawer", panel }); await sleep(700);
  const r = await R.overlay.webContents.executeJavaScript("[...document.querySelectorAll('.drawer .item[data-url]')].map((e) => ({ url: e.dataset.url, img: e.querySelector(':scope > img.fav')?.src.slice(0, 11) || '', w: e.querySelector(':scope > img.fav')?.getBoundingClientRect().width || 0 }))");
  R.hideOverlay(); await sleep(200); return r; };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.win.setContentSize(1000, 700); R.go("https://www.wikipedia.org/"); await sleep(5000); R.star(); await sleep(1500); return "ready " + KEPT().join(",");` },
  { js: `const rows = await ROWS("history"), w = rows.find((r) => r.url.includes("wikipedia"));
    return CHECK("history: the site's icon, 16px", w && w.img === "data:image/" && w.w === 16, rows);` },
  { js: `const rows = await ROWS("bookmarks"); return CHECK("bookmarks: the site's icon", rows[0]?.img === "data:image/", rows);` },
  { js: `const w = R.createWindow({ priv: true }); await sleep(800); R.go("https://github.com/"); await sleep(6000);
    const k = KEPT(), shown = !!R.active?.favicon; R.win.close(); await sleep(800); return CHECK("private window: its tab has the icon, but it is not kept", shown && !k.some((h) => h.includes("github")), { shown, k });` },
  { js: `R.use(R.windows.find((w) => !w.private && !w.gone)); await sleep(300);
    const ipc = process.mainModule.require("electron").ipcMain;
    ipc.emit("rove:unstar", { sender: R.win.webContents }, "https://www.wikipedia.org/"); ipc.emit("rove:forget-all", { sender: R.win.webContents }); await sleep(1500);
    const k = KEPT(); return CHECK("history and bookmarks cleared: no icon kept", k.length === 0, k);` },
];
