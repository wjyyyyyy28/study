$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$tokenPath = Join-Path $projectRoot "github-token.txt"

Write-Host "研途 GitHub 发布授权"
Write-Host "-------------------"
Write-Host "请粘贴仅限 wjyyyyyy28/study 仓库的 GitHub Token。"
Write-Host "输入内容不会显示，也不会发送到聊天中。"
$secureToken = Read-Host "GitHub Token" -AsSecureString

$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}

if ($token.Length -lt 20) {
  throw "Token 格式不正确，请重新生成后再试。"
}

Set-Content -LiteralPath $tokenPath -Value $token -NoNewline
Write-Host ""
Write-Host "授权信息已安全保存到项目目录。可以关闭此窗口。"
Write-Host "发布完成后，令牌文件会自动删除。"
Start-Sleep -Seconds 3
