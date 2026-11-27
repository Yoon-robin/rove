// node test/drive.mjs test/menu-shortcuts.mjs: the ≡ menu shows each row's shortcut on its right (as Chrome's),
// every shortcut shown is one Rove really has (keyAction, not run), and the rows still fit the menu. No network.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.win.setContentSize(1000, 760); R.showOverlay({ kind: "menu" }); await sleep(700);
    globalThis.ROWS = await R.overlay.webContents.executeJavaScript("(() => { const m = document.querySelector('.pop.menu'), sw = m.querySelector('.rk-switch').getBoundingClientRect().right; return [...m.querySelectorAll('.rk-menu__item')].map((b) => { const k = b.querySelector('.key'); return { name: b.textContent.replace(k?.textContent || '', '').trim(), key: k?.textContent || '', right: k ? Math.round(sw - k.getBoundingClientRect().right) : null, fits: b.scrollWidth <= b.clientWidth }; }); })()");
    const want = ["새 탭", "새 창", "새 비공개 창", "방문 기록", "즐겨찾기", "내려받기", "탭 찾기", "페이지에서 찾기", "인쇄", "페이지 저장", "개발자 도구"];
    const keyed = ROWS.filter((r) => r.key).map((r) => r.name);
    return CHECK("rows with a shortcut", JSON.stringify(keyed) === JSON.stringify(want), ROWS.map((r) => r.name + (r.key ? " " + r.key : "")));` },
  { js: `const bad = ROWS.filter((r) => r.key).filter((r) => { const parts = r.key.split("+"), k = parts.pop();
      return !R.keyAction({ type: "keyDown", key: k.length === 1 ? k.toLowerCase() : k, control: parts.includes("Ctrl"), shift: parts.includes("Shift"), alt: false, meta: false }); });
    return CHECK("every shortcut shown is one Rove has", bad.length === 0, bad);` },
  { js: `const off = ROWS.filter((r) => !r.fits || (r.key && Math.abs(r.right) > 1));
    return CHECK("shortcuts end on the switches' right edge, nothing cut", off.length === 0, off.length ? off : ROWS.filter((r) => r.key).map((r) => r.right));` },
  // full screen is the zoom row's last button (as Chrome's and Brave's), not a row of its own; its icon ends on the
  // switches' right edge and its label says F11 (not pressed: full screen would show the hidden test window)
  { js: `const z = await R.overlay.webContents.executeJavaScript("(() => { const m = document.querySelector('.pop.menu'), sw = m.querySelector('.rk-switch').getBoundingClientRect().right, f = m.querySelector('.zoomrow [data-do=full]'), r = f?.querySelector('svg').getBoundingClientRect(); return f && { label: f.getAttribute('aria-label'), last: f === f.parentElement.lastElementChild, right: Math.round(sw - r.right), rows: m.querySelectorAll('.rk-menu__item[data-do=full]').length }; })()");
    return CHECK("full screen sits at the zoom row's end", z && z.label.includes("F11") && z.last && Math.abs(z.right) <= 1 && z.rows === 0, z);` },
];
