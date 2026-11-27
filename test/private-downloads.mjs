// node test/drive.mjs test/private-downloads.mjs: as in Chrome and Brave, a private window's downloads are
// listed only in private windows and a normal window's only in normal ones (the drawer and the toolbar
// button both read the window's snapshot); 목록 비우기 in one kind leaves the other's rows; and one still
// coming in when the last private window closes is in no list once it is done (the file stays).
// A local server in Rove's main process sends the files — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  const u = new URL(q.url, "http://x"), n = u.searchParams.get("n") || "x";
  if (n === "page") { s.writeHead(200, { "content-type": "text/html" }); return s.end("<title>p</title>"); }
  s.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=" + n });
  if (!u.searchParams.has("slow")) return s.end("hello " + n);
  s.write("first half "); setTimeout(() => s.end("second half"), 2500);
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
globalThis.LOAD = async () => { const wc = R.active.view.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-stop-loading", r)); await wc.loadURL(BASE + "/?n=page").catch(() => {}); };
globalThis.GET = (n, more = "") => R.active.view.webContents.downloadURL(BASE + "/f?n=" + n + more);
globalThis.NAMES = () => R.snapshot().downloads.map((d) => d.name).sort();
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `await LOAD(); GET("normal.txt"); await sleep(1000);
    globalThis.NORMAL = R.cur; R.createWindow({ priv: true }); await sleep(1500); globalThis.PRIV = R.cur;
    await LOAD(); GET("private.txt"); await sleep(1000);
    const got = { priv: NAMES() }; R.use(NORMAL); got.normal = NAMES();
    return CHECK("each kind of window lists only its own downloads", JSON.stringify(got) === '{"priv":["private.txt"],"normal":["normal.txt"]}', got);` },
  { js: `R.use(NORMAL); R.showOverlay({ kind: "drawer", panel: "downloads" }); await sleep(600);
    await R.overlay.webContents.executeJavaScript("document.querySelector('[data-clear]').click(), 1"); await sleep(400);
    const got = { normal: NAMES(), all: R.downloads.map((d) => d.name).sort() }; R.hideOverlay();
    return CHECK("목록 비우기 in a normal window leaves the private rows", JSON.stringify(got) === '{"normal":[],"all":["private.txt"]}', got);` },
  { js: `R.use(PRIV); GET("late.bin", "&slow"); await sleep(600); const d = R.downloads.find((x) => x.name === "late.bin");
    PRIV.win.close(); await sleep(4000);
    const got = { listed: R.downloads.filter((x) => x.private).map((x) => x.name), state: d.state, file: FS.existsSync(d.path) ? FS.readFileSync(d.path, "utf8") : null };
    return CHECK("one finishing after the last private window closed: in no list, the file kept", got.listed.length === 0 && got.state === "completed" && got.file === "first half second half", got);` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
