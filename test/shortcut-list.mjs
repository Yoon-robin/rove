// node test/drive.mjs test/shortcut-list.mjs: ≡ 단축키 shows Rove's shortcuts in one list — every one shown is one
// Rove really has (keyAction, not run), the rows are not cut, the list fits a small window (it scrolls inside),
// and Esc closes it. No network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.O = (js) => R.overlay.webContents.executeJavaScript(js);`;
export default [
  { js: H + `R.win.setContentSize(1000, 760); R.showOverlay({ kind: "menu" }); await sleep(600);
    await O("document.querySelector('[data-do=keys]').click()"); await sleep(600);
    globalThis.ROWS = await O("[...document.querySelectorAll('.pop.keys .keyrow')].map((r) => ({ name: r.firstElementChild.textContent, key: r.querySelector('kbd').textContent, fits: r.scrollWidth <= r.clientWidth }))");
    const got = { kind: R.overlayOn?.kind, rows: ROWS.length, groups: await O("document.querySelectorAll('.pop.keys .rk-label').length") };
    return CHECK("≡ 단축키 opens the list", got.kind === "keys" && got.rows >= 30 && got.groups === 3, got);` },
  { js: `const ARROW = { "←": "ArrowLeft", "→": "ArrowRight" };
    const bad = ROWS.filter((r) => { const parts = r.key.replace("~8", "").split("+"), last = parts.pop(), k = ARROW[last] || (last.length === 1 ? last.toLowerCase() : last);
      return !R.keyAction({ type: "keyDown", key: k, control: parts.includes("Ctrl"), shift: parts.includes("Shift"), alt: parts.includes("Alt"), meta: false }); });
    return CHECK("every shortcut shown is one Rove has", bad.length === 0, bad);` },
  { js: `const cut = ROWS.filter((r) => !r.fits);
    R.win.setContentSize(480, 320); await sleep(300); R.showOverlay({ kind: "keys" }); await sleep(600);
    const box = await O("(() => { const p = document.querySelector('.pop.keys').getBoundingClientRect(); return { bottom: Math.round(p.bottom), h: innerHeight, scrolls: document.querySelector('.pop.keys').scrollHeight > document.querySelector('.pop.keys').clientHeight }; })()");
    return CHECK("rows not cut; in 480x320 it fits and scrolls inside", cut.length === 0 && box.bottom <= box.h && box.scrolls, { cut, box });` },
  { js: `R.overlay.webContents.focus(); R.overlay.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" }); await sleep(500);
    return CHECK("Esc closes it", !R.overlayOn, R.overlayOn?.kind || null);` },
];
