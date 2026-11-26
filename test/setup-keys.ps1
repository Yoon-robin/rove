# powershell -File test/setup-keys.ps1 [RoveSetup.exe]: the setup window through UI Automation, as
# a screen reader and the keyboard meet it. Every focusable button has a name, Tab goes in the order
# the eye reads (× top right, the cards, then 닫기 and the blue button), and the remove window opens
# on 닫기. (Before: × had no name, Tab went to the bottom buttons before the cards, and the remove
# window opened with focus on nothing.) The windows show on screen for a few seconds.
# Build first: node setup/build.cjs
param([string]$exe = (Join-Path $PSScriptRoot '..\out\RoveSetup.exe'))
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$A = [System.Windows.Automation.AutomationElement]
$exe = (Resolve-Path $exe).Path
$root = Join-Path ([IO.Path]::GetTempPath()) ('rove-setup-test-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path (Join-Path $root 'Rove\app-9.9.9-test') | Out-Null
$failed = 0

function Look([string]$argsLine, [string[]]$cycle, [string]$first) {
  $p = Start-Process -PassThru $exe -ArgumentList $argsLine
  $win = $null
  for ($i = 0; $i -lt 50 -and -not $win; $i++) {
    Start-Sleep -Milliseconds 200
    $win = $A::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children, (New-Object System.Windows.Automation.PropertyCondition($A::ProcessIdProperty, $p.Id)))
  }
  Start-Sleep -Milliseconds 2500   # the install window asks GitHub for latest.json first
  $bad = @()
  foreach ($e in $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)) {
    if ($e.Current.IsKeyboardFocusable -and -not $e.Current.Name) { $bad += $e.Current.ControlType.ProgrammaticName }
  }
  $w = New-Object -ComObject WScript.Shell
  $null = $w.AppActivate($p.Id); Start-Sleep -Milliseconds 300
  $at = $A::FocusedElement.Current.Name
  $seen = @()
  for ($i = 0; $i -lt $cycle.Count * 2 + 2; $i++) { $w.SendKeys('{TAB}'); Start-Sleep -Milliseconds 120; $seen += $A::FocusedElement.Current.Name }
  $p.Kill()
  # the cycle as Tab went round it, from its 창 닫기 (a disabled 설치, with no GitHub, drops out)
  $from = [Array]::IndexOf($seen, $cycle[0])
  $got = @(); if ($from -ge 0) { $got = $seen[$from..($from + $cycle.Count - 1)] | Where-Object { $_ } }
  $want = $cycle; if ($got -notcontains '설치') { $want = @($cycle | Where-Object { $_ -ne '설치' }); $got = @($got[0..($want.Count - 1)]) }
  $ok = $bad.Count -eq 0 -and ($got -join ' > ') -eq ($want -join ' > ') -and (-not $first -or $at -eq $first)
  Write-Host ("  {0}: {1}" -f $(if ($ok) { 'ok' } else { '실패' }), ($got -join ' > '))
  if ($first) { Write-Host "     처음 초점: $at" }
  if ($bad) { Write-Host "     이름 없음: $($bad -join ', ')" }
  return $ok
}

if (-not (Look "--home `"$(Join-Path $root 'new')`" --no-links --no-open" @('창 닫기', '바탕화면 바로가기', '시작 메뉴 바로가기', '끝나면 Rove 켜기', '닫기', '설치') $null)) { $failed++ }
if (-not (Look "--uninstall --home `"$(Join-Path $root 'Rove')`" --no-links" @('창 닫기', '방문 기록·즐겨찾기·로그인도 지우기', '닫기', '지우기') '닫기')) { $failed++ }
Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
if ($failed) { Write-Host "실패 $failed"; exit 1 }
Write-Host '설치·지우기 창: 이름, Tab 순서, 처음 초점'
