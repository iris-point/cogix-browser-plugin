# CRX File Creation Guide

## What is a CRX File?

A CRX file is a Chrome Extension package format that:
- Contains all extension files in a compressed, signed format
- Can be distributed outside the Chrome Web Store
- Maintains a consistent extension ID when signed with the same key
- Allows offline installation

## 🚀 Quick Start

### Method 1: Automated Script (Recommended)

#### Windows Batch File:
```bash
# Build the extension first
npm run build

# Create CRX file
create-crx.bat
```

#### PowerShell Script:
```powershell
# Build the extension first
npm run build

# Create CRX file
.\create-crx.ps1
```

The script will:
1. Find Chrome automatically
2. Create a CRX file from the production build
3. Generate/use a private key for signing
4. Output `cogix-eye-tracking.crx`

### Method 2: Manual Chrome Method

1. **Open Chrome**
2. **Navigate to:** `chrome://extensions/`
3. **Enable:** Developer mode
4. **Click:** "Pack extension"
5. **Browse to:** `cogix-browser-plugin\build\chrome-mv3-prod`
6. **Private key:** Leave blank for first time (or browse to existing `key.pem`)
7. **Click:** "Pack Extension"

This creates:
- `chrome-mv3-prod.crx` - The extension package
- `chrome-mv3-prod.pem` - Private key (KEEP SAFE!)

### Method 3: Command Line

```bash
# Windows - adjust path to your Chrome installation
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --pack-extension="G:\TALEMONK\cogix\cogix-browser-plugin\build\chrome-mv3-prod"

# With existing key (for updates)
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --pack-extension="G:\TALEMONK\cogix\cogix-browser-plugin\build\chrome-mv3-prod" ^
  --pack-extension-key="G:\TALEMONK\cogix\cogix-browser-plugin\key.pem"
```

## 🔑 Private Key Management

### First Time Packaging
- Chrome generates a new private key (`key.pem`)
- This creates a unique extension ID
- **SAVE THE KEY FILE!** You need it for updates

### Subsequent Packaging
- Use the same `key.pem` file
- Maintains the same extension ID
- Users can update without reinstalling

### Key Security
```bash
# Backup your key
copy key.pem key.pem.backup

# Never commit to git - add to .gitignore
echo "key.pem" >> .gitignore
echo "*.crx" >> .gitignore
```

## 📦 Distribution Options

### 1. Direct CRX Distribution

**Pros:**
- Full control over distribution
- No Chrome Web Store review
- Private/internal distribution

**Cons:**
- Chrome shows security warnings
- Users must enable developer mode
- No automatic updates (unless you set up update URL)

**Installation Steps for Users:**
1. Download the `.crx` file
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode"
4. Drag the `.crx` file onto the page
5. Click "Add extension" in the dialog

### 2. Self-Hosted Updates

Create an update manifest for automatic updates:

**updates.xml:**
```xml
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='YOUR_EXTENSION_ID'>
    <updatecheck codebase='https://yourserver.com/cogix-eye-tracking.crx' 
                 version='1.0.0' />
  </app>
</gupdate>
```

Add to manifest.json:
```json
"update_url": "https://yourserver.com/updates.xml"
```

### 3. Enterprise Distribution

For corporate environments:
- Use Google Admin Console
- Deploy via Group Policy
- No developer mode required
- Centralized management

## ⚠️ Important Limitations

### Chrome Security Policies

Starting from Chrome 117+:
- CRX files from outside Chrome Web Store show warnings
- Users must explicitly enable in developer mode
- Some enterprise policies may block installation

### Workarounds:
1. **Chrome Web Store:** Best for public distribution
2. **Enterprise Policy:** For corporate deployments
3. **Developer Mode:** For testing and internal use
4. **Unpacked Extension:** For development

## 🛠️ Troubleshooting

### "CRX_REQUIRED_PROOF_MISSING" Error
- **Cause:** Chrome's security policy
- **Fix:** Enable developer mode or use enterprise policy

### "Package is invalid" Error
- **Cause:** Corrupted CRX or wrong Chrome version
- **Fix:** Rebuild and repackage the extension

### Extension ID Changes
- **Cause:** Different private key used
- **Fix:** Always use the same `key.pem` file

### Installation Blocked
- **Cause:** Enterprise policy or Chrome settings
- **Fix:** Check chrome://policy for restrictions

## 📋 File Structure

After creating a CRX:
```
cogix-browser-plugin/
├── build/
│   ├── chrome-mv3-prod/      # Source files
│   └── chrome-mv3-prod.zip    # ZIP package
├── cogix-eye-tracking.crx     # Signed package
├── key.pem                    # Private key (KEEP SAFE!)
├── create-crx.bat             # Windows batch script
└── create-crx.ps1             # PowerShell script
```

## 🔄 Version Updates

When releasing updates:

1. **Update version** in `package.json`
2. **Build:** `npm run build`
3. **Package with same key:**
   ```bash
   create-crx.bat
   # OR
   .\create-crx.ps1 -KeyFile .\key.pem
   ```
4. **Distribute** new CRX file
5. Users with the extension will see update notification

## 🎯 Best Practices

1. **Always keep your private key secure**
   - Store in secure location
   - Never share or commit to git
   - Make backups

2. **Version management**
   - Follow semantic versioning
   - Update manifest version for each release
   - Keep changelog

3. **Testing**
   - Test CRX in clean Chrome profile
   - Verify all features work
   - Check for console errors

4. **Distribution**
   - Provide clear installation instructions
   - Include troubleshooting guide
   - Consider Chrome Web Store for public release

## 📚 References

- [Chrome Extension Packaging](https://developer.chrome.com/docs/extensions/mv3/hosting/)
- [CRX File Format](https://developer.chrome.com/docs/extensions/mv3/hosting/#packaging)
- [Enterprise Deployment](https://support.google.com/chrome/a/answer/9296680)
- [Alternative Distribution](https://developer.chrome.com/docs/extensions/mv3/hosting/#alternative)