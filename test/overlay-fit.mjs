// node test/drive.mjs test/overlay-fit.mjs: in a short window (800×600, and the 480×320
// least, also with tabs down the side) every popup must stay inside the window, and its
// last row must be reachable — the popup scrolls instead of running off the bottom.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FIT = async (what) => {
  R.showOverlay(what); await sleep(700);
  const got = await R.overlay.webContents.executeJavaScript(\`(() => {
    const p = document.querySelector(".pop"); if (!p) return { none: true };
    p.scrollTop = p.scrollHeight; for (const l of p.querySelectorAll(".list")) l.scrollTop = l.scrollHeight;
    const r = p.getBoundingClientRect(), rows = p.querySelectorAll("button, a, [role=menuitem], [role=menuitemcheckbox], input");
    const last = rows[rows.length - 1]?.getBoundingClientRect();
    return { h: innerHeight, top: Math.round(r.top), bottom: Math.round(r.bottom), last: last ? Math.round(last.bottom) : null };
  })()\`);
  R.hideOverlay(); await sleep(250);
  return got;
};
globalThis.CHECK = (name, g) => { const ok = !g.none && g.bottom <= g.h + 0.5 && (g.last === null || g.last <= g.h + 0.5);
  return (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(g); };`;
const sizes = [[800, 600], [480, 320]];
const kinds = [["menu", { kind: "menu" }], ["site", { kind: "site" }], ["pass", { kind: "pass" }]];
export default [
  { js: H + `R.go("data:text/html,<title>a</title>a"); await sleep(500); R.newTab("data:text/html,<title>b</title>b"); await sleep(400);
    R.groupNew(R.tabs[0]); await sleep(400); return "groups " + (R.groups?.length ?? "?");` },
  ...sizes.flatMap(([w, h]) => [
    { js: `R.win.setContentSize(${w}, ${h}); await sleep(500); return "size " + R.win.getContentSize().join("x");` },
    ...kinds.map(([n, what]) => ({ js: `return CHECK("${w}x${h} ${n}", await FIT(${JSON.stringify(what)}));` })),
    { js: `const g = R.groups?.[0]; return CHECK("${w}x${h} group", await FIT({ kind: "group", id: g?.id, x: 40, y: 48 }));` },
  ]),
  { js: `R.setVertical(true); await sleep(500); return CHECK("480x320 side tabs menu", await FIT({ kind: "menu" }));` },
  { js: `R.win.setContentSize(800, 600); await sleep(400); const g = await FIT({ kind: "menu" }); R.setVertical(false); await sleep(300); return CHECK("800x600 side tabs menu", g);` },
];
