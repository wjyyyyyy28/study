param(
  [string]$Url = "https://wjyyyyyy28.github.io/study/"
)

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$iconPath = Join-Path $projectRoot "icons\icon-512.png"
$outputPath = Join-Path $projectRoot "release\研途-iPhone安装.mobileconfig"

if (-not (Test-Path -LiteralPath $iconPath)) {
  throw "App icon not found: $iconPath"
}
if ($Url -notmatch '^https://') {
  throw "The Web Clip URL must use HTTPS."
}

New-Item -ItemType Directory -Force -Path (Split-Path $outputPath) | Out-Null
$iconBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($iconPath))
$webClipUuid = "A84D27BF-D37A-47CA-A0F1-8F33F72424A2"
$profileUuid = "07F58C37-D2E6-4E43-8399-A5461A9AD831"

$profile = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>Icon</key>
      <data>$iconBase64</data>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>研途</string>
      <key>PayloadDescription</key>
      <string>将研途考研学习打卡添加到 iPhone 主屏幕。</string>
      <key>PayloadDisplayName</key>
      <string>研途 Web Clip</string>
      <key>PayloadIdentifier</key>
      <string>com.yantu.study.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>$webClipUuid</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>URL</key>
      <string>$Url</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>安装后会创建研途学习打卡的桌面图标。</string>
  <key>PayloadDisplayName</key>
  <string>研途 iPhone 安装文件</string>
  <key>PayloadIdentifier</key>
  <string>com.yantu.study.webclip.profile</string>
  <key>PayloadOrganization</key>
  <string>研途</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>$profileUuid</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
"@

[System.IO.File]::WriteAllText($outputPath, $profile, [System.Text.UTF8Encoding]::new($false))
Get-Item -LiteralPath $outputPath | Select-Object FullName, Length, LastWriteTime
