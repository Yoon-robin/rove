// node test/drive.mjs test/reopen-tab.mjs: a tab closed comes back with Ctrl+Shift+T where it was,
// as in Chrome and Brave: at its place in the strip (not at the end), pinned if it was, in its group
// (made again if it was the group's last tab). A tab closed in another window comes in at the end.
// No network: the addresses are example.invalid (they fail to load), only where the tabs go counts.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.u = (t) => "https://example.invalid/?" + t;
globalThis.KEY = () => R.keys({ type: "keyDown", key: "T", control: true, shift: true });
globalThis.URLS = () => R.tabs.map((t) => t.url.replace("https://example.invalid/?", ""));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go(u("a")); for (const t of ["b", "c", "d", "e"]) R.newTab(u(t)); await sleep(800);
    return "tabs " + JSON.stringify(URLS());` },
  // the middle one: back in the middle, and in front
  { js: `R.closeTab(R.tabs[2]); await sleep(200); KEY(); await sleep(500);
    const got = { urls: URLS(), front: R.tabs.indexOf(R.active) };
    return CHECK("closed c comes back at its place", JSON.stringify(got.urls) === JSON.stringify(["a", "b", "c", "d", "e"]) && got.front === 2, got);` },
  // a pinned one: pinned again, first
  { js: `R.pin(R.tabs[3]); await sleep(200); R.closeTab(R.tabs[0]); await sleep(200); KEY(); await sleep(500);
    const got = { urls: URLS(), pinned: R.tabs.map((t) => !!t.pinned) };
    return CHECK("a pinned tab comes back pinned", got.urls[0] === "d" && got.pinned[0] === true && got.pinned.filter(Boolean).length === 1, got);` },
  // in a group with others: back in that group
  { js: `const g = R.groupNew(R.tabs[1]); R.groupAdd?.(R.tabs[2], g.id); await sleep(200);
    const inG = R.tabs.filter((t) => t.group === g.id).length;
    R.closeTab(R.tabs.find((t) => t.group === g.id)); await sleep(200); KEY(); await sleep(500);
    const got = { inG, after: R.tabs.filter((t) => t.group === g.id).length, urls: URLS(), groups: R.groups.length };
    return CHECK("a grouped tab comes back in its group", got.after === inG && got.groups === 1, got);` },
  // the group's only tab: the group comes back with it (its name and colour)
  { js: `for (const t of R.tabs) if (t.group) R.groupOut?.(t); await sleep(100);
    const g = R.groupNew(R.tabs.at(-1)); g.name = "읽을 것"; const color = g.color; await sleep(200);
    R.closeTab(R.tabs.at(-1)); await sleep(200); const gone = R.groups.some((x) => x.id === g.id) ? 1 : 0; KEY(); await sleep(500);
    const t = R.tabs.at(-1); const back = R.groups.find((x) => x.id === t.group);
    return CHECK("a group's last tab brings its group back", gone === 0 && !!back && back.id === g.id && back.name === "읽을 것" && back.color === color, { gone, back });` },
  // closed in another window: comes in at the end of this one
  { js: `R.createWindow({ urls: [u("x"), u("y")] }); await sleep(1000); const w2 = R.windows[1];
    R.use(w2); R.closeTab(w2.tabs[0]); await sleep(200); R.use(R.windows[0]); await sleep(100);
    const n = R.tabs.length; KEY(); await sleep(500);
    const got = { urls: URLS(), n };
    return CHECK("closed in another window: at the end here", R.tabs.length === n + 1 && got.urls.at(-1) === "x", got);` },
];
