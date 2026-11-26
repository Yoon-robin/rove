// node test/drive.mjs test/address-host.mjs: the address bar, not typed in, shows the site's
// name brighter than the scheme and path (drawn by #shown over the input's then clear words);
// typing in it shows the input itself. Uses the network (example.com). Each line prints ok or FAIL.
// The hidden test window has no focus, so focus, blur and Esc are dispatched on the input by hand
// (the first Esc closes the suggestions, the second leaves the bar).
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.BAR = () => R.win.webContents.executeJavaScript(\`(() => {
  const a = document.getElementById("address"), u = document.getElementById("url"), s = document.getElementById("shown");
  const cu = getComputedStyle(u), cs = getComputedStyle(s);
  return { showing: a.classList.contains("showing"), host: s.querySelector("b")?.textContent || "", words: s.textContent, value: u.value,
    inputColor: cu.color, sameFont: cu.font === cs.font && cu.fontSize === cs.fontSize, dx: Math.round(s.getBoundingClientRect().left - u.getBoundingClientRect().left),
    sameText: s.textContent === u.value, hostColor: s.querySelector("b") ? getComputedStyle(s.querySelector("b")).color : "", restColor: cs.color };
})()\`);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.win.setContentSize(1000, 600); R.go("https://example.com/"); await sleep(4000); return "ready";` },
  { js: `const b = await BAR(); return CHECK("not typed in: host bright, the rest quiet", b.showing && b.host === "example.com" && b.sameText && b.hostColor !== b.restColor && b.inputColor === "rgba(0, 0, 0, 0)", b);` },
  { js: `const b = await BAR(); return CHECK("drawn where the input's words are", b.dx === 0 && b.sameFont, b);` },
  { js: `await R.win.webContents.executeJavaScript("(() => { const u = document.getElementById('url'); u.focus(); u.dispatchEvent(new FocusEvent('focus')); })()"); await sleep(300);
    const b = await BAR(); return CHECK("typing: the input shows its own words", !b.showing && b.inputColor !== "rgba(0, 0, 0, 0)", b);` },
  { js: `await R.win.webContents.executeJavaScript("(() => { const u = document.getElementById('url'); u.value = 'https://other.example/'; u.dispatchEvent(new Event('input')); })()"); await sleep(200);
    const b = await BAR(); return CHECK("typed words are not covered", !b.showing, b);` },
  { js: `await R.win.webContents.executeJavaScript("(() => { const u = document.getElementById('url'); for (let i = 0; i < 2; i++) u.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); u.blur(); u.dispatchEvent(new FocusEvent('blur')); })()"); await sleep(400);
    const b = await BAR(); return CHECK("Esc: back to the site, host bright again", b.showing && b.host === "example.com" && b.value === "https://example.com/", b);` },
  // Windows high contrast: one colour for all words, so the input shows the address and nothing covers it
  { js: `const wc = R.win.webContents; try { wc.debugger.attach("1.3"); } catch { /* attached */ }
    const fc = (v) => wc.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: v }] });
    await fc("active"); await sleep(300);
    const r = await wc.executeJavaScript("(() => ({ shown: getComputedStyle(document.getElementById('shown')).display, input: getComputedStyle(document.getElementById('url')).color }))()");
    await fc("none"); await sleep(200);
    return CHECK("high contrast: the input's own words", r.shown === "none" && r.input !== "rgba(0, 0, 0, 0)", r);` },
  { js: `R.go("file:///C:/Windows/win.ini"); await sleep(1200); const b = await BAR(); return CHECK("not http(s): nothing drawn over", !b.showing && b.words === "" && b.value.startsWith("file:"), b);` },
];
