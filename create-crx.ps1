# PowerShell script to create CRX file from Chrome extension
# This creates a CRX file using Chrome's built-in packaging

param(
    [string]$ChromePath = "",
    [string]$ExtensionDir = ".\build\chrome-mv3-prod",
    [string]$KeyFile = ".\key.pem",
    [string]$OutputFile = ".\cogix-eye-tracking.crx"
)

Write-Host "Chrome Extension CRX Creator" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Try to find Chrome if not specified
if (-not $ChromePath) {
    $possiblePaths = @(
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "${env:LocalAppData}\Google\Chrome\Application\chrome.exe",
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $ChromePath = $path
            Write-Host "Found Chrome at: $ChromePath" -ForegroundColor Green
            break
        }
    }
    
    if (-not $ChromePath) {
        Write-Host "Chrome not found. Please specify path with -ChromePath parameter" -ForegroundColor Red
        Write-Host "Example: .\create-crx.ps1 -ChromePath 'C:\Path\To\chrome.exe'" -ForegroundColor Yellow
        exit 1
    }
}

# Check if extension directory exists
if (-not (Test-Path $ExtensionDir)) {
    Write-Host "Extension directory not found: $ExtensionDir" -ForegroundColor Red
    Write-Host "Please run 'npm run build' first" -ForegroundColor Yellow
    exit 1
}

# Create absolute paths
$ExtensionDir = Resolve-Path $ExtensionDir
$OutputDir = Split-Path $OutputFile -Parent
if ($OutputDir -eq "") { $OutputDir = "." }
$OutputDir = Resolve-Path $OutputDir
$OutputFile = Join-Path $OutputDir (Split-Path $OutputFile -Leaf)

Write-Host "`nPackaging extension..." -ForegroundColor Yellow
Write-Host "Source: $ExtensionDir" -ForegroundColor Gray
Write-Host "Output: $OutputFile" -ForegroundColor Gray

# Build Chrome command
$arguments = @(
    "--pack-extension=`"$ExtensionDir`""
)

# Add key file if it exists (for consistent extension ID)
if (Test-Path $KeyFile) {
    $KeyFile = Resolve-Path $KeyFile
    $arguments += "--pack-extension-key=`"$KeyFile`""
    Write-Host "Using key file: $KeyFile" -ForegroundColor Gray
    Write-Host "Extension ID: ibpjidejooohhmkcpigmhnafnmkfbfmi" -ForegroundColor Cyan
} else {
    Write-Host "No key file found. A new key will be generated." -ForegroundColor Yellow
    Write-Host "The key file will be saved as: $ExtensionDir.pem" -ForegroundColor Yellow
}

# Run Chrome to create CRX
Write-Host "`nRunning Chrome packager..." -ForegroundColor Cyan
$process = Start-Process -FilePath $ChromePath -ArgumentList $arguments -NoNewWindow -PassThru -Wait

if ($process.ExitCode -eq 0) {
    # Chrome creates the CRX with the directory name
    $generatedCrx = "$ExtensionDir.crx"
    $generatedKey = "$ExtensionDir.pem"
    
    if (Test-Path $generatedCrx) {
        # Move to desired location
        if ($generatedCrx -ne $OutputFile) {
            Move-Item -Path $generatedCrx -Destination $OutputFile -Force
        }
        
        Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
        Write-Host "CRX file created: $OutputFile" -ForegroundColor Green
        
        # Get file size
        $fileInfo = Get-Item $OutputFile
        $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
        Write-Host "File size: $sizeMB MB" -ForegroundColor Cyan
        
        # Handle key file
        if ((Test-Path $generatedKey) -and (-not (Test-Path $KeyFile))) {
            Move-Item -Path $generatedKey -Destination $KeyFile -Force
            Write-Host "`n🔑 Key file saved: $KeyFile" -ForegroundColor Yellow
            Write-Host "IMPORTANT: Keep this key file safe! You need it to:" -ForegroundColor Yellow
            Write-Host "  - Maintain the same extension ID across updates" -ForegroundColor Yellow
            Write-Host "  - Sign future versions of your extension" -ForegroundColor Yellow
        }
        
        Write-Host "`n📋 Installation Instructions:" -ForegroundColor Cyan
        Write-Host "1. Open Chrome and go to: chrome://extensions/" -ForegroundColor White
        Write-Host "2. Enable 'Developer mode'" -ForegroundColor White
        Write-Host "3. Drag and drop the CRX file onto the page" -ForegroundColor White
        Write-Host "   OR" -ForegroundColor Gray
        Write-Host "   Click 'Load unpacked' and select the build folder" -ForegroundColor White
        
    } else {
        Write-Host "`n❌ ERROR: CRX file was not created" -ForegroundColor Red
        Write-Host "Check if Chrome has permission to write to this directory" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n❌ ERROR: Chrome packaging failed with exit code $($process.ExitCode)" -ForegroundColor Red
    Write-Host "Try running Chrome with administrator privileges" -ForegroundColor Yellow
}