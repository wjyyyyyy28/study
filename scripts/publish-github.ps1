param(
  [string]$Owner = "wjyyyyyy28",
  [string]$Repository = "study"
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::CheckCertificateRevocationList = $false

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$tokenPath = Join-Path $projectRoot "github-token.txt"
$token = $env:GITHUB_TOKEN
if (-not $token -and (Test-Path -LiteralPath $tokenPath)) {
  $token = (Get-Content -LiteralPath $tokenPath -Raw).Trim()
}
if (-not $token) {
  throw "Missing GitHub token. Save a fine-grained token in github-token.txt."
}

$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent" = "Yantu-Publisher"
}
$apiRoot = "https://api.github.com/repos/$Owner/$Repository"

function Invoke-GitHub {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null
  )
  $parameters = @{
    Method = $Method
    Uri = $Uri
    Headers = $headers
    UseBasicParsing = $true
  }
  if ($null -ne $Body) {
    $parameters.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
    $parameters.ContentType = "application/json"
  }
  try {
    return Invoke-RestMethod @parameters
  } catch {
    $message = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $message = $_.ErrorDetails.Message
    }
    throw "GitHub API request failed: $message"
  }
}

$repositoryInfo = Invoke-GitHub -Method Get -Uri $apiRoot
if ($repositoryInfo.private) {
  throw "The repository must be public for GitHub Pages."
}

$files = @(
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
  "serve.mjs",
  "package.json",
  "README.md",
  "LICENSE",
  "安装说明.txt",
  "研途-双端安装包.zip",
  ".gitignore",
  "preview-today.png",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "downloads/Yantu-1.0.0.apk",
  "downloads/yantu-ios.mobileconfig"
)

$treeEntries = @()
foreach ($relativePath in $files) {
  $absolutePath = Join-Path $projectRoot $relativePath
  if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
    throw "Missing file: $relativePath"
  }
  $content = [System.IO.File]::ReadAllBytes($absolutePath)
  $blob = Invoke-GitHub -Method Post -Uri "$apiRoot/git/blobs" -Body @{
    content = [Convert]::ToBase64String($content)
    encoding = "base64"
  }
  $treeEntries += @{
    path = $relativePath.Replace("\", "/")
    mode = "100644"
    type = "blob"
    sha = $blob.sha
  }
}

$treeEntries += @{
  path = ".nojekyll"
  mode = "100644"
  type = "blob"
  sha = (Invoke-GitHub -Method Post -Uri "$apiRoot/git/blobs" -Body @{
    content = ""
    encoding = "utf-8"
  }).sha
}

$tree = Invoke-GitHub -Method Post -Uri "$apiRoot/git/trees" -Body @{
  tree = $treeEntries
}

$commit = Invoke-GitHub -Method Post -Uri "$apiRoot/git/commits" -Body @{
  message = "feat: release Yantu postgraduate study check-in app"
  tree = $tree.sha
  parents = @()
}

Invoke-GitHub -Method Post -Uri "$apiRoot/git/refs" -Body @{
  ref = "refs/heads/main"
  sha = $commit.sha
} | Out-Null

try {
  Invoke-GitHub -Method Post -Uri "$apiRoot/pages" -Body @{
    build_type = "legacy"
    source = @{
      branch = "main"
      path = "/"
    }
  } | Out-Null
} catch {
  if ($_.Exception.Message -notmatch "409|409") {
    throw
  }
}

try {
  Invoke-GitHub -Method Patch -Uri $apiRoot -Body @{
    description = "研途：为考研人设计的每日学习计时、打卡与目标追踪 PWA。"
    homepage = "https://$Owner.github.io/$Repository/"
    topics = @("pwa", "study", "postgraduate", "check-in", "education")
  } | Out-Null
} catch {
  Write-Warning "Repository metadata update was skipped."
}

if (Test-Path -LiteralPath $tokenPath) {
  Remove-Item -LiteralPath $tokenPath -Force
}

Write-Host "Published: https://github.com/$Owner/$Repository"
Write-Host "Fixed URL: https://$Owner.github.io/$Repository/"
