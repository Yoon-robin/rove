// node test/drive.mjs test/switch-tab.mjs: a page already open in a tab comes up in the address
// bar's suggestions as 탭으로 전환 (as in Chrome): picked, that tab comes to the front — no new
// load in the tab you typed in. Not the tab in front, tabs of other windows too (the same kind:
// a private window does not show the others' tabs). Needs the network (example.com).
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.u = (t) => "https://example.com/?" + t;
globalThis.TYPE = async (text) => {
  await R.win.webContents.executeJavaScript("(() => { const u = document.getElementById('url'); u.focus(); u.value = " + JSON.stringify(text) + "; u.dispatchEvent(new Event('input')); return 1; })()");
  await sleep(300); return R.overlayOn?.kind === "suggest" ? R.overlayOn.items : [];
};
globalThis.TABS = (items) => items.filter((i) => i.kind === "tab");
globalThis.Q = (t) => (t.view.webContents.getURL().split("?")[1] || "");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go(u("alpha")); await sleep(900); R.newTab(u("beta")); await sleep(900); R.newTab(u("gamma")); await sleep(900);
    globalThis.B = R.tabs[1]; const items = await TYPE("beta"); const got = items.map((i) => i.kind + ":" + (i.url.split("?")[1] || ""));
    return CHECK("an open tab: 탭으로 전환, once (not again as history)", TABS(items).length === 1 && TABS(items)[0].tab === B.id && got.filter((g) => g.endsWith(":beta")).length === 1, got);` },
  { js: `const items = await TYPE("gamma");
    return CHECK("not the tab in front", TABS(items).length === 0, items.map((i) => i.kind));` },
  { js: `const items = await TYPE("beta"); const i = items.findIndex((x) => x.kind === "tab"); const n = R.tabs.length, typedIn = R.active;
    await R.overlay.webContents.executeJavaScript("document.querySelector('[data-i=\\"" + i + "\\"]').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })), 1"); await sleep(600);
    const got = { front: Q(R.active), tabs: R.tabs.length, typedIn: Q(typedIn), overlay: R.overlayOn?.kind || null };
    return CHECK("clicked: that tab in front, the one typed in as it was", R.active === B && got.tabs === n && got.typedIn === "gamma" && !got.overlay, got);` },
  { js: `const items = await TYPE("alpha"); const i = items.findIndex((x) => x.kind === "tab"); const n = R.tabs.length;
    await R.win.webContents.executeJavaScript("(() => { const u = document.getElementById('url'); for (let k = 0; k < " + i + "; k++) u.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); document.getElementById('address').requestSubmit(); return 1; })()"); await sleep(600);
    const got = { front: Q(R.active), tabs: R.tabs.length, beta: Q(B) };
    return CHECK("Enter on it: that tab in front, nothing loaded", got.front === "alpha" && got.tabs === n && got.beta === "beta", got);` },
  { js: `R.createWindow({ urls: [u("delta")] }); await sleep(1500); const w1 = R.windows[1]; w1.win.minimize(); await sleep(400); R.use(R.windows[0]); await sleep(200);
    // Windows does not let a test in the background take the front: what was asked of the window is checked
    let asked = 0; const was = w1.win.focus.bind(w1.win); w1.win.focus = () => { asked++; return was(); };
    const items = await TYPE("delta"); const i = items.findIndex((x) => x.kind === "tab");
    if (i >= 0) await R.overlay.webContents.executeJavaScript("document.querySelector('[data-i=\\"" + i + "\\"]').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })), 1"); await sleep(600);
    const got = { found: i >= 0, front: Q(w1.active), asked, minimized: w1.win.isMinimized(), here: Q(R.windows[0].active || R.active) };
    w1.win.close(); await sleep(600); R.use(R.windows[0]);
    return CHECK("a tab of another window: found, that window in front with it", got.found && got.front === "delta" && got.asked === 1 && !got.minimized && got.here === "alpha", got);` },
  { js: `R.createWindow({ priv: true }); await sleep(1200); const pw = R.windows[R.windows.length - 1]; R.use(pw); await sleep(200);
    const items = await TYPE("beta"); pw.win.close(); await sleep(600); R.use(R.windows[0]);
    return CHECK("a private window: not the other windows' tabs", TABS(items).length === 0, items.map((i) => i.kind));` },
];
