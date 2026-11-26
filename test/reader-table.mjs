// node test/drive.mjs test/reader-table.mjs: in reading mode a table (an infobox, a data table) is set a step
// smaller than the text and its cells keep no paragraph gap at their end, so a row is as tall as its words.
// A local server in Rove's main process gives the article — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const para = "<p>" + "Seoul is the capital and largest city of South Korea, on the Han River. ".repeat(6) + "</p>";
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  s.end("<!doctype html><title>Seoul</title><article><h1>Seoul</h1>" + para + para + "<table><tr><th>Area</th><td><p>605 km2</p></td></tr><tr><th>People</th><td><p>9.4 million</p></td></tr></table>" + para + para + para + "</article>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));`;
export default [
  { js: H + `await R.active.view.webContents.loadURL("http://127.0.0.1:" + SRV.address().port + "/art").catch(() => {}); await sleep(800);
    await R.read(R.active); await sleep(1200);
    const got = await R.active.view.webContents.executeJavaScript("(() => { const td = document.querySelector('td'), p = td.querySelector('p'), body = parseFloat(getComputedStyle(document.querySelector('article p')).fontSize); return { reader: !!document.querySelector('header .site'), table: parseFloat(getComputedStyle(document.querySelector('table')).fontSize), body, gap: getComputedStyle(p).marginBottom, rowH: Math.round(td.getBoundingClientRect().height) }; })()");
    return CHECK("table a step smaller, no gap at a cell's end", got.reader && got.table < got.body && got.gap === "0px" && got.rowH < 40, got);` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
