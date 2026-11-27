// node test/drive.mjs test/update-check.mjs: ≡ has "업데이트 확인" beside the version (as Brave's About page checks
// when opened), which checks now and says what it found: checking, up to date, or that it failed (the reason on
// hover). A ready one shows "다시 켜서 새 버전으로" instead. A menu redraw keeps the keyboard where it was.
// The updater is a fake (R.setUpdater): no install, no network.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.MENU = () => R.overlay.webContents.executeJavaScript("(() => { const f = document.querySelector('.pop.menu .fact'), b = f?.querySelector('[data-do=update-check]'); return { text: f?.textContent.replace(b?.textContent || '', '').trim(), button: !!b, busy: b?.getAttribute('aria-disabled') === 'true', title: f?.querySelector('.alarm')?.title || '', relaunch: !!document.querySelector('[data-do=relaunch]'), focused: document.activeElement?.dataset.do || '' }; })()");`;
export default [
  { js: H + `R.showOverlay({ kind: "menu" }); await sleep(600); const m = await MENU();
    return CHECK("not an installed Rove: no button", !m.button && m.text === "Rove " + R.snapshot().version, m);` },
  // the fake: each check takes 0.4 s, then gives what NEXT says
  { js: `globalThis.CALLS = 0; globalThis.NEXT = {};
    R.setUpdater((tell) => { let s = { version: "1.0.0", ready: null, checking: false, downloading: null, checkedAt: 0, error: null };
      const set = (c) => { s = { ...s, ...c }; tell(s); };
      return (globalThis.FAKE = { state: () => s, exe: () => "", set, async check() { if (s.checking) return s; CALLS++; set({ checking: true, error: null }); await sleep(400); set({ checking: false, checkedAt: Date.now(), ...NEXT }); return s; } }); });
    await sleep(300); const m = await MENU();
    return CHECK("installed, not checked yet: button, no word", m.button && !m.busy && !/·/.test(m.text), m);` },
  { js: `await R.overlay.webContents.executeJavaScript("(() => { const b = document.querySelector('[data-do=update-check]'); b.focus(); b.click(); })()");
    await sleep(150); const during = await MENU(); await R.overlay.webContents.executeJavaScript("document.querySelector('[data-do=update-check]').click()");
    await sleep(600); const after = await MENU();
    return CHECK("checks now, says so, a second press while checking does nothing, then up to date",
      CALLS === 1 && during.text.endsWith("확인하는 중") && during.busy && during.focused === "update-check" && after.text.endsWith("최신 버전이에요") && after.focused === "update-check", { CALLS, during, after });` },
  { js: `NEXT = { error: "업데이트 주소에 닿지 않아요(fetch failed)" };
    await R.overlay.webContents.executeJavaScript("document.querySelector('[data-do=update-check]').click()"); await sleep(700); const m = await MENU();
    return CHECK("a failed check says so, the reason on hover, and can be tried again", CALLS === 2 && m.text.endsWith("확인하지 못했어요") && m.title.includes("닿지 않아요") && m.button, m);` },
  // a redraw (any state change, here the updater's) leaves the keyboard on the row it was on, not "새 탭"
  { js: `await R.overlay.webContents.executeJavaScript("document.querySelector('[data-do=history]').focus()");
    for (let k = 0; k < 3; k++) { FAKE.set({ checkedAt: Date.now() }); await sleep(100); } const m = await MENU();
    return CHECK("a redraw keeps the focused row", m.focused === "history", m);` },
  { js: `NEXT = { ready: "9.9.9" };
    await R.overlay.webContents.executeJavaScript("document.querySelector('[data-do=update-check]').click()"); await sleep(700); const m = await MENU();
    return CHECK("found one: relaunch row, no button", m.relaunch && !m.button && m.text === "Rove " + R.snapshot().version, m);` },
];
