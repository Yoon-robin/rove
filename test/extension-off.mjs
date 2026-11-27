// node test/drive.mjs test/extension-off.mjs: an extension can be turned off without removing it and
// on again, as the switch on Brave's and Chrome's extensions page — off, it is in no page and stays
// off at the next start (the start's loader skips it), but it is still in the drawer's list with its
// switch; on, it is back from the same folder. A small store-style extension (a key in its
// manifest) put in this run's Extensions folder, a page on 127.0.0.1: no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { session } = process.mainModule.require("electron");
globalThis.fs = process.mainModule.require("node:fs"); globalThis.path = process.mainModule.require("node:path"); const crypto = process.mainModule.require("node:crypto");
globalThis.X = process.mainModule.require("./extensions.cjs");
globalThis.SES = session.fromPartition("persist:rove");
globalThis.SX = SES.extensions || SES;
globalThis.wc = () => R.active.view.webContents;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const der = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "der" });
globalThis.ID = [...crypto.createHash("sha256").update(der).digest("hex").slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
globalThis.DIR = path.join(process.env.ROVE_HOME, "Extensions");
const v = path.join(DIR, ID, "1.0_0");
fs.mkdirSync(v, { recursive: true });
fs.writeFileSync(path.join(v, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "Off test", version: "1.0", key: der.toString("base64"),
  content_scripts: [{ matches: ["http://127.0.0.1/*"], js: ["mark.js"], run_at: "document_start" }] }));
fs.writeFileSync(path.join(v, "mark.js"), "document.documentElement.dataset.ext = 'on';");
const srv = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>here</title><p>page"); });
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
globalThis.PAGE = "http://127.0.0.1:" + srv.address().port + "/";
globalThis.MARK = async () => { await wc().loadURL(PAGE); await sleep(300); return wc().executeJavaScript("document.documentElement.dataset.ext || ''"); };
globalThis.ROW = () => (R.exts.list().find((x) => x.id === ID) || null);
globalThis.OV = (js) => R.overlay.webContents.executeJavaScript(js);`;
export default [
  { js: H + `await X.loadInstalled(SES, DIR, {}); const got = { loaded: !!SX.getExtension(ID), mark: await MARK(), row: ROW() && { on: ROW().on, name: ROW().name } };
    return CHECK("installed and on: loaded at start, in the page, on in the list", got.loaded && got.mark === "on" && got.row?.on === true && got.row.name === "Off test", got);` },
  { js: `const done = await R.exts.setOn(ID, false); await sleep(300);
    const got = { done, loaded: !!SX.getExtension(ID), mark: await MARK(), row: ROW() && { on: ROW().on, name: ROW().name, version: ROW().version }, saved: Object.keys(R.settings.extOff || {}), folder: fs.existsSync(path.join(DIR, ID)) };
    return CHECK("turned off: in no page, still listed (off) with its name, kept in settings, folder kept", done && !got.loaded && got.mark === "" && got.row?.on === false && got.row.name === "Off test" && got.saved.includes(ID) && got.folder, got);` },
  { js: `await X.loadInstalled(SES, DIR, R.settings.extOff); const got = { loaded: !!SX.getExtension(ID), mark: await MARK() };
    return CHECK("the next start's loader leaves the one turned off out", !got.loaded && got.mark === "", got);` },
  { js: `R.showOverlay({ kind: "drawer", panel: "extensions" }); await sleep(700);
    const before = await OV("(() => { const b = document.querySelector('[data-ext-on=\\"" + ID + "\\"]'); return b ? [b.getAttribute('aria-checked'), b.getAttribute('aria-label'), b.closest('.item').className] : null; })()");
    await OV("document.querySelector('[data-ext-on=\\"" + ID + "\\"]').click()"); await sleep(900);
    const after = await OV("(() => { const b = document.querySelector('[data-ext-on=\\"" + ID + "\\"]'); return b ? [b.getAttribute('aria-checked'), document.activeElement === b] : null; })()");
    R.hideOverlay();
    const got = { before, after, loaded: !!SX.getExtension(ID), mark: await MARK(), saved: Object.keys(R.settings.extOff || {}) };
    return CHECK("the drawer's switch turns it on again: back in the page, out of settings, focus stays on the switch", before?.[0] === "false" && before[1] === "Off test 켜기" && / off/.test(before[2]) && after?.[0] === "true" && after[1] && got.loaded && got.mark === "on" && !got.saved.includes(ID), got);` },
  { js: `await R.exts.setOn(ID, false); const done = await R.exts.remove(ID); await sleep(300);
    const got = { done, row: ROW(), saved: Object.keys(R.settings.extOff || {}), folder: fs.existsSync(path.join(DIR, ID)) };
    return CHECK("removing one turned off: gone from the list, settings and disk", done && !got.row && !got.saved.includes(ID) && !got.folder, got);` },
];
