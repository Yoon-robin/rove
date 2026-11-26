// node test/drive.mjs test/mouse-back.mjs: the mouse's back and forward buttons (Windows sends the
// window an app command, browser-backward / browser-forward) go back and forward in the tab in
// front of that window, as in Chrome. The test sends the app command itself: a real mouse button is
// not pressed. Needs the network (example.com). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.u = (t) => "https://example.com/?" + t;
globalThis.CMD = (w, c) => w.win.emit("app-command", { preventDefault() {} }, c);
globalThis.AT = (t) => t.view.webContents.getURL();
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `const wc = R.active.view.webContents; await wc.loadURL(u("a")); await wc.loadURL(u("b")); await sleep(300); return AT(R.active);` },
  { js: `CMD(R.windows[0], "browser-backward"); await sleep(1000);
    return CHECK("back button: the page before", AT(R.active) === u("a"), AT(R.active));` },
  { js: `CMD(R.windows[0], "browser-forward"); await sleep(1000);
    return CHECK("forward button: the page after", AT(R.active) === u("b"), AT(R.active));` },
  // two windows: the button acts in the window it was pressed in, not the one last used
  { js: `R.createWindow({ urls: [u("x")] }); await sleep(1500); const w2 = R.windows[1]; await w2.tabs[0].view.webContents.loadURL(u("y")); await sleep(300);
    R.use(R.windows[0]); CMD(w2, "browser-backward"); await sleep(1000);
    const got = { second: AT(w2.tabs[0]), first: AT(R.windows[0].tabs[0]) };
    return CHECK("in its own window", got.second === u("x") && got.first === u("b"), got);` },
];
