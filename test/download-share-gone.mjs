// node test/drive.mjs test/download-share-gone.mjs: a picked download folder and a finished file on a
// network share that is off (an address nothing answers — a look at it blocks ~20 s on Windows) must
// not freeze Rove: the state pushed on every change and opening the downloads drawer never wait on
// the disk; the drawer learns of it once the look comes back off the main thread. No network is used
// (10.255.255.1 is not routed). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SHARE = String.raw\`\\\\10.255.255.1\\rove-test\`;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
// the longest the main thread went without running a 10 ms timer while fn ran and for ms after
globalThis.STALL = async (fn, ms) => { let last = Date.now(), worst = 0;
  const t = setInterval(() => { const n = Date.now(); worst = Math.max(worst, n - last); last = n; }, 10);
  const r = await fn(); await sleep(ms); clearInterval(t); return { r, worst: Math.max(worst, Date.now() - last) }; };`;
export default [
  { js: H + `R.settings.downloadDir = SHARE;
    R.downloads.push({ id: 9e6, name: "far.zip", path: SHARE + String.raw\`\\far.zip\`, url: "https://example.com/far.zip", received: 5, total: 5, state: "completed", at: Date.now() });
    const s = await STALL(() => { R.snapshot(); R.showOverlay({ kind: "drawer", panel: "downloads" }); for (let i = 0; i < 20; i++) R.snapshot(); }, 1500);
    return CHECK("snapshot and opening the drawer do not wait on the gone share", s.worst < 500, { worstMs: s.worst });` },
  { js: `for (let i = 0; i < 40 && R.snapshot().downloadDir === SHARE; i++) await sleep(1000);
    const s = R.snapshot(), row = s.downloads.find((d) => d.id === 9e6);
    return CHECK("once the look comes back: 받는 곳 falls back, the file shows as gone", s.downloadDir !== SHARE && row?.gone === true, { dir: s.downloadDir, gone: row?.gone });` },
  { js: `const DIALOG = process.mainModule.require("electron").dialog, PATH = process.mainModule.require("node:path"); let def = null;
    DIALOG.showSaveDialog = async (w, o) => { def = o.defaultPath; return { canceled: true }; };
    const page = PATH.join(process.mainModule.require("node:os").tmpdir(), "rove-share-gone.html");
    process.mainModule.require("node:fs").writeFileSync(page, "<title>p</title>");
    await R.active.view.webContents.loadURL(process.mainModule.require("node:url").pathToFileURL(page).href).catch(() => {}); await sleep(300);
    R.keys({ type: "keyDown", key: "s", control: true }); await sleep(800);
    return CHECK("Ctrl+S with the share off: offers the default folder (no error)", !!def && PATH.dirname(def) === R.snapshot().downloadDir, { def });` },
];
