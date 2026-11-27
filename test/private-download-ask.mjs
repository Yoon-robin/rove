// node test/drive.mjs test/private-download-ask.mjs: a program downloaded in a private window is asked
// about (받을까요) in private windows only — a normal window's ask bar never shows its name — and when the
// last private window closes before an answer, it is not kept (no file, no row, no ask left), as Chrome
// cancels a private window's downloads with the last one. A normal window's program is still asked about
// in normal windows. A local server in Rove's main process sends the files — no network.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  const n = new URL(q.url, "http://x").searchParams.get("n") || "x";
  if (n === "page") { s.writeHead(200, { "content-type": "text/html" }); return s.end("<title>p</title>"); }
  s.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=" + n }); s.end("MZ hello");
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
globalThis.LOAD = async () => { const wc = R.active.view.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-stop-loading", r)); await wc.loadURL(BASE + "/?n=page").catch(() => {}); };
globalThis.GET = (n) => R.active.view.webContents.downloadURL(BASE + "/f?n=" + n);
globalThis.ASK = () => R.snapshot().ask?.name || null;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `await LOAD(); globalThis.NORMAL = R.cur;
    R.createWindow({ priv: true }); await sleep(1500); globalThis.PRIV = R.cur;
    await LOAD(); GET("secret.exe"); await sleep(1200);
    const got = { priv: ASK() }; R.use(NORMAL); got.normal = ASK();
    return CHECK("a private window's program is asked about in private windows only", got.priv === "secret.exe" && got.normal === null, got);` },
  { js: `globalThis.HELD = R.downloads.find((d) => d.private)?.held; PRIV.win.close(); await sleep(1500);
    R.use(NORMAL);
    const got = { ask: ASK(), asks: R.asks.filter((a) => a.kind === "download").length, rows: R.downloads.filter((d) => d.private).length, held: !!HELD && FS.existsSync(HELD) };
    return CHECK("the last private window closed unanswered: not kept, nothing left", got.ask === null && got.asks === 0 && got.rows === 0 && !got.held, got);` },
  { js: `R.use(NORMAL); GET("plain.exe"); await sleep(1200);
    return CHECK("a normal window's program is still asked about there", ASK() === "plain.exe", ASK());` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
