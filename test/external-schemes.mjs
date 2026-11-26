// node test/drive.mjs test/external-schemes.mjs: a page sends the browser to another
// program's link. Schemes used in attacks on Windows (search-ms: shows a remote share
// as if it were a local folder; hcp:, its:, mk: are old help-file holes; shell:) are
// refused without asking; an ordinary one (zoommtg:) is still asked about. Nothing is
// ever answered yes here, so no program opens. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.TRY = async (link) => {
  const before = R.asks.length;
  await R.active.view.webContents.executeJavaScript("location.href = " + JSON.stringify(link) + "; 1").catch(() => {});
  await sleep(700);
  const ask = R.asks.slice(before).find((a) => a.what[0] === "external");
  if (ask) R.answer(ask.id, false);
  return ask ? "asked " + ask.scheme : "refused";
};
globalThis.CHECK = (name, got, want) => (got === want ? "ok   " : "FAIL ") + name + ": " + got + (got === want ? "" : " (want " + want + ")");`;
const page = "data:text/html,<title>links</title><body>links";
const refused = ["search-ms:query=report&crumb=location:%5C%5Cexample.com%5Cshare", "search:query=report", "shell:startup", "hcp://system/help.htm", "its:file.chm::/x.htm", "mk:@MSITStore:file.chm::/x.htm", "ms-msdt:/id x"];
export default [
  { js: H + `R.go(${JSON.stringify(page)}); await sleep(600); return "ready";` },
  ...refused.map((l) => ({ js: `return CHECK(${JSON.stringify(l.split(":")[0] + ": refused")}, await TRY(${JSON.stringify(l)}), "refused");` })),
  { js: `return CHECK("zoommtg: still asked", await TRY("zoommtg://zoom.us/join?confno=1"), "asked zoommtg");` },
];
