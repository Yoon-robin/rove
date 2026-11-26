// The toolbar's extension buttons (<browser-action-list>, electron-chrome-extensions)
// need their element put into our screen by a preload. Ours run sandboxed, where a
// preload can take nothing but "electron", so the library's part is bundled into one
// file. main.cjs builds it at start when Rove runs from the source; a release builds
// it into the app (scripts/release-rove.mjs).
const { buildSync } = require("esbuild");
const { join } = require("node:path");

function build(outfile) {
  buildSync({
    stdin: {
      contents: 'if (location.href.startsWith("rove://ui/index.html")) require("electron-chrome-extensions/browser-action").injectBrowserAction();',
      resolveDir: join(__dirname, ".."),
      loader: "js",
    },
    bundle: true,
    platform: "browser",
    format: "iife",
    external: ["electron"],
    outfile,
    logLevel: "warning",
    legalComments: "eof",
  });
  return outfile;
}

module.exports = { build };
