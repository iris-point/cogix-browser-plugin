# Build Commands Quick Reference

## 🚀 Quick Commands

### Development
```bash
npm run dev              # Start development server with hot reload
```

### Production Build
```bash
npm run build            # Build for production
npm run package          # Create ZIP file for Chrome Web Store
npm run package:crx      # Create CRX file for direct distribution
npm run package:all      # Build + ZIP + CRX (complete package)
```

## 📦 Output Files

After running build commands, you'll get:

| Command | Output | Location | Use Case |
|---------|---------|----------|----------|
| `npm run build` | Unpacked extension | `build/chrome-mv3-prod/` | Testing, Chrome Web Store |
| `npm run package` | ZIP file | `build/chrome-mv3-prod.zip` | Chrome Web Store submission |
| `npm run package:crx` | CRX file | `cogix-eye-tracking.crx` | Direct distribution |

## 🎯 Extension Details

- **Extension ID:** `ibpjidejooohhmkcpigmhnafnmkfbfmi`
- **Sync Host:** `https://cogix.app`
- **Clerk API:** `https://clerk.cogix.app`

## 🔧 Complete Build Process

For a full production release:

```bash
# 1. Clean previous builds (optional)
rm -rf build/

# 2. Build everything
npm run package:all

# This creates:
# - build/chrome-mv3-prod/        (unpacked extension)
# - build/chrome-mv3-prod.zip     (for Chrome Web Store)
# - cogix-eye-tracking.crx        (for direct distribution)
```

## 📝 Version Management

Before building a new release:

1. Update version in `package.json`
2. Build: `npm run package:all`
3. Test the new version
4. Distribute via your preferred method

## 🔑 Key Files

| File | Purpose | Security |
|------|---------|----------|
| `key.pem` | Private key for CRX signing | ⚠️ Keep secure, never commit |
| `.env.chrome` | Public key for consistent ID | ✅ Safe to commit |
| `CRX_ID_AND_KEYS.txt` | Backup of all keys | ⚠️ Keep secure, never commit |

## 🚨 Important Notes

1. **Never commit `key.pem`** - This is your private signing key
2. **Always use the same key** - Maintains consistent extension ID
3. **Test before distributing** - Load unpacked version first
4. **Keep backups** - Store keys in secure location

## 📊 Distribution Methods

### Chrome Web Store (Recommended)
```bash
npm run package          # Creates ZIP for upload
```
Upload to: https://chrome.google.com/webstore/devconsole

### Direct CRX Distribution
```bash
npm run package:crx      # Creates CRX file
```
Users need developer mode enabled

### Unpacked Extension (Development)
```bash
npm run build            # Creates unpacked version
```
Load from `build/chrome-mv3-prod/` folder

## 🐛 Troubleshooting

If CRX creation fails:
1. Ensure Chrome is installed
2. Check `key.pem` exists and is valid
3. Run PowerShell as Administrator if needed
4. Verify build completed successfully first

For help, check:
- `DEBUG_GUIDE.md` - Debugging instructions
- `CRX_GUIDE.md` - Detailed CRX information
- `PRODUCTION_DEPLOYMENT.md` - Full deployment guide