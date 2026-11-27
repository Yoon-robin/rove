// node test/drive.mjs test/awake.mjs: 창을 내려도 계속 (settings.awake). On a site with it on, the page
// stays seen and focused with the window down and its timers keep their speed (an online lecture's
// time goes on); off, the page is hidden. A popup the page opens by itself is let through there
// (its lecture player), unless the site's popups were set to 차단. Needs the network (example.com).
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.PAGE = (js) => R.active.view.webContents.executeJavaScript(js);
// how many 250 ms ticks the page counts in 2 s with the window down
globalThis.DOWN = async () => {
  await PAGE("window.ticks = 0, clearInterval(window.tk), window.tk = setInterval(() => window.ticks++, 250), 1");
  R.win.minimize(); await sleep(2000);
  const got = await PAGE("({ ticks: window.ticks, hidden: document.hidden, state: document.visibilityState, focus: document.hasFocus() })");
  R.win.restore(); await sleep(500); return got;
};
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go("https://example.com/"); await sleep(2500); const g = await DOWN();
    return CHECK("off: with the window down the page is hidden", g.hidden === true && g.state === "hidden", g);` },
  { js: `R.setAwake(true); await sleep(800); const g = await DOWN();
    return CHECK("on: seen, focused, ticks at full speed", R.settings.awake.includes("example.com") && g.hidden === false && g.state === "visible" && g.focus === true && g.ticks >= 6, g);` },
  { js: `const n = R.tabs.length; await PAGE("window.open('https://example.org/'), 1"); await sleep(1200);
    return CHECK("on: a popup with no press opens, nothing asked", R.tabs.length === n + 1 && !R.asks.some((a) => a.what[0] === "popups"), { tabs: R.tabs.length - n, asks: R.asks.length });` },
  { js: `R.select(R.tabs.find((t) => /example\\.com/.test(t.url))); await sleep(300); R.grants["https://example.com"] = { popups: false };
    const n = R.tabs.length; await PAGE("window.open('https://example.org/'), 1"); await sleep(1200); delete R.grants["https://example.com"];
    return CHECK("on, but popups set to 차단: still held", R.tabs.length === n, { tabs: R.tabs.length - n });` },
  { js: `R.setAwake(false); await sleep(500); return CHECK("off again", !R.settings.awake.includes("example.com") && !R.active.view.webContents.roveAwake, R.settings.awake);` },
];
