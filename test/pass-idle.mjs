// node test/drive.mjs test/pass-idle.mjs: RobinPass locks itself when the PC is left alone for
// 15 minutes (Bitwarden's vault timeout), not only with the screen lock — someone who walks away
// with the vault open does not leave it open to whoever sits down. The PC's idle time and the
// vault are stand-ins (no server, no waiting). Prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.PM = process.mainModule.require("electron").powerMonitor;
globalThis.IDLE = 0; PM.getSystemIdleTime = () => IDLE;
globalThis.V = { state: "open", locks: 0 };
Object.assign(R.pass, { status: () => ({ state: V.state, email: "rove-idle@example.test", server: "https://pass.test" }), lock: () => { V.locks++; V.state = "locked"; },
  forPage: () => [], search: () => [], syncedAt: () => Date.now() });`;
export default [
  { js: H + `R.go("https://example.com/"); await sleep(1000); R.showOverlay({ kind: "pass", x: 900, y: 84 }); await sleep(600);
    IDLE = 14 * 60; const r = R.passIdle();
    return CHECK("away 14 minutes: still open", !r && V.locks === 0 && V.state === "open", { r, locks: V.locks });` },
  { js: `IDLE = 15 * 60; const r = R.passIdle(); await sleep(600);
    const form = await R.overlay.webContents.executeJavaScript("document.querySelector('.pass form')?.dataset.form || null");
    return CHECK("away 15 minutes: locked, the open popup asks for the master password", r && V.locks === 1 && form === "unlock", { r, locks: V.locks, form });` },
  { js: `const r = R.passIdle(); R.hideOverlay();
    return CHECK("locked already: nothing more", !r && V.locks === 1, { r, locks: V.locks });` },
];
