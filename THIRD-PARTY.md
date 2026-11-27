# 함께 쓰는 남의 것

Rove 자체는 GPL-3.0이에요([LICENSE](LICENSE)). 아래 것들은 각자의 라이선스를 따르고, 릴리스에 함께 들어가요.

| 무엇 | 어디에 | 라이선스 |
| --- | --- | --- |
| [Electron](https://github.com/electron/electron) 45.5.0 (Chromium·Node.js 포함) | 실행 파일 전체 | MIT. Chromium과 그 안의 것들은 릴리스의 `LICENSES.chromium.html` |
| [@ghostery/adblocker](https://github.com/ghostery/adblocker) 2.20.3 | `adblock.cjs`(한 파일로 묶음), `blocker.cjs`가 씀 | MPL-2.0 |
| Ghostery가 미리 만든 광고·추적 목록: EasyList·EasyPrivacy, uBlock Origin 목록, Peter Lowe 목록 | `lists.bin`(`tools/lists.cjs`가 릴리스마다 새로 만듦) | EasyList·EasyPrivacy: GPL-3.0 또는 CC BY-SA 3.0, uBlock Origin 목록: GPL-3.0, Peter Lowe 목록: 만든 사람의 조건([pgl.yoyo.org](https://pgl.yoyo.org/adservers/)) |
| Brave의 추적 주소 목록(`debounce.json`, [brave/adblock-lists](https://github.com/brave/adblock-lists)) | `bounce.json`(`tools/lists.cjs`가 릴리스마다 받음), `blocker.cjs`가 씀. 목록만 쓰고 Brave 코드는 안 씀 | MPL-2.0 |
| [@mozilla/readability](https://github.com/mozilla/readability) 0.6.0 | 읽기 모드, 릴리스의 `readability/`(그 `LICENSE.md` 포함) | Apache-2.0 |
| [tldts](https://github.com/remusao/tldts) 7.4.21 | RobinPass 사이트 맞추기, `vault.cjs`에 묶음 | MIT |
| [hash-wasm](https://github.com/Daninet/hash-wasm) 4.13.0 | RobinPass 키 만들기(Argon2id), `vault.cjs`에 묶음 | MIT |
| [electron-chrome-extensions](https://github.com/samuelmaddock/electron-browser-shell) 4.10.0 | Chrome 확장 프로그램 API·도구 줄 단추, `extensions.cjs`에 묶음, `chrome-extension-api.preload.js`·`actions.preload.cjs` | MIT |
| [electron-chrome-web-store](https://github.com/samuelmaddock/electron-browser-shell) 0.13.0 | 웹 스토어에서 추가·업데이트, `extensions.cjs`에 묶음, `chrome-web-store.preload.js` | MIT |
| 그 둘이 쓰는 [adm-zip](https://github.com/cthackers/adm-zip) 0.5.18, [debug](https://github.com/debug-js/debug) 4.4.3, [ms](https://github.com/vercel/ms) 2.1.3, [resolve-protobuf-schema](https://github.com/mafintosh/resolve-protobuf-schema) 2.1.0, [protocol-buffers-schema](https://github.com/mafintosh/protocol-buffers-schema) 3.6.1 | `extensions.cjs`에 묶음 | MIT |
| [pbf](https://github.com/mapbox/pbf) 4.0.2 | 웹 스토어의 확장 파일(CRX3) 읽기, `extensions.cjs`에 묶음 | BSD-3-Clause |
| [Pretendard](https://github.com/orioncactus/pretendard) | 화면 글꼴 `ui/fonts/` | SIL OFL 1.1([ui/fonts/LICENSE.txt](ui/fonts/LICENSE.txt)) |
| [Pretendard](https://github.com/orioncactus/pretendard) | 설치 창 글꼴 `setup/fonts/`(450·550·650 굵기, 쓰는 글자만, `setup/font.py`) | SIL OFL 1.1([ui/fonts/LICENSE.txt](ui/fonts/LICENSE.txt)) |

만들 때만 쓰는 것(릴리스에 안 들어감): [@electron/packager](https://github.com/electron/packager)(BSD-2-Clause), [@electron/fuses](https://github.com/electron/fuses)(MIT), [esbuild](https://github.com/evanw/esbuild)(MIT).

RobinPass는 [Bitwarden](https://github.com/bitwarden/clients)이 쓰는 방식(PBKDF2·Argon2id, AES-CBC+HMAC)을 보고 처음부터 다시 쓴 것이에요. Bitwarden 코드는 들어 있지 않아요.
