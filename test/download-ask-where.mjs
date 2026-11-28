// node test/drive.mjs test/download-ask-where.mjs: 매번 묻기 in the downloads drawer (Chrome's and Brave's
// 다운로드 전에 각 파일의 저장 위치 확인) asks where each file goes; it comes down there, a cancelled
// dialog leaves nothing (not listed, no file), a program is still asked about, and a name picked over a
// file there replaces it (the dialog asked). The save dialog is stood in for (no window on screen);
// a local server sends the files — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs");
globalThis.PATH = process.mainModule.require("node:path");
globalThis.DIALOG = process.mainModule.require("electron").dialog;
globalThis.HOME = PATH.dirname(process.mainModule.require("electron").app.getPath("userData")); // userData is <home>/profile
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  const n = new URL(q.url, "http://x").searchParams.get("n") || "x";
  if (n === "page") { s.writeHead(200, { "content-type": "text/html" }); return s.end("<title>p</title>"); }
  s.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=" + n });
  s.end("hello " + n);
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
{ const wc = R.active.view.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-stop-loading", r)); await wc.loadURL(BASE + "/?n=page").catch(() => {}); }
globalThis.PICKED = FS.mkdtempSync(PATH.join(process.mainModule.require("node:os").tmpdir(), "rove-where-"));
globalThis.ASKED = [];
// the dialog answers after ms (a person picking), with a path in PICKED or cancelled
globalThis.ANSWER = (name, ms = 0) => { DIALOG.showSaveDialog = async (w, o) => { ASKED.push(o.defaultPath); await sleep(ms); return name ? { canceled: false, filePath: PATH.join(PICKED, name) } : { canceled: true, filePath: "" }; }; };
globalThis.GET = async (n, ms = 3000) => { R.active.view.webContents.downloadURL(BASE + "/f?n=" + n); await sleep(ms); };
globalThis.HELD = () => { try { return FS.readdirSync(PATH.join(HOME, "held")); } catch { return []; } };
globalThis.BODY = (p) => (FS.existsSync(p) ? FS.readFileSync(p, "utf8") : null);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.showOverlay({ kind: "drawer", panel: "downloads" }); await sleep(600);
    const off = await R.overlay.webContents.executeJavaScript("document.querySelector('.drawer [data-ask-where]')?.getAttribute('aria-checked')");
    await R.overlay.webContents.executeJavaScript("document.querySelector('.drawer [data-ask-where]').click(), 1"); await sleep(500);
    const on = await R.overlay.webContents.executeJavaScript("document.querySelector('.drawer [data-ask-where]')?.getAttribute('aria-checked')");
    const got = { off, on, saved: R.settings.askWhere };
    return CHECK("매번 묻기: off at first, the switch turns it on and keeps it", off === "false" && on === "true" && got.saved === true, got);` },
  { js: `ANSWER("picked.txt", 1500); await GET("a.txt", 2500);
    const d = R.downloads.find((x) => x.name === "picked.txt");
    const got = { asked: ASKED.at(-1), state: d?.state, path: d && d.path === PATH.join(PICKED, "picked.txt"), body: BODY(PATH.join(PICKED, "picked.txt")), def: BODY(PATH.join(HOME, "downloads", "a.txt")), held: HELD() };
    return CHECK("asked where (the received folder offered), comes down there under the picked name", got.asked === PATH.join(HOME, "downloads", "a.txt") && got.state === "completed" && got.path && got.body === "hello a.txt" && got.def === null && got.held.length === 0, got);` },
  { js: `ANSWER(null, 300); const before = R.downloads.length; await GET("no.txt", 1500);
    const got = { listed: R.downloads.some((x) => x.name === "no.txt"), count: R.downloads.length - before, def: BODY(PATH.join(HOME, "downloads", "no.txt")), held: HELD() };
    return CHECK("dialog cancelled: not listed, no file anywhere", !got.listed && got.count === 0 && got.def === null && got.held.length === 0, got);` },
  { js: `FS.writeFileSync(PATH.join(PICKED, "old.txt"), "old"); ANSWER("old.txt"); await GET("b.txt", 1500);
    const got = { body: BODY(PATH.join(PICKED, "old.txt")), other: FS.readdirSync(PICKED).sort() };
    return CHECK("picked over a file there: it is replaced (the dialog asked), not old (1).txt", got.body === "hello b.txt" && !got.other.includes("old (1).txt"), got);` },
  { js: `ANSWER("tool.exe"); await GET("setup.exe", 1500);
    const d = R.downloads.find((x) => x.name === "tool.exe"), ask = R.asks.find((a) => a.d === d);
    const waits = { asking: !!d?.asking, ask: !!ask, file: BODY(PATH.join(PICKED, "tool.exe")) };
    if (ask) R.answer(ask.id, true); await sleep(500); // the ask bar's 받기
    const got = { waits, state: d?.state, body: BODY(PATH.join(PICKED, "tool.exe")), held: HELD() };
    return CHECK("a program: still asked about after the dialog, 받기 puts it where picked", waits.asking && waits.ask && waits.file === null && got.state === "completed" && got.body === "hello setup.exe" && got.held.length === 0, got);` },
  { js: `await R.overlay.webContents.executeJavaScript("document.querySelector('.drawer [data-ask-where]').click(), 1"); await sleep(400);
    DIALOG.showSaveDialog = async () => { throw new Error("asked when off"); };
    await GET("c.txt", 1500); const d = R.downloads.find((x) => x.name === "c.txt");
    SRV.closeAllConnections?.(); SRV.close(); FS.rmSync(PICKED, { recursive: true, force: true });
    return CHECK("switched off again: straight to the folder, no dialog", R.settings.askWhere === false && d?.state === "completed" && PATH.basename(PATH.dirname(d.path)) === "downloads", { askWhere: R.settings.askWhere, state: d?.state, path: d?.path });` },
];
