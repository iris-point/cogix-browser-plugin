# 📷 Camera Implementation - Simple & Working Approach

## Problem with CameraOverlay

The `CameraOverlay` class from `@iris-point/eye-tracking-core` was causing issues:
- Complex API with constructor parameter confusion
- Method naming issues (`stop()` vs `destroy()`)
- Not rendering frames in real-time properly
- Over-engineered for simple camera display needs

## Solution: Direct Frame Handling

Instead of using `CameraOverlay`, we implemented the **same approach used in the working emotion experiment** and demo files.

### ✅ How It Works

1. **Listen for Camera Frames**:
   ```typescript
   tracker.on('cameraFrame', (frame: { imageData: string; timestamp: number }) => {
     // Update any camera image elements on the page
     const cameraImages = document.querySelectorAll('.eye-tracker-camera-image')
     cameraImages.forEach((img: HTMLImageElement) => {
       if (frame.imageData) {
         img.src = `data:image/jpeg;base64,${frame.imageData}`
       }
     })
   })
   ```

2. **Set Up Image Element**:
   ```typescript
   const setupCameraImage = (imgElement: HTMLImageElement) => {
     // Add the class that the camera frame handler looks for
     imgElement.classList.add('eye-tracker-camera-image')
     
     // Set styles for better display
     imgElement.style.width = '100%'
     imgElement.style.height = '100%'
     imgElement.style.objectFit = 'cover'
     imgElement.style.borderRadius = '8px'
     imgElement.style.transform = 'scaleX(-1)' // Mirror for natural view
   }
   ```

3. **Use Simple HTML**:
   ```tsx
   <img 
     ref={imgRef}
     className="plasmo-absolute plasmo-inset-0 plasmo-w-full plasmo-h-full plasmo-object-cover"
     alt="Eye tracker camera feed"
   />
   ```

### 🎯 Benefits

- ✅ **Real-time Updates**: Frames update immediately as they arrive
- ✅ **Simple API**: Just add a class to any `<img>` element
- ✅ **No Constructor Issues**: No complex parameter passing
- ✅ **No Method Errors**: No `stop()` vs `destroy()` confusion
- ✅ **Battle-tested**: Same approach used in working demos
- ✅ **Lightweight**: Minimal code, maximum functionality

### 📋 Implementation Steps

1. **Remove CameraOverlay Import**:
   ```diff
   - import { CameraOverlay } from '@iris-point/eye-tracking-core'
   ```

2. **Add Frame Handler**:
   ```typescript
   tracker.on('cameraFrame', (frame) => {
     const cameraImages = document.querySelectorAll('.eye-tracker-camera-image')
     cameraImages.forEach((img: HTMLImageElement) => {
       if (frame.imageData) {
         img.src = `data:image/jpeg;base64,${frame.imageData}`
       }
     })
   })
   ```

3. **Set Up Image Elements**:
   ```typescript
   const setupCameraImage = (imgElement: HTMLImageElement) => {
     imgElement.classList.add('eye-tracker-camera-image')
     // Add styling...
   }
   ```

4. **Use in Components**:
   ```tsx
   const imgRef = useRef<HTMLImageElement>(null)
   
   useEffect(() => {
     if (imgRef.current && deviceStatus === DeviceStatus.CONNECTED) {
       setupCameraImage(imgRef.current)
     }
   }, [deviceStatus, setupCameraImage])
   
   return <img ref={imgRef} alt="Eye tracker camera feed" />
   ```

### 🔍 Reference Implementation

This approach is directly inspired by the working implementation in:
- `cogix-eye-tracking-core/docs/index.html` (lines 481-496)
- `cogix-eye-tracking-core/examples/demo.html`
- `cogix-eye-tracking-core/eye-tracking-emotion-experiment/`

### 📊 Comparison

| Aspect | CameraOverlay Class | Direct Frame Handling |
|--------|-------------------|---------------------|
| **Complexity** | High (constructor, methods) | Low (event + DOM update) |
| **Real-time** | Issues reported | ✅ Works perfectly |
| **API Surface** | Large (many methods) | Small (one setup function) |
| **Error Prone** | Yes (constructor, methods) | No (simple DOM updates) |
| **Battle Tested** | Limited | ✅ Used in working demos |

## Status: ✅ IMPLEMENTED

The camera display now uses the simple, direct approach that's proven to work in the emotion experiment and other demos. Real-time camera frames should now display correctly in the browser plugin.
