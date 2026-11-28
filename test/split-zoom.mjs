// node test/drive.mjs test/split-zoom.mjs: side by side, Ctrl+wheel over one side zooms that side (as in
// Chrome and Brave, the page under the pointer), not the tab in front. Local server only. Each line
// prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>page " + q.url.slice(1) + "</title><body style='height:2000px'>" + q.url.slice(1)); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.U = (t, h = "127.0.0.1") => "http://" + h + ":" + SRV.address().port + "/" + t;
globalThis.Z = (tab) => Math.round(tab.view.webContents.getZoomFactor() * 100) / 100;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.active.view.webContents.loadURL(U("one")).catch(() => {}); R.newTab(U("two", "localhost")); await sleep(1200);
    const one = R.tabs[0], two = R.tabs[1];
    R.select(one); await sleep(200);
    R.splitWith(two, one, "right"); R.select(one); await sleep(500);
    // the wheel over the right side while the left one is in front
    two.view.webContents.emit("zoom-changed", {}, "in"); await sleep(300);
    const got = { front: R.active === one, one: Z(one), two: Z(two) };
    return CHECK("Ctrl+wheel over the side not in front zooms that side, the front one stays", got.two > 1 && got.one === 1, got);` },
  { js: `const { a, b } = R.split; b.view.webContents.emit("zoom-changed", {}, "out"); a.view.webContents.emit("zoom-changed", {}, "in"); await sleep(300);
    const got = { a: Z(a), b: Z(b), kept: R.settings.zoom };
    SRV.close();
    return CHECK("back to 100% on the right; the left one zoomed", got.b === 1 && got.a > 1, got);` },
];
