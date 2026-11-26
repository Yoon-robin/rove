# powershell -File test/setup-close.ps1 [RoveSetup.exe]: installs the latest GitHub release into
# %TEMP% and closes the window (Alt+F4) while the zip comes in. Closing stops it the way
# 멈추기 does, so nothing may stay behind (before: the half-fetched <version>.zip.part did, and
# with no current or app-* there the uninstall did not know the folder). Needs GitHub.
# Build first: node setup/build.cjs
param([string]$exe = (Join-Path $PSScriptRoot '..\out\RoveSetup.exe'))
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$exe = (Resolve-Path $exe).Path
$root = Join-Path ([IO.Path]::GetTempPath()) ('rove-setup-test-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$h = Join-Path $root 'Rove'
$p = Start-Process -PassThru $exe -ArgumentList "--home `"$h`" --links-to `"$(Join-Path $root 'links')`" --no-open --go"
# close once the zip is coming in (and before it is all there)
$part = $null
for ($i = 0; $i -lt 300 -and -not $p.HasExited; $i++) {
  Start-Sleep -Milliseconds 100
  $part = Get-ChildItem $h -Filter '*.zip.part' -ErrorAction SilentlyContinue | Where-Object Length -gt 5MB | Select-Object -First 1
  if ($part) { break }
}
if (-not $part) { Write-Host '받기가 시작되지 않았어요(GitHub?)'; if (-not $p.HasExited) { $p.Kill() }; Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue; exit 1 }
$w = New-Object -ComObject WScript.Shell
$null = $w.AppActivate($p.Id); Start-Sleep -Milliseconds 200
$w.SendKeys('%{F4}')
$p.WaitForExit(60000) | Out-Null
Start-Sleep -Milliseconds 1000
$left = @(Get-ChildItem $h -Force -ErrorAction SilentlyContinue | ForEach-Object Name)
$ok = $p.HasExited -and $left.Count -eq 0
Write-Host ("  받는 중 Alt+F4: {0}  (닫을 때 {1} MB, 남은 것 {2})" -f $(if ($ok) { 'ok' } else { '실패' }), [math]::Round($part.Length / 1MB), $(if ($left) { $left -join ',' } else { '없음' }))
if (-not $p.HasExited) { $p.Kill() }
Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
if (-not $ok) { exit 1 }
