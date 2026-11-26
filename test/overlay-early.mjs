// node test/drive.mjs test/overlay-early.mjs: a key that opens a pop-over (탭 찾기) pressed the
// moment a window opens, before its pop-over page has loaded, still shows it (and a test's first
// step is not run before the pop-over page is ready). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `return CHECK("the first step runs with the pop-over page loaded", !R.overlay.webContents.isLoading(), R.overlay.webContents.isLoading());` },
  { js: `R.createWindow(); const w = R.windows[R.windows.length - 1]; const loading = w.overlay.webContents.isLoading();
    R.showOverlay({ kind: "tabs", keyed: true }); await sleep(1500);
    const rows = await w.overlay.webContents.executeJavaScript("document.querySelectorAll('#tl .item').length");
    const got = { loading, rows, on: R.overlayOn?.kind }; R.hideOverlay(); w.win.close(); await sleep(500);
    return CHECK("탭 찾기 the moment a window opens: shown", got.loading && got.rows >= 1 && got.on === "tabs", got);` },
];
