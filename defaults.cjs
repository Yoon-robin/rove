// Rove as a browser Windows knows (robin 2026-11-24 "Rove 다음 버전"): the
// registration under HKCU (a StartMenuInternet client with http, https, .htm
// and .html), then Windows' own page for the default apps. Windows lets only
// the person choose the default browser, so Rove opens that page and stops.
// Everything goes under the current user; nothing needs an administrator.
const { execFile } = require("node:child_process");
const { join } = require("node:path");

const SYS = join(process.env.SystemRoot || "C:\\Windows", "System32");
const REG = join(SYS, "reg.exe");
const reg = (args) => new Promise((done) => {
  execFile(REG, args, { windowsHide: true, timeout: 15000 }, (err, out) => done({ ok: !err, out: String(out || "") }));
});

// name: "Rove" (tests use their own); command: how Windows starts us, `"exe" [app]`
async function register({ name, command, icon }) {
  const client = `HKCU\\Software\\Clients\\StartMenuInternet\\${name}`;
  const url = `${name}URL`;
  const html = `${name}HTML`;
  const open = `${command} "%1"`;
  const add = (key, value, data) => reg(["add", key, ...(value === null ? ["/ve"] : ["/v", value]), "/t", "REG_SZ", "/d", data, "/f"]);
  const steps = [
    [client, null, name],
    [`${client}\\DefaultIcon`, null, icon],
    [`${client}\\shell\\open\\command`, null, command],
    [`${client}\\Capabilities`, "ApplicationName", name],
    [`${client}\\Capabilities`, "ApplicationDescription", "Rove, a browser by Robin"],
    [`${client}\\Capabilities`, "ApplicationIcon", icon],
    [`${client}\\Capabilities\\StartMenu`, "StartMenuInternet", name],
    [`${client}\\Capabilities\\URLAssociations`, "http", url],
    [`${client}\\Capabilities\\URLAssociations`, "https", url],
    [`${client}\\Capabilities\\FileAssociations`, ".htm", html],
    [`${client}\\Capabilities\\FileAssociations`, ".html", html],
    [`HKCU\\Software\\Classes\\${url}`, null, `${name} URL`],
    [`HKCU\\Software\\Classes\\${url}`, "URL Protocol", ""],
    [`HKCU\\Software\\Classes\\${url}\\DefaultIcon`, null, icon],
    [`HKCU\\Software\\Classes\\${url}\\shell\\open\\command`, null, open],
    [`HKCU\\Software\\Classes\\${html}`, null, `${name} HTML`],
    [`HKCU\\Software\\Classes\\${html}\\DefaultIcon`, null, icon],
    [`HKCU\\Software\\Classes\\${html}\\shell\\open\\command`, null, open],
    ["HKCU\\Software\\RegisteredApplications", name, `Software\\Clients\\StartMenuInternet\\${name}\\Capabilities`],
  ];
  for (const [key, value, data] of steps) {
    const r = await add(key, value, data);
    if (!r.ok) return false;
  }
  return true;
}

// is https opened with us (Windows keeps the person's choice here)
async function isDefault(name) {
  const r = await reg(["query", "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice", "/v", "ProgId"]);
  return r.ok && new RegExp(`\\s${name}URL\\s*$`, "m").test(r.out);
}

// for tests: all of it gone again
async function unregister(name) {
  for (const key of [`HKCU\\Software\\Clients\\StartMenuInternet\\${name}`, `HKCU\\Software\\Classes\\${name}URL`, `HKCU\\Software\\Classes\\${name}HTML`]) await reg(["delete", key, "/f"]);
  await reg(["delete", "HKCU\\Software\\RegisteredApplications", "/v", name, "/f"]);
}

const settingsPage = (name) => `ms-settings:defaultapps?registeredAppUser=${encodeURIComponent(name)}`;

module.exports = { register, isDefault, unregister, settingsPage };
