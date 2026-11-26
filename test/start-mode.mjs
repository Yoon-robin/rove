// node test/drive.mjs test/start-mode.mjs: how Rove starts, as Chrome's 시작 시 — ≡ 지난 탭으로 시작 (on: the last
// run's tabs, as before), off: one home tab, and Ctrl+Shift+T brings the last run's window back. The choice is
// kept in settings.json. The start itself is startWindows (what boot calls) given a last run. A local server, no network.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.FS = process.mainModule.require("node:fs"); globalThis.PATH = process.mainModule.require("node:path");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>" + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.A = "http://127.0.0.1:" + SRV.address().port;
globalThis.LAST = [{ urls: [A + "/one", A + "/two"], titles: ["one", "two"], active: 1 }];
globalThis.MENU = (js) => R.overlay.webContents.executeJavaScript(js);
globalThis.SAVED = () => { try { return JSON.parse(FS.readFileSync(PATH.join(process.env.ROVE_HOME, "settings.json"), "utf8")).start; } catch { return null; } };`;
export default [
  { js: H + `R.showOverlay({ kind: "menu" }); await sleep(600);
    const before = await MENU("document.querySelector('[data-start]').getAttribute('aria-checked')");
    await MENU("document.querySelector('[data-start]').click()"); await sleep(500);
    const after = await MENU("document.querySelector('[data-start]').getAttribute('aria-checked')"); R.hideOverlay(); await sleep(1200);
    const got = { before, after, setting: R.settings.start, saved: SAVED() };
    return CHECK("≡ 지난 탭으로 시작: on at first, off when pressed, kept", before === "true" && after === "false" && got.setting === "home" && got.saved === "home", got);` },
  { js: `const n = R.windows.length; R.startWindows(LAST); await sleep(1000); const w = R.windows[R.windows.length - 1];
    const got = { windows: R.windows.length - n, tabs: w.tabs.map((t) => t.url), top: R.closed[R.closed.length - 1]?.urls };
    return CHECK("off: one home tab, the last run's window is the newest closed thing", got.windows === 1 && got.tabs.length === 1 && !got.tabs[0].startsWith(A) && got.top?.length === 2, got);` },
  { js: `const n = R.windows.length; R.use(R.windows[R.windows.length - 1]); R.keys({ type: "keyDown", key: "T", control: true, shift: true, alt: false, meta: false }); await sleep(1200);
    const w = R.windows[R.windows.length - 1], got = { windows: R.windows.length - n, tabs: w.tabs.map((t) => t.title) };
    return CHECK("Ctrl+Shift+T brings it back", got.windows === 1 && got.tabs.join() === "one,two", got);` },
  { js: `R.settings.start = "last"; const n = R.windows.length; R.startWindows(LAST); await sleep(1000); const w = R.windows[R.windows.length - 1];
    const got = { windows: R.windows.length - n, tabs: w.tabs.map((t) => t.url.replace(A, "")) };
    SRV.closeAllConnections?.(); SRV.close();
    return CHECK("on: the last run's tabs, as before", got.windows === 1 && got.tabs.join() === "/one,/two", got);` },
];
