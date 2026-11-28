// node test/drive.mjs test/address-schemes.mjs: what the address bar does with a typed address that is not
// a web page. mailto: and tel: go to the program for them (asked, as any other program's link), data: opens
// as Brave and Chrome do, a name@site without a scheme is still a site. Nothing is answered yes, so no
// program opens. No network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, got, want) => (got === want ? "ok   " : "FAIL ") + name + ": " + got + (got === want ? "" : " (want " + want + ")");`;
const reads = [
  ["mailto:a@b.com", "mailto:a@b.com"],
  ["mailto:a@b.com?subject=hi there", "mailto:a@b.com?subject=hi%20there"],
  ["tel:+82-10-1234-5678", "tel:+82-10-1234-5678"],
  ["data:text/html,<b>hi</b>", "data:text/html,<b>hi</b>"],
  ["user@example.com", "https://user@example.com"],
  ["javascript:alert(1)", "https://www.google.com/search?q=javascript%3Aalert(1)"],
];
export default [
  { js: H + `await sleep(500); return "ready";` },
  ...reads.map(([typed, want]) => ({ js: `return CHECK(${JSON.stringify("reads " + typed)}, R.toUrl(${JSON.stringify(typed)}), ${JSON.stringify(want)});` })),
  { js: `R.go("data:text/html,<title>before</title>x"); await sleep(1000); const before = R.asks.length; R.go("mailto:a@b.com"); await sleep(1200);
    const ask = R.asks.slice(before).find((a) => a.what[0] === "external"); if (ask) R.answer(ask.id, false);
    return CHECK("typed mailto: asks for the mail program", ask ? "asked " + ask.scheme : "nothing", "asked mailto");` },
  { js: `return CHECK("the tab keeps its page's name and address", R.active.title + " " + R.active.url, "before data:text/html,<title>before</title>x");` },
  { js: `R.go("data:text/html,<title>typed</title>hi"); await sleep(1200); return CHECK("typed data: opens", await R.active.view.webContents.executeJavaScript("document.title"), "typed");` },
  { js: `globalThis.KEY = (keyCode, modifiers = []) => { for (const type of ["keyDown", "keyUp"]) R.win.webContents.sendInputEvent({ type, keyCode, modifiers }); };
    globalThis.TYPE = async (text) => { await R.win.webContents.executeJavaScript("url.focus(), url.value = '', 1"); R.win.webContents.focus(); for (const ch of text) { R.win.webContents.sendInputEvent({ type: "char", keyCode: ch }); await sleep(30); } await sleep(400); };
    const n = R.tabs.length, before = R.asks.length; await TYPE("mailto:a@b.com"); KEY("Enter", ["alt"]); await sleep(1500);
    const ask = R.asks.slice(before).find((a) => a.what[0] === "external"); if (ask) R.answer(ask.id, false);
    return CHECK("Alt+Enter on mailto: asks, no empty new tab", (R.tabs.length - n) + " " + (ask ? "asked" : "nothing"), "0 asked");` },
  { js: `const n = R.windows.length, before = R.asks.length; await TYPE("tel:123"); KEY("Enter", ["shift"]); await sleep(1500);
    const ask = R.asks.slice(before).find((a) => a.what[0] === "external"); if (ask) R.answer(ask.id, false);
    const more = R.windows.length - n; if (more > 0) R.windows.at(-1).win.close();
    return CHECK("Shift+Enter on tel: asks, no empty new window", more + " " + (ask ? "asked" : "nothing"), "0 asked");` },
];
