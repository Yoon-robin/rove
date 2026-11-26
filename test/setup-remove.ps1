# powershell -File test/setup-remove.ps1 [RoveSetup.exe]: RoveSetup --uninstall on a made-up
# install in %TEMP%, with Esc and then Alt+F4 pressed while it removes. Removing can't stop
# half-way, so both must leave it running to the end: exit code 0, current and app-* gone,
# the profile kept. (Before: Esc threw NullReferenceException, Alt+F4 closed it half-done.)
# Build first: node setup/build.cjs
param([string]$exe = (Join-Path $PSScriptRoot '..\out\RoveSetup.exe'))
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$exe = (Resolve-Path $exe).Path
$failed = 0
foreach ($key in @('{ESC}', '%{F4}')) {
  $root = Join-Path ([IO.Path]::GetTempPath()) ('rove-setup-test-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  $h = Join-Path $root 'Rove'
  $app = Join-Path $h 'app-9.9.9-test'
  New-Item -ItemType Directory -Force -Path $app, (Join-Path $h 'profile') | Out-Null
  Set-Content (Join-Path $app 'Rove.exe') 'x'
  1..200 | ForEach-Object { Set-Content (Join-Path $app "f$_.txt") ('y' * 1000) }
  cmd /c mklink /J "$(Join-Path $h 'current')" "$app" | Out-Null
  Set-Content (Join-Path $h 'profile\History') 'keep'
  # --after: the first step waits for this process (up to 10 s), so the key lands while it removes
  $sleeper = Start-Process -PassThru -WindowStyle Hidden ping -ArgumentList '-n 6 127.0.0.1'
  $p = Start-Process -PassThru $exe -ArgumentList "--uninstall --home `"$h`" --no-links --go --after $($sleeper.Id)"
  Start-Sleep -Milliseconds 2500
  $w = New-Object -ComObject WScript.Shell
  if (-not $w.AppActivate($p.Id)) { Write-Host "  $key : 창을 앞으로 못 가져왔어요"; $failed++ }
  Start-Sleep -Milliseconds 300
  $w.SendKeys($key)
  Start-Sleep -Milliseconds 800
  $alive = -not $p.HasExited
  $p.WaitForExit(30000) | Out-Null
  $left = @(Get-ChildItem $h -Force -ErrorAction SilentlyContinue | ForEach-Object Name)
  $ok = $alive -and $p.HasExited -and $p.ExitCode -eq 0 -and ($left -join ',') -eq 'profile'
  Write-Host ("  {0,-6} {1}  (누른 뒤 살아 있음 {2}, 종료 코드 {3}, 남은 것 {4})" -f $key, $(if ($ok) { 'ok' } else { '실패' }), $alive, $p.ExitCode, ($left -join ','))
  if (-not $ok) { $failed++ }
  if (-not $p.HasExited) { $p.Kill() }
  cmd /c rmdir /s /q "$root"
}
if ($failed) { Write-Host "실패 $failed"; exit 1 }
Write-Host '지우는 중 Esc·Alt+F4: 끝까지 지워요'
