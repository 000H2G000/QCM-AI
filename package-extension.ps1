# PowerShell script to package the Chrome extension

# Define which files to include in the package
$filesToInclude = @(
    "manifest.json",
    "background.js",
    "content.js",
    "popup.html",
    "popup.js",
    "history.html",
    "notes.html",
    "README.md",
    "assets\icon16.png",
    "assets\icon48.png",
    "assets\icon128.png"
)

# Create a temporary directory for the package
$tempDir = ".\temp_package"
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Path $tempDir | Out-Null
New-Item -ItemType Directory -Path "$tempDir\assets" | Out-Null

# Copy files to the temp directory
foreach ($file in $filesToInclude) {
    $destPath = Join-Path $tempDir $file
    $srcPath = $file
    
    # Create directory if it doesn't exist
    $destDir = Split-Path -Parent $destPath
    if (!(Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir | Out-Null
    }
    
    # Copy the file
    Copy-Item $srcPath $destPath -Force
}

# Create the zip file
$zipFileName = "qcm-helper-extension.zip"
if (Test-Path $zipFileName) {
    Remove-Item $zipFileName -Force
}

Add-Type -Assembly System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $zipFileName)

# Clean up
Remove-Item -Recurse -Force $tempDir

Write-Host "Extension packaged successfully as $zipFileName"
Write-Host ""
Write-Host "Installation instructions:"
Write-Host "1. Extract the zip file"
Write-Host "2. Open Chrome or Edge and go to the extensions page (chrome://extensions/ or edge://extensions/)"
Write-Host "3. Enable Developer mode"
Write-Host "4. Click 'Load unpacked' and select the extracted folder"
Write-Host "" 