# ML Extension for Scratch Editor

This document explains how the ML extension works and how to test it.

## Overview

The ML extension automatically loads when the Scratch editor starts and provides ML prediction blocks based on your project data. It reads session ID and project ID from URL parameters and stores them in localStorage for persistence.

## How It Works

### 1. URL Parameter Parsing
- The extension reads `sessionId` and `projectId` from the URL query string
- Example: `https://scratch-editor-url/?sessionId=session_123&projectId=project_456`

### 2. localStorage Storage
- Session ID and project ID are saved to localStorage with keys:
  - `ml_extension_session_id`
  - `ml_extension_project_id`
  - `ml_extension_url_timestamp`

### 3. Project Data Fetching
- The extension fetches project data from the API endpoint:
  - `GET /api/guests/session/{sessionId}/projects/{projectId}`
- This provides project name and labels for dynamic block generation

### 4. Dynamic Block Creation
- Creates prediction blocks based on the project's labels
- Provides standard blocks for text recognition and confidence scoring

## Available Blocks

### Standard Blocks
- **recognise text [TEXT] (label)** - Returns the predicted label for given text
- **recognise text [TEXT] (confidence)** - Returns the confidence score for prediction

### Dynamic Label Blocks
- Automatically generated based on your project's labels
- Each label gets its own reporter block

## Testing the Extension

### 1. Test HTML Page
Use the `test-ml-extension.html` file to test the extension functionality:

```bash
# Open the test page in your browser
open scratch-editor/test-ml-extension.html
```

### 2. Test Functions Available
- **Set URL Parameters** - Simulate scratch editor URL with session/project IDs
- **Test localStorage** - Check what's stored in localStorage
- **Test API Calls** - Verify API connectivity
- **Show Status** - Display current extension state

### 3. Console Debugging
When the extension is loaded, you can access it globally:

```javascript
// Check extension status
window.MLExtension.getStatus()

// Manually set project data
window.MLExtension.setProjectData('session_123', 'project_456')

// Refresh the extension
window.MLExtension.refreshExtension()

// Check for URL parameters
window.MLExtension.checkForUrlParams()
```

## Troubleshooting

### Issue: Extension not loading
**Symptoms:** No ML blocks visible in Scratch editor
**Solutions:**
1. Check browser console for error messages
2. Verify the extension is registered in `extension-manager.js`
3. Ensure the VM is properly initialized

### Issue: No session/project ID
**Symptoms:** Extension shows "No project loaded" errors
**Solutions:**
1. Check URL parameters: `?sessionId=...&projectId=...`
2. Verify localStorage has the correct keys
3. Use `window.MLExtension.getStatus()` to debug

### Issue: API calls failing
**Symptoms:** Prediction blocks return errors
**Solutions:**
1. Check network tab for failed requests
2. Verify API endpoint is accessible
3. Check CORS configuration
4. Test API directly with the test page

### Issue: Blocks not updating
**Symptoms:** Old project labels still showing
**Solutions:**
1. Call `window.MLExtension.refreshExtension()`
2. Check if new project data is available
3. Refresh the Scratch editor page

## Development

### File Structure
```
scratch-editor/
├── packages/
│   ├── scratch-gui/
│   │   └── src/
│   │       └── lib/
│   │           └── query-parser-hoc.jsx  # URL parameter handling
│   └── scratch-vm/
│       └── src/
│           └── extensions/
│               └── scratch3_ml/
│                   ├── index.js          # Main extension code
│                   └── config.js         # Configuration
```

### Key Components

#### QueryParserHOC
- Automatically runs when Scratch editor loads
- Extracts URL parameters and saves to localStorage
- Provides logging for debugging

#### ML3Extension
- Main extension class
- Handles project data initialization
- Creates dynamic blocks
- Manages API calls

#### Extension Manager
- Automatically loads ML extension when VM starts
- Located in `scratch-vm/src/extension-support/extension-manager.js`

### Adding New Features

1. **New Block Types**: Add to `getInfo()` method
2. **New API Endpoints**: Update API calls in relevant methods
3. **New Configuration**: Add to `config.js`
4. **New Debug Methods**: Add to the extension class

## API Endpoints

### Project Information
```
GET /api/guests/session/{sessionId}/projects/{projectId}
```

### Prediction
```
POST /api/guests/session/{sessionId}/projects/{projectId}/predict
Body: { "text": "input text" }
Response: { "success": true, "label": "predicted_label", "confidence": 85.5 }
```

## Configuration

The extension uses these localStorage keys:
- `ml_extension_session_id` - Current session ID
- `ml_extension_project_id` - Current project ID
- `ml_extension_project_name` - Project name (if available)
- `ml_extension_url_timestamp` - When parameters were last set

## Best Practices

1. **Always check for errors** in API calls
2. **Use console.log** for debugging
3. **Handle missing data gracefully** with fallbacks
4. **Test with different project configurations**
5. **Monitor network requests** for API issues

## Common Issues and Solutions

### CORS Errors
- Ensure backend allows requests from scratch editor domain
- Check if preflight requests are handled

### localStorage Not Available
- Check if running in iframe with restricted access
- Verify browser supports localStorage

### Extension Not Found
- Check if extension is properly registered
- Verify file paths are correct
- Check for JavaScript errors during loading

### Blocks Not Appearing
- Ensure `getInfo()` method returns valid block definitions
- Check if extension is properly loaded in VM
- Verify block opcodes are unique

## Support

For issues with the ML extension:
1. Check browser console for error messages
2. Use the test page to isolate problems
3. Verify API endpoints are working
4. Check localStorage contents
5. Use debug methods to inspect extension state
