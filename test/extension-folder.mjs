// node test/drive.mjs test/extension-folder.mjs: an unpacked extension can be loaded from a folder, as
// Brave's and Chrome's 개발자 모드 · 압축해제된 확장 프로그램 로드 — the extensions drawer's 폴더에서
// 불러오기 picks the folder, it is in the pages and the list (폴더 · its version), loaded again at the
// next start, can be turned off, and 지우기 takes it out of Rove but leaves the folder on disk. Not a
// folder with a manifest, or one already loaded: said in the drawer. The folder dialog is stood in for
// (no window on screen); a page on 127.0.0.1 — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { session, dialog } = process.mainModule.require("electron");
globalThis.fs = process.mainModule.require("node:fs"); globalThis.path = process.mainModule.require("node:path");
globalThis.X = process.mainModule.require("./extensions.cjs");
globalThis.SES = session.fromPartition("persist:rove");
globalThis.SX = SES.extensions || SES;
globalThis.wc = () => R.active.view.webContents;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const tmp = fs.mkdtempSync(path.join(process.mainModule.require("node:os").tmpdir(), "rove-unpacked-"));
globalThis.FOLDER = path.join(tmp, "my-ext");
globalThis.EMPTY = path.join(tmp, "not-an-ext");
fs.mkdirSync(FOLDER); fs.mkdirSync(EMPTY);
fs.writeFileSync(path.join(FOLDER, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "Folder test", version: "0.3",
  content_scripts: [{ matches: ["http://127.0.0.1/*"], js: ["mark.js"], run_at: "document_start" }] }));
fs.writeFileSync(path.join(FOLDER, "mark.js"), "document.documentElement.dataset.ext = 'folder';");
const srv = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>here</title><p>page"); });
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
globalThis.PAGE = "http://127.0.0.1:" + srv.address().port + "/";
globalThis.MARK = async () => { await wc().loadURL(PAGE); await sleep(300); return wc().executeJavaScript("document.documentElement.dataset.ext || ''"); };
globalThis.PICK = (p) => { dialog.showOpenDialog = async () => (p ? { canceled: false, filePaths: [p] } : { canceled: true, filePaths: [] }); };
globalThis.OV = (js) => R.overlay.webContents.executeJavaScript(js);
globalThis.PRESS = async () => {
  R.showOverlay({ kind: "drawer", panel: "extensions" }); await sleep(600);
  await OV("document.querySelector('.drawer [data-ext-folder]').click(), 1"); await sleep(900);
  return OV("(() => ({ say: document.querySelector('.drawer footer [role=status]')?.textContent || null, focus: document.activeElement?.matches('[data-ext-folder]') || false, rows: [...document.querySelectorAll('.drawer .item')].map((i) => i.querySelector('b').textContent + ' ' + i.querySelector('small').textContent) }))()");
};
globalThis.ROW = () => R.exts.list().find((x) => x.name === "Folder test") || null;`;
export default [
  { js: H + `PICK(FOLDER); const d = await PRESS(); const row = ROW();
    const got = { d, row: row && { on: row.on, folder: row.folder }, mark: await MARK(), saved: R.settings.extFolders };
    R.hideOverlay();
    return CHECK("폴더에서 불러오기: said, in the list as 폴더 · 0.3, in the page, kept in settings", d.say === "Folder test 불러왔어요" && d.focus && d.rows.includes("Folder test 폴더 · 0.3") && got.row?.on && got.row.folder && got.mark === "folder" && JSON.stringify(got.saved) === JSON.stringify([FOLDER]), got);` },
  { js: `PICK(FOLDER); const again = (await PRESS()).say; PICK(EMPTY); const empty = (await PRESS()).say; PICK(null); const none = await PRESS();
    R.hideOverlay();
    const got = { again, empty, none: none.say, saved: R.settings.extFolders, rows: none.rows };
    return CHECK("the same folder again, a folder without manifest.json: said, nothing added; canceled: nothing said", again === "이미 불러온 폴더예요" && empty === "이 폴더에는 manifest.json이 없어요" && got.none === null && got.saved.length === 1 && none.rows.filter((r) => r.startsWith("Folder test")).length === 1, got);` },
  { js: `R.win.setSize(800, 600); await sleep(500); PICK(EMPTY); await PRESS();
    // the note's lines by the top of each letter: a wrap breaks between words, not inside one
    const lines = await OV("(() => { const t = document.querySelector('.drawer footer [role=status]').firstChild, r = document.createRange(), by = new Map(); for (let i = 0; i < t.length; i++) { r.setStart(t, i); r.setEnd(t, i + 1); const y = Math.round(r.getBoundingClientRect().top); by.set(y, (by.get(y) || '') + t.data[i]); } return [...by.values()].map((s) => s.trim()); })()");
    R.hideOverlay(); R.win.setSize(1280, 800); await sleep(300);
    const words = "이 폴더에는 manifest.json이 없어요".split(" ");
    return CHECK("800 wide: the note wraps between words (no lone 요 on its own line)", lines.length > 1 && lines.every((l) => l.split(" ").every((w) => words.includes(w))), lines);` },
  { js: `const id = ROW().id; SX.removeExtension(id); await sleep(200); const gone = await MARK();
    await X.loadFolders(SES, R.settings.extFolders, {}, () => {}); const got = { gone, loaded: !!SX.getExtension(id), mark: await MARK() };
    return CHECK("the next start's loader loads it again from the folder", got.gone === "" && got.loaded && got.mark === "folder", got);` },
  { js: `const id = ROW().id; await R.exts.setOn(id, false); await sleep(200); SX.getExtension(id) && SX.removeExtension(id);
    await X.loadFolders(SES, R.settings.extFolders, R.settings.extOff, () => {}); const off = { loaded: !!SX.getExtension(id), row: ROW() && { on: ROW().on, folder: ROW().folder } };
    await R.exts.setOn(id, true); const got = { off, mark: await MARK(), offSaved: Object.keys(R.settings.extOff || {}) };
    return CHECK("turned off: the loader leaves it out, still listed as a folder one; on again: back in the page", !off.loaded && off.row?.on === false && off.row.folder && got.mark === "folder" && !got.offSaved.includes(id), got);` },
  { js: `const id = ROW().id; const done = await R.exts.remove(id); await sleep(200);
    const got = { done, row: ROW(), saved: R.settings.extFolders, mark: await MARK(), folder: fs.existsSync(path.join(FOLDER, "manifest.json")) };
    return CHECK("지우기: out of Rove, the list and settings; the folder stays on disk", done && !got.row && got.saved.length === 0 && got.mark === "" && got.folder, got);` },
];
