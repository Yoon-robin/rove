// node test/drive.mjs test/private-memory.mjs: opening and closing private windows again and again
// does not pile up memory. Each private window gets a new session (Electron frees none), and each
// used to read the ad and tracker lists (lists.bin, 7 MB) into an engine of its own that stayed
// after the window closed: +7 MB of the main process's outside-the-heap memory per window.
// One engine serves every session now. No network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.EXT = () => process.memoryUsage().external / 1e6;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go("about:blank"); await sleep(800);
    R.createWindow({ priv: true }); await sleep(1200); R.windows[R.windows.length - 1].win.close(); await sleep(1000);
    const first = EXT();
    for (let i = 0; i < 4; i++) { R.createWindow({ priv: true }); await sleep(1200); R.windows[R.windows.length - 1].win.close(); await sleep(1000); }
    const grown = Math.round(EXT() - first);
    return CHECK("4 more private windows opened and closed: outside-the-heap memory grows under 8 MB (was 28)", grown < 8, { grownMB: grown, windows: R.windows.length });` },
];
