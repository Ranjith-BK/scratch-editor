# Teachable Machine Extension for Scratch

This extension integrates Google's Teachable Machine with Scratch, allowing users to create machine learning projects that can recognize poses, images, or sounds in real-time.

## Features

- **Automatic Model Loading**: Automatically loads Teachable Machine models from URLs
- **Real-time Pose Detection**: Uses webcam to detect poses and classify them
- **Dynamic Label Detection**: Automatically extracts class labels from model metadata
- **Video Controls**: Control webcam on/off and transparency
- **Confidence Scoring**: Get confidence levels for predictions

## Installation

The extension is built into the Scratch editor and will appear in the Extensions library.

## Usage

### 1. Get Your Teachable Machine Model

1. Go to [Teachable Machine](https://teachablemachine.withgoogle.com/)
2. Create a new Pose project
3. Train your model with different poses/classes
4. Export the model and copy the URL

### 2. Use the Extension in Scratch

#### Basic Setup
```
use model [your-teachable-machine-url]
```

#### Event Blocks
```
when model detects [class-name]
```
This block triggers when the model detects the specified class with high confidence.

#### Reporter Blocks
```
model prediction
```
Returns the current predicted class name.

```
confidence for [class-name]
```
Returns the confidence score (0-1) for the specified class.

#### Boolean Blocks
```
prediction is [class-name]
```
Returns true if the current prediction matches the specified class.

#### Control Blocks
```
turn video [on/off]
```
Controls the webcam feed.

```
set video transparency to [value]
```
Sets video transparency (0-100).

### 3. Example Project

Here's a simple example that changes sprite costumes based on pose detection:

```
when green flag clicked
use model [https://teachablemachine.withgoogle.com/models/your-model-id/]

when model detects [pose1]
switch costume to [costume1]

when model detects [pose2]
switch costume to [costume2]

when model detects [pose3]
switch costume to [costume3]
```

## URL Parameter Integration

The extension automatically detects Teachable Machine URLs from the Scratch editor URL parameters:

```
http://localhost:8601?teachableLink=https://teachablemachine.withgoogle.com/models/your-model-id/
```

This allows seamless integration with your frontend application.

## Technical Details

### Dependencies
- TensorFlow.js 1.3.1
- Teachable Machine Pose 0.8

### Model Format
The extension expects Teachable Machine Pose models with:
- `model.json` - Model weights and architecture
- `metadata.json` - Class labels and model information

### Performance
- Prediction loop runs every 100ms
- Webcam resolution: 200x200 pixels
- Confidence threshold: 0.8 (80%)

## Troubleshooting

### Common Issues

1. **Model not loading**
   - Check the URL format (should end with `/`)
   - Ensure the model is publicly accessible
   - Check browser console for errors

2. **Webcam not working**
   - Allow camera permissions in browser
   - Check if another application is using the camera

3. **Low accuracy**
   - Retrain your model with more examples
   - Ensure good lighting conditions
   - Check if poses are clearly different

### Debug Information

Open the browser console to see:
- Model loading status
- Detected labels
- Prediction results
- Error messages

## Development

### Building the Extension

The extension is built into the Scratch VM and GUI:

1. **VM Extension**: `packages/scratch-vm/src/extensions/scratch3_teachable_machine/`
2. **GUI Integration**: `packages/scratch-gui/src/lib/libraries/extensions/`

### Testing

Use the test file `test-teachable-machine.html` to verify functionality before integration.

### Customization

You can modify:
- Confidence threshold
- Prediction frequency
- Webcam resolution
- Model loading behavior

## License

This extension follows the same license as the Scratch project.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review browser console logs
3. Test with the provided test file
4. Verify your Teachable Machine model is working

## Future Enhancements

- Support for image and audio models
- Custom confidence thresholds
- Model switching at runtime
- Export/import model configurations
- Performance optimizations

