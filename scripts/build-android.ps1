param(
  [string]$AndroidSdk = $env:ANDROID_HOME,
  [string]$JdkRoot = $env:JAVA_HOME
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$AndroidProject = Join-Path $ProjectRoot "android"
$BuildRoot = Join-Path $ProjectRoot ".android-build"
$OutputRoot = Join-Path $ProjectRoot "release"
$AsciiBuildRoot = Join-Path $env:PUBLIC "YantuBuild"
$WorkRoot = Join-Path $AsciiBuildRoot "work"
$ReleaseRoot = Join-Path $AsciiBuildRoot "release"
$Stage = Join-Path $WorkRoot "stage"
$StagedAndroid = Join-Path $WorkRoot "android-project"
$Assets = Join-Path $Stage "assets"
$WebAssets = Join-Path $Assets "www"
$Generated = Join-Path $WorkRoot "generated"
$Classes = Join-Path $WorkRoot "classes"
$Dex = Join-Path $WorkRoot "dex"
$UnsignedApk = Join-Path $WorkRoot "yantu-unsigned.apk"
$AlignedApk = Join-Path $WorkRoot "yantu-aligned.apk"
$FinalApk = Join-Path $ReleaseRoot "研途-1.0.0.apk"

if (-not $AndroidSdk -or -not (Test-Path -LiteralPath $AndroidSdk)) {
  throw "Android SDK not found. Set ANDROID_HOME or pass -AndroidSdk."
}

if (-not $JdkRoot -or -not (Test-Path -LiteralPath $JdkRoot)) {
  throw "JDK not found. Set JAVA_HOME or pass -JdkRoot."
}

$BuildTools = Get-ChildItem -LiteralPath (Join-Path $AndroidSdk "build-tools") -Directory |
  Sort-Object { [version]$_.Name } -Descending |
  Select-Object -First 1
$Platform = Get-ChildItem -LiteralPath (Join-Path $AndroidSdk "platforms") -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1

if (-not $BuildTools -or -not $Platform) {
  throw "Android build-tools or platform is missing."
}

$Aapt = Join-Path $BuildTools.FullName "aapt.exe"
$ZipAlign = Join-Path $BuildTools.FullName "zipalign.exe"
$ApkSigner = Join-Path $BuildTools.FullName "apksigner.bat"
$AndroidJar = Join-Path $Platform.FullName "android.jar"
$Javac = Join-Path $JdkRoot "bin\javac.exe"
$KeyTool = Join-Path $JdkRoot "bin\keytool.exe"
$D8 = Join-Path $BuildTools.FullName "d8.bat"

$requiredTools = @($Aapt, $ZipAlign, $ApkSigner, $AndroidJar, $Javac, $KeyTool, $D8)
foreach ($tool in $requiredTools) {
  if (-not (Test-Path -LiteralPath $tool)) {
    throw "Required build tool not found: $tool"
  }
}

if (Test-Path -LiteralPath $AsciiBuildRoot) {
  Remove-Item -LiteralPath $AsciiBuildRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $AsciiBuildRoot, $Stage, $WebAssets, $Generated, $Classes, $Dex, $ReleaseRoot, $OutputRoot | Out-Null
Copy-Item -LiteralPath $AndroidProject -Destination $StagedAndroid -Recurse

$webFiles = @(
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js"
)
foreach ($file in $webFiles) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot $file) -Destination (Join-Path $WebAssets $file)
}
Copy-Item -LiteralPath (Join-Path $ProjectRoot "icons") -Destination (Join-Path $WebAssets "icons") -Recurse

$Manifest = Join-Path $StagedAndroid "AndroidManifest.xml"
$Resources = Join-Path $StagedAndroid "res"
$JavaRoot = Join-Path $StagedAndroid "java"
$MainActivity = Join-Path $JavaRoot "com\yantu\study\MainActivity.java"
$AsciiAndroidJar = Join-Path $WorkRoot "android.jar"
Copy-Item -LiteralPath $AndroidJar -Destination $AsciiAndroidJar -Force

& $Aapt package -f -m -J $Generated -M $Manifest -S $Resources -I $AsciiAndroidJar
if ($LASTEXITCODE -ne 0) { throw "Resource generation failed." }

$RJava = Join-Path $Generated "com\yantu\study\R.java"
$JavaSources = @($MainActivity)
if (Test-Path -LiteralPath $RJava) {
  $JavaSources += $RJava
}

& $Javac -encoding UTF-8 -source 8 -target 8 -classpath $AsciiAndroidJar -d $Classes $JavaSources
if ($LASTEXITCODE -ne 0) { throw "Java compilation failed." }

$ClassFiles = Get-ChildItem -LiteralPath $Classes -Recurse -Filter "*.class" | Select-Object -ExpandProperty FullName
if (-not $ClassFiles) { throw "No compiled Java classes found." }

& $D8 --release --lib $AsciiAndroidJar --output $Dex $ClassFiles
if ($LASTEXITCODE -ne 0) { throw "DEX compilation failed." }

& $Aapt package -f -M $Manifest -S $Resources -I $AsciiAndroidJar -A $Assets -F $UnsignedApk
if ($LASTEXITCODE -ne 0) { throw "Android resource packaging failed." }

Push-Location $Dex
try {
  & $Aapt add $UnsignedApk "classes.dex"
  if ($LASTEXITCODE -ne 0) { throw "Adding classes.dex failed." }
} finally {
  Pop-Location
}

& $ZipAlign -f -p 4 $UnsignedApk $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "APK alignment failed." }

$KeyStore = Join-Path $ReleaseRoot "yantu-release.keystore"
$PasswordFile = Join-Path $ReleaseRoot "keystore-password.txt"
$StorePassword = if (Test-Path -LiteralPath $PasswordFile) {
  (Get-Content -LiteralPath $PasswordFile -Raw).Trim()
} else {
  $generatedPassword = [Guid]::NewGuid().ToString("N")
  Set-Content -LiteralPath $PasswordFile -Value $generatedPassword -NoNewline
  $generatedPassword
}

if (-not (Test-Path -LiteralPath $KeyStore)) {
  & $KeyTool -genkeypair `
    -keystore $KeyStore `
    -storepass $StorePassword `
    -keypass $StorePassword `
    -alias "yantu" `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname "CN=Yantu Study, OU=Mobile, O=Yantu, L=Shanghai, ST=Shanghai, C=CN"
  if ($LASTEXITCODE -ne 0) { throw "Signing key generation failed." }
}

& $ApkSigner sign `
  --ks $KeyStore `
  --ks-key-alias "yantu" `
  --ks-pass "pass:$StorePassword" `
  --key-pass "pass:$StorePassword" `
  --out $FinalApk `
  $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "APK signing failed." }

& $ApkSigner verify --verbose $FinalApk
if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed." }

Write-Host "APK created: $FinalApk"
$PublishedApk = Join-Path $OutputRoot "研途-1.0.0.apk"
Copy-Item -LiteralPath $FinalApk -Destination $PublishedApk -Force
Copy-Item -LiteralPath $KeyStore -Destination (Join-Path $OutputRoot "yantu-release.keystore") -Force
Copy-Item -LiteralPath $PasswordFile -Destination (Join-Path $OutputRoot "keystore-password.txt") -Force
Get-Item -LiteralPath $PublishedApk | Select-Object FullName, Length, LastWriteTime
