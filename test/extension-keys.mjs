// node test/drive.mjs test/extension-keys.mjs: an extension's keyboard shortcuts (manifest commands'
// suggested_key) work as in Chrome and Brave — its _execute_action key opens its toolbar popup, its
// other keys reach chrome.commands.onCommand with the tab, before the page; Rove's own keys stay
// Rove's. A small extension made here, a file:// page: no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { session, webContents } = process.mainModule.require("electron");
const fs = process.mainModule.require("node:fs"), path = process.mainModule.require("node:path"), os = process.mainModule.require("node:os");
globalThis.X = process.mainModule.require("./extensions.cjs");
globalThis.wc = () => R.active.view.webContents;
globalThis.PRESS = (key, mods) => { const w = wc(); w.focus(); for (const type of ["keyDown", "keyUp"]) w.sendInputEvent({ type, keyCode: key, modifiers: mods }); };
globalThis.UNTIL = async (f, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return Date.now() - t; await sleep(50); } return -1; };
globalThis.POPUPS = (id) => webContents.getAllWebContents().filter((w) => w.getURL().startsWith("chrome-extension://" + id + "/popup.html"));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rove-ext-keys-"));
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "Keys test", version: "1.0",
  background: { service_worker: "bg.js" }, action: { default_popup: "popup.html", default_title: "Keys test" }, permissions: ["tabs"],
  commands: { _execute_action: { suggested_key: { default: "Alt+Shift+P" } }, say: { suggested_key: { default: "Ctrl+Shift+U", mac: "Command+Shift+U" }, description: "say" },
    mine: { suggested_key: { default: "Ctrl+Shift+L" }, description: "Rove's own key" } } }));
fs.writeFileSync(path.join(dir, "bg.js"), "chrome.commands.onCommand.addListener((name, tab) => { if (tab) chrome.tabs.update(tab.id, { url: tab.url.split('#')[0] + '#got-' + name + '-' + tab.id }); });");
fs.writeFileSync(path.join(dir, "popup.html"), "<!doctype html><p>popup</p>");
fs.writeFileSync(path.join(dir, "page.html"), "<!doctype html><p>page</p><script>window.K = []; addEventListener('keydown', (e) => { if (e.ctrlKey || e.altKey) K.push(e.key); });</script>");
globalThis.PAGE = "file:///" + path.join(dir, "page.html").replace(/\\\\/g, "/");
globalThis.EXT = await (session.fromPartition("persist:rove").extensions || session.fromPartition("persist:rove")).loadExtension(dir);`;
export default [
  { js: H + `const k = (code, m = {}) => ({ type: "keyDown", code, control: !!m.c, alt: !!m.a, shift: !!m.s, meta: false });
    const got = [X.keyIs("Ctrl+Shift+Y", k("KeyY", { c: 1, s: 1 })), X.keyIs({ default: "Alt+Shift+D" }, k("KeyD", { a: 1, s: 1 })), X.keyIs({ windows: "Ctrl+Comma", default: "Alt+Q" }, k("Comma", { c: 1 })),
      X.keyIs("Ctrl+Shift+9", k("Digit9", { c: 1, s: 1 })), X.keyIs("Alt+Up", k("ArrowUp", { a: 1 })),
      X.keyIs("Ctrl+Shift+Y", k("KeyY", { c: 1 })), X.keyIs("Shift+Y", k("KeyY", { s: 1 })), X.keyIs("Command+Y", k("KeyY", { c: 1 })), X.keyIs(undefined, k("KeyY", { c: 1 })), X.keyIs("Ctrl+Y", k("KeyU", { c: 1 }))];
    return CHECK("which keys a suggested_key is", JSON.stringify(got) === "[true,true,true,true,true,false,false,false,false,false]", got);` },
  { js: `await wc().loadURL(PAGE); await sleep(800); return "page ready " + EXT.id + " " + wc().getURL().slice(-9);` },
  { js: `PRESS("U", ["control", "shift"]); const ms = await UNTIL(() => /#got-say-/.test(wc().getURL()));
    const got = { ms, url: wc().getURL().split("#")[1], tab: wc().id, saw: await wc().executeJavaScript("K") };
    return CHECK("Ctrl+Shift+U: chrome.commands.onCommand('say', tab), the page does not get it", ms >= 0 && got.url === "got-say-" + got.tab && !got.saw.includes("U") && !got.saw.includes("u"), got);` },
  { js: `const before = POPUPS(EXT.id).length; PRESS("P", ["alt", "shift"]); const ms = await UNTIL(() => POPUPS(EXT.id).length > before);
    const got = { ms, popups: POPUPS(EXT.id).length };
    return CHECK("Alt+Shift+P (_execute_action): the toolbar popup opens", ms >= 0, got);` },
  { js: `await wc().loadURL(PAGE); await sleep(500); PRESS("L", ["control", "shift"]); await sleep(1200);
    const got = { url: wc().getURL().split("#")[1] || "", overlay: R.overlayOn?.kind || null };
    return CHECK("Ctrl+Shift+L an extension also asks for: stays Rove's (RobinPass), not the extension's", !/got-mine/.test(got.url), got);` },
];
