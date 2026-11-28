// node test/drive.mjs test/menu-scroll.mjs: ≡ in a short window scrolls; a state change while it is
// open (a download's progress, a page loading) redraws it and must not throw it back to the top —
// with a download going, its lower rows were out of reach. No network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.EV = (s) => R.overlay.webContents.executeJavaScript(s);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
R.win.setSize(800, 600); await sleep(800);
R.showOverlay({ kind: "menu" }); await sleep(900);`;
export default [
  { js: H + `const m = await EV("(() => { const m = document.querySelector('.pop.menu'); m.scrollTop = m.scrollHeight; return { top: m.scrollTop, sh: m.scrollHeight, ch: m.clientHeight }; })()");
    R.settings.sleep = !R.settings.sleep; R.setUpdater(() => null); await sleep(600);
    const after = await EV("document.querySelector('.pop.menu').scrollTop");
    return CHECK("a redraw keeps the scrolled menu where it was", m.top > 0 && after === m.top, { ...m, after });` },
  { js: `await EV("document.querySelector('.pop.menu').scrollTop = 0"); R.settings.sleep = !R.settings.sleep; R.setUpdater(() => null); await sleep(600);
    const got = await EV("({ top: document.querySelector('.pop.menu').scrollTop, focus: document.activeElement.dataset.do })");
    return CHECK("at the top it stays at the top, the first row keeps the keyboard", got.top === 0 && got.focus === "new", got);` },
];
