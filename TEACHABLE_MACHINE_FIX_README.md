# Teachable Machine Extension - Fixes Applied

## Issues Fixed

### 1. Multiple Callback Registration
**Problem**: The `whenModelDetects` block was registering new callbacks every time it was executed, causing hundreds of duplicate console messages and preventing proper detection.

**Solution**: 
- Added thread-based callback tracking to prevent duplicate registrations
- Each callback is now uniquely identified by `label_threadId`
- Only one callback per thread per label is allowed

### 2. Prediction Loop Issues
**Problem**: The prediction loop wasn't properly integrated with Scratch's event system and wasn't starting correctly.

**Solution**:
- Fixed prediction loop initialization
- Added proper cleanup and restart functions
- Improved integration with Scratch's video system

### 3. Model Loading Issues
**Problem**: The extension was trying to load a pose model instead of an image model, causing compatibility issues.

**Solution**:
- Changed from `@teachablemachine/pose` to `@teachablemachine/image`
- Updated TensorFlow.js to latest version
- Fixed model prediction API calls

### 4. Detection Triggering
**Problem**: Detection callbacks were registered but not properly triggering Scratch hat blocks.

**Solution**:
- Added proper event emission for hat block triggering
- Implemented spam prevention with 2-second cooldown
- Added multiple fallback methods for triggering blocks

## How to Use

### 1. Load the Extension
The extension will automatically load when Scratch starts. It will:
- Load TensorFlow.js and Teachable Machine libraries
- Look for a `teachableLink` URL parameter
- Auto-load the model if a valid URL is found

### 2. Set Up Your Model
Use the "use model [url]" block with your Teachable Machine model URL:
```
https://teachablemachine.withgoogle.com/models/-Y0Sh0vSa/
```

### 3. Enable Video
Use the "turn video [on]" block to start the webcam and detection.

### 4. Create Detection Blocks
Use the "when model detects [label]" hat blocks for each label you want to detect:
- "when model detects Ranjith" → say "Hello!" for 2 seconds
- "when model detects Usha" → say "Hii!!" for 2 seconds

### 5. Set Video Transparency (Optional)
Use "set video transparency to [50]" to adjust video opacity.

## Debugging Functions

The extension provides several console functions for debugging:

### Check Status
```javascript
window.checkTeachableMachineSetup()
```
Shows the current state of the extension.

### Clear Callbacks
```javascript
window.clearTeachableMachineCallbacks()
```
Clears all registered detection callbacks.

### Test Detection
```javascript
window.testTeachableMachineDetection('Ranjith')
```
Manually triggers detection for a specific label.

### Setup Webcam Manually
```javascript
window.setupTeachableMachineWebcam()
```
Sets up webcam if Scratch's video system isn't working.

### Restart Prediction
```javascript
window.restartTeachableMachinePrediction()
```
Restarts the prediction loop.

## Testing

Use the `test-teachable-machine.html` file to test the extension independently:
1. Open the test file in a browser
2. Load your model
3. Setup webcam
4. Test detection manually
5. Check console logs for debugging info

## Troubleshooting

### No Detections
1. Check if model is loaded: `window.checkTeachableMachineSetup()`
2. Ensure video is enabled: `window.getTeachableMachineStatus()`
3. Verify callbacks are registered: Check console for registration messages
4. Test manual detection: `window.testTeachableMachineDetection('label')`

### Multiple Console Messages
1. Clear callbacks: `window.clearTeachableMachineCallbacks()`
2. Check for duplicate blocks in your Scratch project
3. Ensure blocks are not in loops that execute repeatedly

### Video Not Working
1. Try manual webcam setup: `window.setupTeachableMachineWebcam()`
2. Check browser permissions for camera access
3. Verify Scratch's video system is working

### Model Not Loading
1. Check the model URL is correct
2. Ensure the model is publicly accessible
3. Check browser console for network errors
4. Verify TensorFlow.js and Teachable Machine libraries loaded

## Block Reference

| Block | Type | Description |
|-------|------|-------------|
| `use model [url]` | Command | Load a Teachable Machine model |
| `when model detects [label]` | Hat | Trigger when a label is detected |
| `model prediction` | Reporter | Get current predicted label |
| `prediction is [label]` | Boolean | Check if prediction matches label |
| `confidence for [label]` | Reporter | Get confidence score for label |
| `turn video [state]` | Command | Enable/disable video |
| `set video transparency to [value]` | Command | Set video opacity (0-100) |

## Performance Notes

- Detection runs every 100ms when video is enabled
- Labels have a 2-second cooldown to prevent spam
- Video frames are processed at 200x200 resolution
- Confidence threshold is set to 0.8 (80%) by default

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: May have issues with webcam access
- Mobile browsers: Limited support due to camera permissions
