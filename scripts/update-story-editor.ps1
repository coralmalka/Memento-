$ErrorActionPreference = 'Stop'
if (!(Test-Path 'App.js') -or !(Test-Path 'package.json')) {
  throw 'Open this command window INSIDE your Memento-main folder (the folder containing App.js), then run again.'
}
$package = Get-Content 'package.json' -Raw | ConvertFrom-Json
if ($package.name -ne 'memento-social') { throw 'This is not the Memento project folder.' }
$root = (Get-Location).Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stage = Join-Path $env:TEMP "memento-stories-$stamp"
$backup = Join-Path $root "story-update-backup-$stamp"
$files = @('App.js','components/StoryPhotoEditor.js','components/CloseFriendsPicker.js','lib/storyEdits.js','lib/media.js','lib/music.js','package.json','package-lock.json','scripts/check-js-syntax.cjs','scripts/test-stories.cjs','supabase/memento_story_editor_close_friends_20261115.sql','MEMENTO_STORY_SETUP.md')
# Resolve one commit before downloading so an update cannot mix revisions.
$headers = @{ 'User-Agent' = 'Memento-Story-Updater' }
$head = Invoke-RestMethod -Uri 'https://api.github.com/repos/coralmalka/Memento-/commits/main' -Headers $headers
$revision = $head.sha
New-Item -ItemType Directory -Force -Path $stage | Out-Null
foreach ($file in $files) {
  $destination = Join-Path $stage $file
  New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
  Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/coralmalka/Memento-/$revision/$file" -OutFile $destination
}
# Download everything successfully before replacing any project files.
foreach ($file in $files) {
  $destination = Join-Path $root $file
  if (Test-Path $destination) {
    $saved = Join-Path $backup $file
    New-Item -ItemType Directory -Force -Path (Split-Path $saved) | Out-Null
    Copy-Item $destination $saved
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
  Copy-Item (Join-Path $stage $file) $destination -Force
}
Write-Host "Updated Memento story editor. Your previous files are in $backup" -ForegroundColor Green
Write-Host 'Installing the versions in this update...'
& npm.cmd install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm install did not finish. Your backup is safe. Send the error before starting Expo.' }
& npm.cmd run check:syntax
if ($LASTEXITCODE -ne 0) { throw 'Syntax check failed. Send the error before starting Expo.' }
$sqlPath = Join-Path $root 'supabase/memento_story_editor_close_friends_20261115.sql'
Get-Content $sqlPath -Raw | Set-Clipboard
Write-Host 'Close Friends SQL is copied to your clipboard. Paste it into Supabase > SQL Editor > New query and click Run.' -ForegroundColor Cyan
Write-Host 'After the SQL succeeds, run: npx expo start -c' -ForegroundColor Green
