// node test/drive.mjs test/private-site.mjs: what is set for a site in a private window stays there,
// as Chrome's and Brave's private windows keep their site settings in memory: 막기 끔 for a site
// (Shields off) and 창을 내려도 계속, set in a private window, work in it while it is open, are not
// written to settings.json nor shown in the normal windows, and go with the last private window.
// What the normal windows set holds in a private one too (Chromium hands its settings down).
// A local server in Rove's main process: no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fs = process.mainModule.require("node:fs"), path = process.mainModule.require("node:path");
globalThis.DISK = () => { try { return JSON.parse(fs.readFileSync(path.join(process.env.ROVE_HOME, "settings.json"), "utf8")); } catch { return {}; } };
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>p</title>ok"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.SITE = "http://127.0.0.1:" + SRV.address().port + "/";
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `globalThis.NORMAL = R.cur; globalThis.P = R.createWindow({ priv: true, urls: [SITE] }); R.use(P); await sleep(1500);
    R.setBlock(false, R.active.url); R.setAwake(true); await sleep(1200);
    const disk = DISK(), here = R.snapshot().block;
    return CHECK("set in a private window: works there, not in settings.json", here.siteOn === false && R.awakeFor(SITE, true) && !(disk.allow || []).includes("127.0.0.1") && !(disk.awake || []).length, { siteOn: here.siteOn, awake: R.awakeFor(SITE, true), allow: disk.allow, diskAwake: disk.awake });` },
  { js: `R.use(NORMAL); R.go(SITE); await sleep(1200);
    return CHECK("the normal window does not take it", R.snapshot().block.siteOn === true && !R.awakeFor(SITE), { siteOn: R.snapshot().block.siteOn, awake: R.awakeFor(SITE) });` },
  { js: `P.win.close(); await sleep(1200); globalThis.P2 = R.createWindow({ priv: true, urls: [SITE] }); R.use(P2); await sleep(1500);
    return CHECK("gone with the last private window", R.snapshot().block.siteOn === true && !R.awakeFor(SITE, true), { siteOn: R.snapshot().block.siteOn, awake: R.awakeFor(SITE, true) });` },
  { js: `R.use(NORMAL); R.setBlock(false, R.active.url); await sleep(300); R.use(P2); const inPriv = R.snapshot().block.siteOn;
    R.use(NORMAL); R.setBlock(true, R.active.url); await sleep(1200);
    return CHECK("what the normal window sets holds in a private one", inPriv === false && !(DISK().allow || []).includes("127.0.0.1"), { inPriv, allow: DISK().allow });` },
];
