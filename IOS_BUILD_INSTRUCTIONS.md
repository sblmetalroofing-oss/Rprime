# RPrime iOS App Build Instructions

This guide explains how to build and deploy the RPrime iOS app using Capacitor.

## Prerequisites

1. **Mac with macOS** - Required for iOS development
2. **Xcode** - Download from the Mac App Store (free)
3. **Apple Developer Account** - $99/year for App Store distribution
4. **Node.js** - Version 18 or higher

## Initial Setup (One-time)

### 1. Clone or Download the Project

Transfer the project files to your Mac from Replit:
- Use the "Download as zip" option in Replit, or
- Push to GitHub and clone on your Mac

### 2. Install Dependencies

```bash
npm install
```

### 3. Add iOS Platform

```bash
npx cap add ios
```

This creates the `ios/` folder with the native Xcode project.

## Building the App

### Step 1: Build the Web Assets

```bash
npm run build
```

This compiles your React app to `dist/public/`.

### Step 2: Sync with iOS

```bash
npx cap sync ios
```

This copies the web assets to the iOS project and updates native plugins.

### Step 3: Open in Xcode

```bash
npx cap open ios
```

This opens the project in Xcode.

## Xcode Configuration

### Set Your Development Team

1. In Xcode, click on "App" in the project navigator
2. Select the "App" target
3. Go to "Signing & Capabilities" tab
4. Select your Development Team from the dropdown
5. Update the Bundle Identifier if needed (e.g., `com.yourcompany.rprime`)

### App Icons & Splash Screen

1. Replace assets in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
2. Replace splash screen in `ios/App/App/Assets.xcassets/Splash.imageset/`

Use an icon generator tool like:
- https://www.appicon.co/
- https://makeappicon.com/

### Configure Info.plist

Add required permissions in `ios/App/App/Info.plist`:

```xml
<!-- Camera -->
<key>NSCameraUsageDescription</key>
<string>RPrime needs camera access to take photos of job sites and roof inspections.</string>

<!-- Photo Library -->
<key>NSPhotoLibraryUsageDescription</key>
<string>RPrime needs photo library access to attach images to jobs and reports.</string>

<!-- Push Notifications -->
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

## Testing

### Simulator

1. In Xcode, select a simulator device (e.g., iPhone 15)
2. Press `Cmd + R` or click the Play button
3. The app will build and launch in the simulator

### Physical Device

1. Connect your iPhone via USB
2. Select your device in Xcode's device dropdown
3. Press `Cmd + R` to build and run
4. Trust the developer profile on your iPhone (Settings > General > Device Management)

## App Store Deployment

### 1. Create App Store Connect Record

1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" > "+" > "New App"
3. Fill in app details (name, bundle ID, etc.)

### 2. Archive for Distribution

1. In Xcode, select "Any iOS Device" as build target
2. Go to Product > Archive
3. Wait for the archive to complete

### 3. Upload to App Store

1. In the Organizer window, select your archive
2. Click "Distribute App"
3. Choose "App Store Connect"
4. Follow the prompts to upload

### 4. Submit for Review

1. In App Store Connect, complete all app metadata
2. Add screenshots for all required device sizes
3. Submit for Apple's review

## Updating the App

After making changes in Replit:

1. Download/sync the updated code to your Mac
2. Run `npm run build`
3. Run `npx cap sync ios`
4. Open Xcode and build

## Common Commands Reference

```bash
# Build web assets
npm run build

# Sync to iOS
npx cap sync ios

# Open Xcode project
npx cap open ios

# Copy web assets only (no plugin sync)
npx cap copy ios

# Update native plugins
npx cap update ios
```

## Troubleshooting

### "No bundle ID" error
- Set your bundle ID in Xcode under Signing & Capabilities

### Build fails with signing errors
- Make sure you have a valid Apple Developer account
- Select your team in Xcode project settings

### White screen on launch
- Check that `npm run build` completed successfully
- Verify `dist/public/` contains your built app
- Run `npx cap sync ios` again

### API calls not working
- Update `capacitor.config.ts` with your production server URL
- Or configure `server.url` for local development testing

## Server Configuration for iOS

For the iOS app to connect to your RPrime backend:

1. **Development**: The app uses the bundled web assets with relative API paths
2. **Production**: Deploy your backend to a public URL and update environment variables

### Live Reload During Development (Optional)

For faster development, you can enable live reload:

```typescript
// capacitor.config.ts (development only)
const config: CapacitorConfig = {
  // ... other config
  server: {
    url: 'http://YOUR_LOCAL_IP:5000',
    cleartext: true, // Required for HTTP in development
  },
};
```

**Note**: Remove `server.url` for production builds!

## Push Notifications Setup

1. Create an Apple Push Notification key in Apple Developer Portal
2. Upload the key to your push notification service
3. Configure your backend to send notifications
4. The Capacitor push notification plugin is already installed

## Need Help?

- Capacitor Docs: https://capacitorjs.com/docs
- iOS Development: https://developer.apple.com/documentation/
- React + Capacitor: https://capacitorjs.com/solution/react
