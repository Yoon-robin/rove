// node test/drive.mjs test/error-page.mjs: a page Rove could not open says what went wrong as it is — a
// refused connection, a port browsers keep closed, a name not found — not "no answer" for all of them; and its
// words start at the same place whatever the message (the box is one width). Only local addresses and a
// .invalid name (never looked up outside) — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.OPEN = async (url) => { R.go(url); await sleep(2500); return R.active.view.webContents.executeJavaScript("(() => { const b = document.querySelector('.b'); return { say: b ? b.querySelector('p').textContent : document.body.innerText.slice(0, 80), code: b ? b.querySelector('code').textContent : '', x: b ? Math.round(b.getBoundingClientRect().x) : -1 }; })()"); };
const s = process.mainModule.require("node:http").createServer(); await new Promise((r) => s.listen(0, "127.0.0.1", r));
globalThis.FREE = s.address().port; await new Promise((r) => s.close(r));
globalThis.XS = [];`;
export default [
  { js: H + `R.win.setContentSize(1280, 800); const got = await OPEN("http://127.0.0.1:" + FREE + "/"); XS.push(got.x);
    return CHECK("refused: says the connection was refused", /거부/.test(got.say) && /-102/.test(got.code), got);` },
  { js: `const got = await OPEN("http://127.0.0.1:1/"); XS.push(got.x);
    return CHECK("port 1: says the browser keeps that port closed", /포트/.test(got.say) && !/답이 없어요/.test(got.say) && /-312/.test(got.code), got);` },
  { js: `const got = await OPEN("http://no-such-host.invalid/"); XS.push(got.x);
    return CHECK("no such name: says the address was not found", /주소를 찾지 못했어요/.test(got.say) && /-105/.test(got.code), got);` },
  { js: `return CHECK("the words start at one place on every one", XS.length === 3 && XS.every((x) => x === XS[0] && x > 0), XS);` },
];
