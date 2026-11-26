// node test/drive.mjs test/permissions.mjs: a site asking for something (here: to send
// notifications), as a user meets it — Rove asks in its bar; the answer is kept for that site
// (asked again on the same site: no bar, the same answer), not for another site; a private window
// asks for itself and keeps nothing on disk; its answers go with its last window.
// No notification is shown (only asked). A local server, no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs"); globalThis.PATH = process.mainModule.require("node:path");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>p</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
const port = SRV.address().port; globalThis.A = "http://127.0.0.1:" + port; globalThis.B = "http://localhost:" + port;
globalThis.LOAD = async (tab, url) => { tab.view.webContents.loadURL(url).catch(() => {}); await sleep(900); };
// the page asks; the answer comes back later (a promise in the page), the ask shows in Rove at once
globalThis.ASK = (tab) => { tab.view.webContents.executeJavaScript("window.__p = Notification.requestPermission(); 1", true).catch(() => {}); };
globalThis.GOT = (tab) => tab.view.webContents.executeJavaScript("window.__p").catch((e) => "err " + e.message);
globalThis.MINE = (tab) => R.asks.filter((a) => a.tab === tab);
globalThis.SAVED = () => { try { return JSON.parse(FS.readFileSync(PATH.join(process.env.ROVE_HOME, "permissions.json"), "utf8")); } catch { return {}; } };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `const t = R.active; await LOAD(t, A + "/one"); ASK(t); await sleep(600); const asks = MINE(t).map((a) => a.what);
    const a = MINE(t)[0]; if (a) R.answer(a.id, false); const page = await GOT(t); await sleep(1200);
    const got = { asks, page, saved: SAVED()[A] };
    return CHECK("a site asks: Rove asks; no is kept for the site", asks.length === 1 && asks[0].includes("notifications") && page === "denied" && got.saved?.notifications === false, got);` },
  { js: `const t = R.active; await LOAD(t, A + "/two"); ASK(t); await sleep(600); const again = MINE(t).length; const page = await GOT(t);
    const o = R.newTab(B + "/x"); await sleep(1000); ASK(o); await sleep(600); const other = MINE(o).length; const oa = MINE(o)[0]; if (oa) R.answer(oa.id, true, false); const opage = await GOT(o);
    const got = { again, page, other, opage, savedB: SAVED()[B] || null };
    return CHECK("the same site again: no bar, the same answer; another site asks for itself", again === 0 && page === "denied" && other === 1 && opage === "granted" && !got.savedB, got);` },
  { js: `R.createWindow({ priv: true }); await sleep(1500); const p = R.windows.find((w) => w.private && !w.gone); const t = p.tabs[0]; R.use(p);
    await LOAD(t, B + "/secret"); ASK(t); await sleep(600); const asks = MINE(t).length; const a = MINE(t)[0]; if (a) R.answer(a.id, true); const page = await GOT(t); await sleep(1200);
    const got = { asks, page, priv: { ...R.privGrants }, saved: Object.keys(SAVED()) };
    p.win.close(); await sleep(800); got.after = Object.keys(R.privGrants);
    return CHECK("a private window: asks for itself, keeps nothing on disk, forgets with its window", asks === 1 && page === "granted" && !!got.priv[B]?.notifications && !got.saved.includes(B) && got.after.length === 0, got);` },
  // Chrome's incognito: a site said no to in a normal window is no there too (a yes is not taken)
  { js: `R.createWindow({ priv: true }); await sleep(1500); const p = R.windows.find((w) => w.private && !w.gone); const t = p.tabs[0]; R.use(p);
    await LOAD(t, A + "/again"); ASK(t); await sleep(600); const asks = MINE(t).length; const page = await GOT(t); p.win.close(); await sleep(800);
    return CHECK("a private window takes a normal window's no without asking", asks === 0 && page === "denied", { asks, page });` },
  { js: `R.use(R.windows[0]); SRV.close(); return undefined;` },
];
