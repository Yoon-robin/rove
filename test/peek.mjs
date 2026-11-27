// node test/drive.mjs test/peek.mjs: vertical tabs folded to icons, the pointer resting on them —
// the list unfolded over the page (the page does not move), as Brave's expand on hover; a tab chosen
// or closed there, it stays; the pointer off it, it goes; unfolded tabs never peek. The pointer is a
// stand-in (screen.getCursorScreenPoint), the hover an event — no real mouse. Local server only.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>page " + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.U = (t) => "http://127.0.0.1:" + SRV.address().port + "/" + t;
const E = process.mainModule.require("electron"); globalThis.REAL = E.screen.getCursorScreenPoint;
globalThis.AT = null; E.screen.getCursorScreenPoint = () => AT || { x: -9999, y: -9999 };
globalThis.POINT = (x, y) => { const b = R.win.getContentBounds(); AT = { x: b.x + x, y: b.y + y }; };
globalThis.HOVER = () => R.win.webContents.executeJavaScript("document.getElementById('sidelist').dispatchEvent(new MouseEvent('mouseenter')), 1");
globalThis.PEEK = () => R.overlay.webContents.executeJavaScript("(() => { const p = document.querySelector('.side.peek'); return p ? { rows: [...p.querySelectorAll('.tab')].map((t) => t.querySelector('.t').textContent), chosen: p.querySelector('.tab[aria-selected=true] .t')?.textContent, width: Math.round(p.getBoundingClientRect().width) } : null; })()");
globalThis.PRESS = (n, button) => R.overlay.webContents.executeJavaScript("document.querySelectorAll('.side.peek .tab')[" + n + "].querySelector('.t').dispatchEvent(new MouseEvent('mousedown', { button: " + button + ", bubbles: true })), 1");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.active.view.webContents.loadURL(U("one")).catch(() => {}); R.newTab(U("two")); R.newTab(U("three")); await sleep(1200);
    R.setVertical(true); R.setNarrow(true); await sleep(1000);
    const page = R.active.view.getBounds(); POINT(20, 200); await HOVER(); await sleep(250); const early = R.overlayOn?.kind || null; await sleep(500);
    const o = R.overlay.getBounds(), list = await PEEK(), after = R.active.view.getBounds();
    const got = { early, kind: R.overlayOn?.kind, overlay: o, list, page, after };
    return CHECK("resting on the folded tabs: the names over the page, the page where it was", !early && got.kind === "peek" && o.x === 0 && o.width === 240 && o.y === 44 && list?.rows.join() === "page one,page two,page three" && list.chosen === "page three" &&
      after.x === 52 && after.width === page.width, got);` },
  { js: `const want = R.tabs[0]; await PRESS(0, 0); await sleep(400); const a = await PEEK(), chose = R.active === want, still = R.overlayOn?.kind;
    await PRESS(2, 1); await sleep(500); const b = await PEEK();
    const got = { chose, still, a, b, tabs: R.tabs.length, kind: R.overlayOn?.kind };
    return CHECK("a tab chosen there, one closed with the middle button: the list stays and follows", chose && still === "peek" && a?.chosen === "page one" && got.tabs === 2 && got.kind === "peek" && b?.rows.join() === "page one,page two", got);` },
  { js: `POINT(400, 200); await sleep(400); const gone = R.overlayOn === null;
    R.setNarrow(false); await sleep(600); POINT(20, 200); await HOVER(); await sleep(700); const wide = R.overlayOn?.kind || null;
    R.setVertical(false); await sleep(600); process.mainModule.require("electron").screen.getCursorScreenPoint = REAL; SRV.close();
    return CHECK("the pointer off it: gone; tabs not folded: no peek", gone && wide === null, { gone, wide });` },
];
