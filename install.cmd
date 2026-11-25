@echo off
chcp 65001 >nul
rem Rove 설치: 아래 PowerShell 부분을 실행해요 (더블클릭해서 쓰는 파일)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = [IO.File]::ReadAllText('%~f0', [Text.Encoding]::UTF8); iex ($t.Substring($t.IndexOf('#' + 'PSSTART')))"
echo.
pause
exit /b

#PSSTART
# Rove를 이 PC에 넣어요: GitHub 릴리스(Yoon-robin/rove)의 최신 버전을 받아 sha256을 맞춰 보고
# %LOCALAPPDATA%\Rove\app-<버전>에 풀고, current 연결과 바로가기(바탕화면·시작 메뉴)를 만들어요.
# 그다음부터는 Rove가 알아서 새 버전을 받아요(update.cjs, 릴리스 키 서명까지 확인).
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base = 'https://github.com/Yoon-robin/rove/releases/latest/download/'
$home_ = Join-Path $env:LOCALAPPDATA 'Rove'
New-Item -ItemType Directory -Force -Path $home_ | Out-Null

Write-Host ''
Write-Host '  Rove 설치' -ForegroundColor Cyan
Write-Host '  ---------'
try { $latest = Invoke-RestMethod -UseBasicParsing -Uri ($base + 'latest.json') -TimeoutSec 30 }
catch { Write-Host '  GitHub에 닿지 않아요.' -ForegroundColor Red; exit 1 }
if ($latest.version -notmatch '^[0-9A-Za-z][\w.-]{0,79}$' -or $latest.file -notmatch '^[0-9A-Za-z][\w.-]{0,79}$' -or $latest.sha256 -notmatch '^[0-9a-f]{64}$') {
  Write-Host '  latest.json이 이상해요.' -ForegroundColor Red; exit 1
}
$to = Join-Path $home_ ('app-' + $latest.version)
if (-not (Test-Path (Join-Path $to 'Rove.exe'))) {
  $zip = Join-Path $home_ ($latest.version + '.zip.part')
  Write-Host ('  Rove ' + $latest.version + ' 받는 중 (' + [math]::Round($latest.size / 1MB) + ' MB)')
  $ProgressPreference = 'SilentlyContinue'
  try { Invoke-WebRequest -UseBasicParsing -Uri ($base + $latest.file) -OutFile $zip -TimeoutSec 1800 }
  catch { if (Test-Path $zip) { Remove-Item $zip }; Write-Host '  받지 못했어요.' -ForegroundColor Red; exit 1 }
  if ((Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower() -ne $latest.sha256) { Remove-Item $zip; Write-Host '  받은 파일이 깨졌어요(sha256이 달라요).' -ForegroundColor Red; exit 1 }
  $tmp = $to + '.tmp'
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  New-Item -ItemType Directory -Path $tmp | Out-Null
  & "$env:SystemRoot\System32\tar.exe" -xf $zip -C $tmp
  Remove-Item $zip
  if (-not (Test-Path (Join-Path $tmp 'Rove.exe'))) { Write-Host '  풀지 못했어요.' -ForegroundColor Red; exit 1 }
  Rename-Item $tmp $to
}
$link = Join-Path $home_ 'current'
$next = Join-Path $home_ 'current.next'
if (Test-Path $next) { cmd /c rmdir "$next" }
cmd /c mklink /J "$next" "$to" | Out-Null
if (Test-Path $link) { cmd /c rmdir "$link" }
Rename-Item $next 'current'
$exe = Join-Path $link 'Rove.exe'
$w = New-Object -ComObject WScript.Shell
foreach ($p in @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))) {
  $s = $w.CreateShortcut((Join-Path $p 'Rove.lnk'))
  $s.TargetPath = $exe; $s.WorkingDirectory = $link; $s.IconLocation = "$exe,0"; $s.Description = 'Rove'; $s.Save()
}
Write-Host ('  넣었어요: Rove ' + $latest.version) -ForegroundColor Green
Start-Process $exe
