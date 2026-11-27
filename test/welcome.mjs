// node test/welcome.mjs: runs test/welcome.steps.mjs with a made-up Chrome (two bookmarks) in a temp
// folder, so no real browser on this PC is read, and a name that is not the default browser
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = mkdtempSync(join(tmpdir(), "rove-welcome-"));
const dir = join(root, "Google", "Chrome", "User Data", "Default");
mkdirSync(dir, { recursive: true });
const url = (n, u) => ({ type: "url", name: n, url: u });
writeFileSync(join(dir, "Bookmarks"), JSON.stringify({ roots: { bookmark_bar: { type: "folder", children: [url("A", "https://example.com/a"), url("B", "https://example.org/b")] }, other: { type: "folder", children: [] } } }));
const here = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [join(here, "drive.mjs"), join(here, "welcome.steps.mjs")], { stdio: "inherit", env: { ...process.env, ROVE_WELCOME: "1", ROVE_AS: "RoveWelcomeTest", ROVE_IMPORT_ROOT: root } });
rmSync(root, { recursive: true, force: true });
process.exit(r.status ?? 1);
