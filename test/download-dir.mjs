// node test/drive.mjs test/download-dir.mjs: the downloads drawer says where new files go and its
// 바꾸기 picks another folder (Brave's and Chrome's 설정 · 다운로드 · 위치 · 변경); files then come
// down there, Ctrl+S offers it too, and a picked folder that is gone falls back to the default.
// The folder dialog is stood in for (no window on screen); a local server sends the files — no network.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs");
globalThis.PATH = process.mainModule.require("node:path");
globalThis.DIALOG = process.mainModule.require("electron").dialog;
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  const n = new URL(q.url, "http://x").searchParams.get("n") || "x";
  if (n === "page") { s.writeHead(200, { "content-type": "text/html" }); return s.end("<title>p</title>"); }
  s.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=" + n });
  s.end("hello " + n);
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
{ const wc = R.active.view.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-stop-loading", r)); await wc.loadURL(BASE + "/?n=page").catch(() => {}); }
globalThis.PICKED = FS.mkdtempSync(PATH.join(process.mainModule.require("node:os").tmpdir(), "rove-picked-"));
globalThis.GET = async (n) => { R.active.view.webContents.downloadURL(BASE + "/f?n=" + n); for (let i = 0; i < 30 && !R.downloads.find((d) => d.name === n && d.state === "completed"); i++) await sleep(100); return R.downloads.find((d) => d.name === n); };
globalThis.FOOT = async () => { R.showOverlay({ kind: "drawer", panel: "downloads" }); await sleep(600);
  return R.overlay.webContents.executeJavaScript("(() => { const f = document.querySelector('.drawer footer'); return f ? { where: f.querySelector('.where')?.textContent, title: f.querySelector('.where')?.title, buttons: [...f.querySelectorAll('button')].map((b) => b.textContent) } : null; })()"); };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `const f = await FOOT();
    return CHECK("empty drawer: 받는 곳 is the default folder, with 바꾸기", f?.where === "받는 곳 downloads" && JSON.stringify(f.buttons) === '["바꾸기"]', f);` },
  { js: `let asked = null;
    DIALOG.showOpenDialog = async (w, o) => { asked = o; return { canceled: false, filePaths: [PICKED] }; };
    await R.overlay.webContents.executeJavaScript("document.querySelector('.drawer [data-dir]').click(), 1"); await sleep(500);
    const d = await GET("there.txt"), f = await FOOT();
    const got = { opens: asked?.properties, saved: R.settings.downloadDir === PICKED, foot: f, to: d && PATH.dirname(d.path) === PICKED, body: d && FS.existsSync(d.path) ? FS.readFileSync(d.path, "utf8") : null };
    return CHECK("바꾸기: picks a folder, the drawer names it, the next file comes down there", JSON.stringify(got.opens) === '["openDirectory","createDirectory"]' && got.saved && f?.where === "받는 곳 " + PATH.basename(PICKED) && f.title === PICKED && got.to && got.body === "hello there.txt" && f.buttons.includes("목록 비우기"), got);` },
  { js: `let def = null;
    DIALOG.showOpenDialog = async (w, o) => ({ canceled: true, filePaths: [] });
    await R.overlay.webContents.executeJavaScript("document.querySelector('.drawer [data-dir]').click(), 1"); await sleep(300);
    DIALOG.showSaveDialog = async (w, o) => { def = o.defaultPath; return { canceled: true }; };
    R.keys({ type: "keyDown", key: "s", control: true }); await sleep(400);
    const got = { kept: R.settings.downloadDir === PICKED, page: def && PATH.dirname(def) === PICKED, def };
    return CHECK("cancelling the picker keeps the folder; Ctrl+S offers it too", got.kept && got.page, got);` },
  { js: `FS.rmSync(PICKED, { recursive: true, force: true });
    const f = await FOOT(), d = await GET("back.txt");
    const got = { foot: f?.where, to: d && PATH.basename(PATH.dirname(d.path)), body: d && FS.existsSync(d.path) ? FS.readFileSync(d.path, "utf8") : null };
    SRV.closeAllConnections?.(); SRV.close();
    return CHECK("picked folder gone: back to the default, files still come down", got.foot === "받는 곳 downloads" && got.to === "downloads" && got.body === "hello back.txt", got);` },
];
