# Rove

A browser by Robin. Windows용 데스크톱 브라우저예요(Electron 45, Chromium 엔진).

- 탭: 고정, 묶음(이름·색·접기), 세로 탭, 나란히 보기, 탭 찾기, 안 쓰는 탭 재우기
- 창 여러 개: 탭을 끌어 떼어 내기·다른 창으로 옮기기, 창마다 다시 켜도 그대로
- 비공개 창: 메모리에만 있는 세션, 기록·권한 답을 남기지 않음
- 광고·추적 막기(Ghostery 엔진), 클릭 추적 꼬리 떼기, GPC
- 사이트마다 권한 묻기·정하기, 화면 공유 고르기, 위험한 파일 묻기
- 읽기 모드(Readability), 화면 속 화면, 맞춤법 검사, 사이트별 확대 기억
- 다른 브라우저(Chrome·Edge·Brave·Vivaldi·Opera·Firefox·Zen·LibreWolf)에서 즐겨찾기 가져오기
- RobinPass: Vaultwarden(Bitwarden 호환) 서버의 비밀번호를 채우기·저장하기, 인증 코드(TOTP) 목록
- 기본 브라우저 등록, 서명을 확인하는 자동 업데이트

## 설치

[릴리스](https://github.com/Yoon-robin/rove/releases/latest)의 `install.cmd`(이 저장소의 [install.cmd](install.cmd))를 받아 두 번 눌러요. 최신 zip을 받아 sha256을 맞춰 보고 `%LOCALAPPDATA%\Rove\app-<버전>`에 풀어, 바탕화면·시작 메뉴에 `Rove.lnk`를 만들어요. 그다음부터는 켤 때 20초 뒤와 6시간마다 새 버전을 찾아요. `latest.json`의 서명이 `config.cjs`의 키와 맞고 zip의 sha256이 맞을 때만 받아요. 받은 버전은 다음에 켤 때 바뀌어요.

## 저장소에서 켜기·묶기

```
npm ci
node tools/lists.cjs   # 광고·추적 목록 → lists.bin (한 번, 저장소에는 안 올림)
npm start
npm run build          # out/Rove-win32-x64/Rove.exe (약 360MB)
```

릴리스는 릴리스 키를 가진 사람만 만들어요. 광고 막기 엔진과 RobinPass 금고를 esbuild로 한 파일씩 묶고, fuse를 켜요(RunAsNode·NODE_OPTIONS·`--inspect` 끔, asar에서만 읽기, 쿠키 암호화). 그다음 zip과 서명한 `latest.json`을 GitHub 릴리스에 올려요.

**내 Rove를 만든다면** `config.cjs`의 시작 페이지·검색·RobinPass 서버를 바꾸고, Ed25519 키를 새로 만들어 공개 키를 `updateKey`에, 업데이트 주소를 내 릴리스로 바꿔요. 이름 Rove와 로고·브랜드 키트(robin의 것)는 다른 이름·모양으로 바꿔 주세요.

## 구조

| 파일 | 무엇 |
| --- | --- |
| `main.cjs` | 창, 탭(WebContentsView), 단축키, 방문 기록·즐겨찾기·내려받기, 권한과 묻기 띠, 위험한 파일, 오류 페이지 |
| `config.cjs` | 시작 페이지, 검색, RobinPass 서버, 업데이트 주소와 릴리스 공개 키 — 내 Rove를 만들 때 바꾸는 곳 |
| `update.cjs` | 설치 버전 업데이트: `latest.json`의 서명(Ed25519)과 zip의 sha256을 맞춰 본 뒤 옆 폴더에 풀고 `current`를 옮김 |
| `blocker.cjs` | 광고·추적 막기: `lists.bin`을 읽어 `persist:rove`의 요청을 맞춰 봄 |
| `vault.cjs` | RobinPass 금고: 로그인(2단계)·잠금 해제·동기화·저장, 키 만들기와 풀기, 사이트 맞추기, TOTP. 메인 프로세스에서만. 릴리스 때 `tldts`·`hash-wasm`과 함께 한 파일로 묶어요 |
| `reader.cjs` | 읽기 모드: Readability를 페이지의 따로 떨어진 스크립트 세계(1003)에서 돌려 본문을 받고, 스크립트 없는 `data:` 페이지로 만듦. 릴리스에는 `readability/`에 `Readability.js`·`Readability-readerable.js`·`LICENSE.md` |
| `defaults.cjs` | 기본 브라우저 등록(HKCU, `reg.exe`), 지금 기본인지 |
| `tools/lists.cjs` | 광고·추적 목록 → `lists.bin` (저장소에서 시험하려면 `node tools/lists.cjs` 한 번) |
| `preload.cjs` | 우리 화면 둘에만: `rove.send/ask/on`, 이름이 `rove:`로 시작하는 것만 |
| `ui/index.html`·`ui.js` | 위쪽: 탭 줄, 도구 줄, 묻기 띠, 찾기 줄 |
| `ui/overlay.html`·`overlay.js` | 페이지 위 투명한 층: 메뉴(광고 막기 스위치), 주소 추천, 서랍(방문 기록·즐겨찾기·내려받기·사이트 권한), RobinPass, 사이트 정보, 화면 공유 고르기 |
| `ui/robin-ui.css`·`icons.svg` | robin 브랜드 키트(V5)의 CSS와 아이콘 |
| `ui/fonts/` | Pretendard(SIL OFL 1.1, `LICENSE.txt`) |
| `install.cmd` | 설치: 최신 GitHub 릴리스를 받아 `%LOCALAPPDATA%\Rove`에 넣고 바로가기를 만듦 |
| `test/drive.mjs` | 시험 드라이버 |
| `test/pass-account.cjs` | 시험용 Vaultwarden(https://localhost)에 임시 계정과 항목 둘 만들기(`codes`면 인증 코드 시험용 셋 더) |

- 페이지는 `persist:rove` 세션, 샌드박스, preload 없음. `rove://`는 기본 세션에만 있어서 페이지에서는 못 열어요.
- 페이지가 보내는 메시지는 없고, `ipcMain`은 보낸 쪽이 우리 두 뷰인지 확인해요.
- 사용자 에이전트에서 `Electron/`·`Rove/`를 빼요(구글 로그인 같은 곳이 막지 않게).
- 권한은 전체 화면·클립보드 쓰기·포인터 잠금·창 배치만 바로 허용, 카메라·마이크·위치·알림·클립보드 읽기·MIDI는 묻기 띠로 묻고(`permissions.json`), 화면 공유는 고르기 창이 권한 물음(`display-capture`, `shareAsked()`)에 답하고, 고른 것을 공유 처리기(`sharing()`, `desktopCapturer`·탭은 `mainFrame`)에 넘겨요. 주소창 자물쇠의 사이트 정보는 `siteInfo`·`setSite`·`clearSite`.
- 안 쓰는 탭 재우기는 `sleepTab()`(기록 저장 → `close({ waitForBeforeUnload })` → 새 뷰로 바꿈)·`wake()`(`navigationHistory.restore`), 30분(`ROVE_SLEEP_MS`). 사이트별 확대 `settings.zoom`, 즐겨찾기 가져오기 `importSources()`(Firefox 계열은 `places()`, 시험은 `ROVE_IMPORT_ROOT`), 추적 꼬리 떼기·GPC는 `blocker.cjs`의 `clean()`.
- 탭 고정은 `pin()`(고정 칸은 `newTab`·`moveTab`이 지킴), 나란히 보기는 `split`(`splitWith`·`unsplit`·`splitRatio`, `layout()`이 두 뷰를 놓음, 앞 탭 바꾸기는 `focus`·`input-event` mouseDown, 틈 끌기는 겹침 층 `splitdrag`), 읽기 모드는 `read()`·`lookReadable()`(`did-stop-loading`마다).
- 탭 묶음은 `groups`(`groupNew`·`groupAdd`·`groupOut`·`groupSet`·`groupFold`·`ungroup`·`groupClose`, 붙여 두기는 `cluster()`, 이름 카드는 겹침 층 `group`), 세로 탭은 `settings.vertical`·`narrow`(페이지 자리는 `frame()`, 창 단추 줄은 `titleBar()`, 탭 목록은 `#tabs`가 `#tabs-home`과 `#sidelist` 사이를 옮겨 다님).
- 창 여러 개: 창마다 상태(`tabs`·`active`·`split`·`groups`·`closed`…)를 창 객체에 두고, 모듈 변수는 "지금 쓰는 창"을 가리켜요. 들어오는 길(IPC는 `whose(e)`, 탭 이벤트는 `wire()`의 `here()`, 창 이벤트, 메뉴 클릭, `await` 뒤)마다 먼저 `use(창)`. 다른 창에서 할 일은 `within(창, f)`, 모든 창은 `everywhere(f)`, 아무 창의 탭 찾기는 `tabOf(wc)`. 창 만들기 `createWindow({ priv, restore, urls, tab, at })`, 옮기기 `takeTab`·`putTab`·`moveToWindow`, 떼어 내기 `tear(tab, x, y)`(`inStrip`으로 놓을 창). 저장은 보통 창만, 끝낼 때 `keepAll()`.
- 비공개 창: `privateSession()`(메모리 파티션 `rove-private-<시각>`, 막기·권한·내려받기·맞춤법을 같이 붙임), 권한 답은 `privGrants`(`gr()`), 마지막 비공개 창이 닫히면 `endPrivate()`.
- 시험 때(`ROVE_TEST`)는 네이티브 메뉴를 띄우지 않고 `R.lastMenu`에 항목만 남겨요(시험하는 사람 화면에 뜨지 않게).
- 탭 오른쪽 클릭은 네이티브 메뉴(`tabItems()`), 탭 소리는 `audio-state-changed`·`setAudioMuted`, 끌어 옮기기는 `moveTab()`.
- 내려받기는 내려받기 폴더에 바로, 같은 이름이면 `이름 (1).확장자`.
- RobinPass: 금고는 메인 프로세스에만, 서버와는 따로 된 메모리 세션(`rove-pass`)으로만 말해요. 비밀번호는 우리 화면에 가지 않고 페이지의 떨어진 세계(1001)나 클립보드로만, 클립보드는 30초 뒤·닫을 때 지워요. 시험 때만 `ROVE_PASS_SERVER`(https://localhost의 인증서 허용)와 `ROVE_CLIP_MS`.
- 데이터: `%LOCALAPPDATA%\Rove`(`pass.json`, `history.json`, `bookmarks.json`, `downloads.json`, `tabs.json`, `window.json`, `profile\`).

## 시험

```
node test/drive.mjs <steps.mjs>
```

Rove를 `ROVE_TEST=1`로 켜요. 소리 표시를 보려면 `ROVE_TEST_SOUND=1`(전체 음소거를 끔 — 탭을 먼저 음소거하거나 들리지 않는 소리만). 창은 그려지지만 투명도 0이고, 클릭이 통과하고, 작업 표시줄에도 안 나와요. 소리는 꺼지고, 프로필과 내려받기는 임시 폴더에 두었다가 끝나면 지워요. 시험은 `--inspect`로 메인 프로세스에 붙어서 `globalThis.__rove`(시험 때만 있음)로 움직여요. `R.shot(파일)`은 세 뷰를 한 장으로 합쳐 찍어요.

```js
// steps.mjs
export default [
  { wait: 2500, js: "return R.snapshot()" },
  { js: "R.go('https://example.com/'); return 1" },
  { wait: 2000, js: "return await R.shot('C:/temp/a.png')" },
];
```

`ROVE_START=<주소>`는 첫 탭이고, `ROVE_EXE=<Rove.exe>`면 묶은 exe로 시험해요.

## 라이선스

GPL-3.0만([LICENSE](LICENSE)). Copyright (C) 2026 Yoon-robin. 함께 쓰는 남의 것과 그 라이선스는 [THIRD-PARTY.md](THIRD-PARTY.md)에 있어요.
