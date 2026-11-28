// node test/drive.mjs test/extension-windows.mjs: an extension's chrome.windows.create({ type: "popup" })
// (a password manager's pop out, a wallet's confirm) opens a window of that size with its page only, as
// in Chrome and Brave — not a Rove window with tabs; chrome.tabs.remove and chrome.windows.remove close
// it; a plain chrome.windows.create is still a Rove window. A small extension made here: no network.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
Object.assign(globalThis, process.mainModule.require("electron"));
const fs = process.mainModule.require("node:fs"), path = process.mainModule.require("node:path"), os = process.mainModule.require("node:os");
globalThis.wc = () => R.active.view.webContents;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.UNTIL = async (f, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return Date.now() - t; await sleep(50); } return -1; };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rove-ext-win-"));
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "Windows test", version: "1.0", background: { service_worker: "bg.js" }, permissions: ["tabs"] }));
fs.writeFileSync(path.join(dir, "bg.js"), "");
for (const f of ["page", "pop"]) fs.writeFileSync(path.join(dir, f + ".html"), "<!doctype html><title>" + f + "</title><p>" + f + "</p>");
globalThis.EXT = await (session.fromPartition("persist:rove").extensions || session.fromPartition("persist:rove")).loadExtension(dir);
globalThis.POP = () => BrowserWindow.getAllWindows().find((b) => !b.isDestroyed() && b.webContents.getURL() === "chrome-extension://" + EXT.id + "/pop.html");
globalThis.ASK = (js) => wc().executeJavaScript(js + ".then((x) => x, (e) => 'ERR ' + e.message)");
await sleep(500);
await wc().loadURL("chrome-extension://" + EXT.id + "/page.html");`;
export default [
  { js: H + `const n = BrowserWindow.getAllWindows().length;
    const r = await ASK("chrome.windows.create({ url: 'pop.html', type: 'popup', width: 400, height: 500 }).then((w) => w.id)");
    await UNTIL(() => POP());
    const p = POP(), b = p?.getBounds();
    const got = { r, size: b && b.width + "x" + b.height, roveWindows: R.windows?.length ?? null, all: BrowserWindow.getAllWindows().length - n, id: p?.id, tab: !!R.tabOf?.(p?.webContents) };
    return CHECK("type popup: one window of 400x500 with the page, not a Rove window", !!p && got.size === "400x500" && r === p.id && got.all === 1, got);` },
  { js: `const id = await ASK("chrome.tabs.query({ windowId: " + POP().id + " }).then((t) => t.length && t[0].id)");
    const r = await ASK("chrome.tabs.remove(" + id + ").then(() => 'done')");
    const ms = await UNTIL(() => !POP());
    return CHECK("chrome.tabs.remove of its tab closes it", typeof id === "number" && ms >= 0, { id, r, ms });` },
  { js: `const wid = await ASK("chrome.windows.create({ url: 'pop.html', type: 'popup' }).then((w) => w.id)");
    await UNTIL(() => POP());
    const b = POP()?.getBounds();
    const r = await ASK("chrome.windows.remove(" + wid + ").then(() => 'done')");
    const ms = await UNTIL(() => !POP());
    return CHECK("no size: 520x680, chrome.windows.remove closes it", ms >= 0 && b?.width === 520 && b?.height === 680, { wid, r, ms, size: b && b.width + "x" + b.height });` },
  { js: `const before = BrowserWindow.getAllWindows().length;
    const wid = await ASK("chrome.windows.create({ url: 'pop.html' }).then((w) => w.id)");
    await sleep(1200);
    const p = POP();
    const got = { wid, more: BrowserWindow.getAllWindows().length - before, inRoveWindow: !!p && p.id === wid };
    const r = await ASK("chrome.windows.remove(" + wid + ").then(() => 'done')");
    const ms = await UNTIL(() => BrowserWindow.getAllWindows().length === before);
    return CHECK("a plain windows.create: a Rove window (the page in a tab), closed by windows.remove", !p && got.more >= 1 && ms >= 0, { ...got, r, ms });` },
];
