# Production Deployment Guide

## 🚀 Production Build

### Prerequisites
- Ensure you have production Clerk keys configured
- Verify the sync host URL is correct (https://cogix.app)

### Build Steps

1. **Verify Production Environment**
   ```bash
   # Check .env.production has correct values
   cat .env.production
   ```
   
   Should contain:
   - `PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`
   - `CLERK_FRONTEND_API=https://clerk.cogix.app`
   - `PLASMO_PUBLIC_CLERK_SYNC_HOST=https://cogix.app`

2. **Build for Production**
   ```bash
   cd cogix-browser-plugin
   npm run build
   ```
   
   This creates optimized production build in `build/chrome-mv3-prod/`

3. **Package for Distribution** (Optional)
   ```bash
   npm run package
   ```
   
   This creates a `.zip` file for distribution

## 📦 Distribution Options

### Option 1: Manual Installation (Testing)
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `cogix-browser-plugin/build/chrome-mv3-prod/`

### Option 2: ZIP Distribution
1. Build and package:
   ```bash
   npm run build
   npm run package
   ```
2. Share the generated `.zip` file
3. Users can drag-drop into `chrome://extensions/`

### Option 3: Chrome Web Store (Recommended)

#### Preparation
1. Create a [Chrome Web Store Developer Account](https://chrome.google.com/webstore/devconsole/register)
2. Pay one-time $5 registration fee
3. Prepare the following:
   - Extension ZIP file
   - Screenshots (1280x800 or 640x400)
   - Promotional images
   - Privacy policy URL
   - Description and keywords

#### Submission Steps
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "New Item"
3. Upload the ZIP file from `build/chrome-mv3-prod.zip`
4. Fill in the store listing:
   - **Name**: Cogix Eye Tracking
   - **Summary**: Eye tracking and screen recording for research
   - **Category**: Productivity
   - **Language**: English
5. Add screenshots and promotional materials
6. Set visibility (Public or Unlisted)
7. Submit for review

#### Review Process
- Initial review: 1-3 business days
- Updates: Usually within 24 hours
- Common rejection reasons:
  - Missing privacy policy
  - Excessive permissions
  - Unclear description

## 🔐 Production Configuration

### Extension ID Management
The production build uses a consistent extension ID via `CRX_PUBLIC_KEY` in `.env.production`. This ensures:
- Consistent ID across installations
- Easier Clerk configuration
- Simplified updates

### Clerk Configuration
1. **Add Extension ID to Allowed Origins**
   ```bash
   # Get your production Clerk secret key
   # Add the extension ID to allowed origins
   curl -X PATCH https://api.clerk.com/v1/instance \
     -H "Authorization: Bearer sk_live_YOUR_SECRET_KEY" \
     -H "Content-type: application/json" \
     -d '{"allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID"]}'
   ```

2. **Verify Sync Host**
   - Ensure https://cogix.app is live
   - Check CORS headers allow extension origin
   - Verify Clerk is configured on the web app

## 🧪 Production Testing

### Pre-Deployment Checklist
- [ ] Build completes without errors
- [ ] Extension loads in Chrome
- [ ] Authentication syncs with web app
- [ ] Eye tracking features work
- [ ] Recording functionality operates
- [ ] Settings persist correctly
- [ ] No console errors in production mode

### Testing Steps
1. **Clean Installation Test**
   - Use a fresh Chrome profile
   - Install extension from production build
   - Sign in to web app
   - Verify auth syncs to extension

2. **Feature Testing**
   - Test all core features
   - Verify data submission works
   - Check error handling
   - Test offline scenarios

3. **Performance Testing**
   - Monitor memory usage
   - Check for memory leaks
   - Verify background script efficiency

## 📊 Monitoring

### Error Tracking
Consider integrating:
- Sentry for error tracking
- Google Analytics for usage metrics
- Custom telemetry for feature usage

### User Feedback
- Add feedback form in extension
- Monitor Chrome Web Store reviews
- Set up support email

## 🔄 Updates

### Version Management
1. Update version in `package.json`
2. Update CHANGELOG.md
3. Build and test
4. Submit update to Chrome Web Store

### Auto-Updates
Chrome automatically updates extensions from the Web Store:
- Checks every few hours
- Updates silently in background
- Users get updates within 48 hours

## 🛡️ Security Considerations

### Production Best Practices
- ✅ Debug mode auto-disabled in production
- ✅ Environment variables not exposed
- ✅ Sensitive data encrypted in storage
- ✅ Content Security Policy enforced
- ✅ Minimal permissions requested

### API Keys
- Never commit production keys to git
- Use environment variables
- Rotate keys periodically
- Monitor for unauthorized usage

## 📝 Post-Deployment

### Documentation
- Update user documentation
- Create tutorial videos
- Prepare FAQ section
- Write troubleshooting guide

### Support
- Set up support channels
- Create issue templates
- Monitor user feedback
- Plan regular updates

## 🚨 Rollback Plan

If issues arise:
1. **Immediate**: Unlist from Chrome Web Store
2. **Fix**: Debug and resolve issues
3. **Test**: Thoroughly test fixes
4. **Re-deploy**: Submit updated version
5. **Communicate**: Notify affected users

## 📋 Quick Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Package for distribution
npm run package

# Clean build directories
rm -rf build/

# View build size
du -sh build/chrome-mv3-prod/
```

## 🔗 Resources

- [Chrome Web Store Dashboard](https://chrome.google.com/webstore/devconsole)
- [Extension Publishing Guide](https://developer.chrome.com/docs/webstore/publish)
- [Clerk Production Docs](https://clerk.com/docs/deployments/overview)
- [Chrome Extension Best Practices](https://developer.chrome.com/docs/extensions/mv3/best-practices)