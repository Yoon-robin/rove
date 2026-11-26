// node test/drive.mjs test/pass-sync.mjs: a login put in on the phone or the web vault comes to
// Rove without locking and unlocking — the RobinPass popup has 금고 다시 받기 (with when it was
// last fetched), and opening it after a while fetches the vault again first, as the Bitwarden
// extension does. The vault is a stand-in (no server): sync() counts its calls and adds a login.
// Prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const at = [{ uri: "https://example.com/", match: null }];
globalThis.ITEMS = [{ id: "a", name: "예전 로그인", username: "old", password: "x", totp: "", uris: at }];
globalThis.V = { calls: 0, at: Date.now(), fail: null };
Object.assign(R.pass, { status: () => ({ state: "open", email: "rove-sync@example.test", server: "https://pass.test" }), forPage: () => ITEMS, search: () => ITEMS,
  syncedAt: () => V.at,
  sync: async () => { V.calls++; await sleep(100); if (V.fail) throw new Error(V.fail); ITEMS.push({ id: "n" + V.calls, name: "폰에서 넣은 로그인 " + V.calls, username: "new", password: "y", totp: "", uris: at }); V.at = Date.now(); return ITEMS.length; } });
globalThis.OPEN = async () => { R.hideOverlay(); await sleep(200); R.showOverlay({ kind: "pass", x: 900, y: 84 }); await sleep(700); };
globalThis.POP = (js) => R.overlay.webContents.executeJavaScript(js);
globalThis.NAMES = () => POP("[...document.querySelectorAll('.pass .item b')].map((b) => b.textContent)");`;
export default [
  { js: H + `R.go("https://example.com/"); await sleep(1200); await OPEN();
    const b = await POP("(() => { const b = document.querySelector('.pass [data-sync]'); return b && { label: b.getAttribute('aria-label'), title: b.title }; })()");
    return CHECK("open vault: 금고 다시 받기 with the time it was fetched", !!b && /금고 다시 받기/.test(b.label) && /\\d{2}:\\d{2}/.test(b.label) && b.title === b.label && V.calls === 0, { b, calls: V.calls });` },
  { js: `await POP("document.querySelector('.pass [data-sync]').click(), 1"); await sleep(800); const names = await NAMES(); const msg = await POP("document.querySelector('.pass .msg')?.textContent || ''");
    return CHECK("pressed: the vault again, the new login listed", V.calls === 1 && names.includes("폰에서 넣은 로그인 1") && /다시 받았어요/.test(msg), { calls: V.calls, names, msg });` },
  { js: `V.fail = "서버에 닿지 않아요"; await POP("document.querySelector('.pass [data-sync]').click(), 1"); await sleep(800); V.fail = null;
    const m = await POP("(() => { const m = document.querySelector('.pass .msg'); return m && { text: m.textContent, alarm: m.classList.contains('alarm') }; })()");
    return CHECK("failed: said, as an alarm", m?.alarm && m.text.includes("서버에 닿지 않아요"), m);` },
  { js: `V.at = Date.now(); const before = V.calls; await OPEN();
    return CHECK("opened again soon after: not fetched again", V.calls === before, { before, after: V.calls });` },
  { js: `V.at = Date.now() - 10 * 60e3; const before = V.calls; await OPEN(); await sleep(500); const names = await NAMES();
    return CHECK("opened after a while: fetched first, the new login there", V.calls === before + 1 && names.some((n) => n === "폰에서 넣은 로그인 " + V.calls), { before, after: V.calls, names });` },
];
