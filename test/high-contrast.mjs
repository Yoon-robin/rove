// node test/drive.mjs test/high-contrast.mjs: Windows high contrast (forced colors, emulated
// over the window's debugger) drops box-shadows and backgrounds. The current tab, the
// address box and its focus must still show: each prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.pg = (t) => "data:text/html,<title>" + t + "</title><body>" + t;
globalThis.FC = async (on, wc = R.win.webContents) => {
  try { wc.debugger.attach("1.3"); } catch { /* attached */ }
  await wc.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: on ? "active" : "none" }] });
  await wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true });
  await sleep(300);
};
globalThis.CS = (sel, props) => R.win.webContents.executeJavaScript("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); if (!e) return null; const s = getComputedStyle(e); return " + JSON.stringify(props) + ".map((p) => s.getPropertyValue(p)).join(' '); })()");
globalThis.CSO = (sel, props, pseudo = null) => R.overlay.webContents.executeJavaScript("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); if (!e) return null; const s = getComputedStyle(e, " + JSON.stringify(pseudo) + "); return " + JSON.stringify(props) + ".map((p) => s.getPropertyValue(p)).join(' '); })()");
globalThis.CHECK = (name, got, want) => (got === want ? "ok   " : "FAIL ") + name + ": " + got + (got === want ? "" : " (want " + want + ")");`;
const tab = '.tab[aria-selected="true"]';
export default [
  { js: H + `R.go(pg("one")); await sleep(400); R.newTab(pg("two")); await sleep(400); R.newTab(pg("three")); await sleep(400); R.select(R.tabs[1]); await sleep(300); return "tabs " + R.tabs.length;` },
  { js: `await FC(true); return [
    CHECK("forced colors on", await R.win.webContents.executeJavaScript("matchMedia('(forced-colors: active)').matches"), true),
    CHECK("current tab outline", await CS(${JSON.stringify(tab)}, ["outline-style", "outline-width"]), "solid 2px"),
    CHECK("address border", await CS(".address", ["border-top-style", "border-top-width"]), "solid 1px"),
  ].join("\\n");` },
  { js: `await R.win.webContents.executeJavaScript("document.querySelector('.address input').focus()"); await sleep(200);
    return CHECK("address focus outline", await CS(".address", ["outline-style", "outline-width"]), "solid 2px");` },
  { js: `R.setVertical(true); await sleep(500); return CHECK("side: current tab outline", await CS(${JSON.stringify(".side " + tab)}, ["outline-style", "outline-width"]), "solid 2px");` },
  // the overlay: menu switches (on and off), the popup's edge, the drawer's chosen tab and search box
  { js: `R.setVertical(false); await sleep(400); await FC(true, R.overlay.webContents); R.showOverlay({ kind: "menu" }); await sleep(700);
    const sw = (sel) => CSO(sel, ["border-top-style"]) .then(async (b) => b + " " + await CSO(sel, ["background-color"], "::before"));
    return [
      CHECK("menu open", R.overlayOn?.kind, "menu"),
      CHECK("menu edge", await CSO(".pop.menu", ["outline-style"]), "solid"),
      CHECK("switch on: edge, knob", await sw('.rk-switch[aria-checked="true"]'), "solid rgb(0, 0, 0)"),
      CHECK("switch off: edge, knob", await sw('.rk-switch[aria-checked="false"]'), "solid rgb(255, 255, 255)"),
    ].join("\\n");` },
  { js: `R.hideOverlay(); await sleep(300); R.showOverlay({ kind: "drawer", panel: "history" }); await sleep(700); return [
      CHECK("drawer: chosen tab outline", await CSO('.rk-tab[aria-selected="true"]', ["outline-style"]), "solid"),
      CHECK("drawer: search box border", await CSO(".rk-input", ["border-top-style"]), "solid"),
    ].join("\\n");` },
  // without forced colors nothing of this shows (the V5.1 look stays as it is)
  { js: `R.hideOverlay(); await sleep(300); await FC(false); await FC(false, R.overlay.webContents); return [
    CHECK("normal: no tab outline", await CS(${JSON.stringify(tab)}, ["outline-style"]), "none"),
    CHECK("normal: no address border", await CS(".address", ["border-top-style"]), "none"),
  ].join("\\n");` },
];
