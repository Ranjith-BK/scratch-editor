const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');

// Global variables for the extension
let model = null;
let isModelLoaded = false;
let modelLabels = ['class1', 'class2', 'class3']; // Default labels
let originalLabels = ['class1', 'class2', 'class3']; // Store original labels without prefixes
let currentPrediction = null;
let confidenceThreshold = 0.8;
let teachableLink = '';
let isDetecting = false;
let detectionCallbacks = new Map();
let runtime = null;
let videoEnabled = false;
let predictionInterval = null;
let lastTriggeredLabels = new Set(); // Track which labels were triggered to avoid spam
let registeredLabels = new Set(); // Track which labels have already been registered to prevent duplicates

// Load TensorFlow.js and Teachable Machine libraries
function loadTeachableMachineLibraries() {
    return new Promise((resolve, reject) => {
        // Check if libraries are already loaded
        if (window.tf && window.tmImage) {
            resolve();
            return;
        }

        // Load TensorFlow.js
        const tfScript = document.createElement('script');
        tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js';
        tfScript.onload = () => {
            // Load Teachable Machine Image (not pose)
            const tmScript = document.createElement('script');
            tmScript.src = 'https://cdn.jsdelivr.net/npm/@teachablemachine/image@latest/dist/teachablemachine-image.min.js';
            tmScript.onload = () => resolve();
            tmScript.onerror = reject;
            document.head.appendChild(tmScript);
        };
        tfScript.onerror = reject;
        document.head.appendChild(tfScript);
    });
}

// Load model from Teachable Machine URL
async function loadModel(url) {
    try {
        await loadTeachableMachineLibraries();
        
        const modelURL = url + 'model.json';
        const metadataURL = url + 'metadata.json';
        
        // Load the model and metadata
        model = await window.tmImage.load(modelURL, metadataURL);
        
        // Get labels from metadata
        try {
            const response = await fetch(metadataURL);
            const metadata = await response.json();
            if (metadata.labels && Array.isArray(metadata.labels)) {
                // Clear old callbacks before setting new labels
                detectionCallbacks.clear();
                lastTriggeredLabels.clear();
                registeredLabels.clear();
                console.log('Teachable Machine: Cleared old detection callbacks, trigger history, and registered labels');
                
                // Store original labels and create formatted versions for display
                originalLabels = metadata.labels;
                modelLabels = metadata.labels;
                console.log('Teachable Machine: Original labels loaded:', originalLabels);
                console.log('Teachable Machine: Labels loaded:', modelLabels);
                
                // Force refresh the extension menus to show new labels
                if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                    try {
                        window.Scratch.vm.emit('BLOCKSINFO_UPDATE');
                        console.log('Teachable Machine: Extension menus refreshed with new labels');
                    } catch (e) {
                        console.log('Teachable Machine: Could not refresh menus:', e.message);
                    }
                }
            }
        } catch (e) {
            console.log('Teachable Machine: Could not fetch metadata, using default labels');
        }
        
        isModelLoaded = true;
        teachableLink = url;
        
        console.log('Teachable Machine: Model loaded successfully');
        console.log('Teachable Machine: Labels:', modelLabels);
        
        return true;
    } catch (error) {
        console.error('Teachable Machine: Failed to load model:', error);
        isModelLoaded = false;
        return false;
    }
}

// Make prediction using Scratch's video system or webcam
async function predict() {
    if (!isModelLoaded || !videoEnabled) return null;
    
    try {
        let frame = null;
        
        // Try to get frame from Scratch's video system first
        if (runtime && runtime.ioDevices && runtime.ioDevices.video) {
            try {
                frame = runtime.ioDevices.video.getFrame({
                    format: 'canvas',
                    dimensions: [200, 200]
                });
            } catch (e) {
                console.log('Teachable Machine: Could not get frame from Scratch video system:', e.message);
            }
        }
        
        // If no frame from Scratch, try to use webcam directly
        if (!frame && window.webcam && window.webcam.canvas) {
            frame = window.webcam.canvas;
        }
        
        // If still no frame, try to create a webcam if not exists
        if (!frame && !window.webcam && navigator.mediaDevices) {
            try {
                console.log('Teachable Machine: Setting up webcam for predictions...');
                await window.setupTeachableMachineWebcam();
                if (window.webcam && window.webcam.canvas) {
                    frame = window.webcam.canvas;
                }
            } catch (e) {
                console.log('Teachable Machine: Could not setup webcam:', e.message);
            }
        }
        
        if (frame) {
            // Get prediction directly from the image frame
            const prediction = await model.predict(frame);
            
            // Find highest confidence prediction
            let highestConfidence = 0;
            let bestPrediction = null;
            
            for (let i = 0; i < prediction.length; i++) {
                if (prediction[i].probability > highestConfidence) {
                    highestConfidence = prediction[i].probability;
                    bestPrediction = {
                        label: prediction[i].className,
                        confidence: prediction[i].probability
                    };
                }
            }
            
            currentPrediction = bestPrediction;
            
            // Log current prediction for debugging
            if (bestPrediction) {
                console.log(`Teachable Machine: Current prediction: ${bestPrediction.label} (${(bestPrediction.confidence * 100).toFixed(1)}%)`);
            }
            
            // Trigger detection events for hat blocks
            if (bestPrediction && bestPrediction.confidence >= confidenceThreshold) {
                // Check if we should trigger this label (avoid spam)
                const label = bestPrediction.label;
                const shouldTrigger = !lastTriggeredLabels.has(label);
                
                if (shouldTrigger) {
                    console.log(`Teachable Machine: Triggering detection for label: ${label} with confidence: ${bestPrediction.confidence}`);
                    
                    // Trigger all callbacks for this label
                    for (const [callbackKey, callbackData] of detectionCallbacks.entries()) {
                        if (callbackData.label === label) {
                            try {
                                callbackData.callback(bestPrediction);
                            } catch (e) {
                                console.error(`Teachable Machine: Error in callback for ${label}:`, e);
                            }
                        }
                    }
                    
                    // Trigger the Scratch block using the main trigger function
                    if (typeof triggerScratchBlock === 'function') {
                        triggerScratchBlock(label, bestPrediction);
                    }
                    
                    // Mark this label as recently triggered
                    lastTriggeredLabels.add(label);
                    
                    // Clear the label from triggered set after a delay to allow re-triggering
                    setTimeout(() => {
                        lastTriggeredLabels.delete(label);
                    }, 2000); // 2 second cooldown
                }
            }
            
            return bestPrediction;
        }
        return null;
    } catch (error) {
        console.error('Teachable Machine: Prediction failed:', error);
        return null;
    }
}

// Get confidence for specific label
function getConfidenceForLabel(label) {
    if (!currentPrediction || currentPrediction.label !== label) return 0;
    return currentPrediction.confidence;
}

// Check if prediction matches label
function isPrediction(label) {
    if (!currentPrediction) return false;
    return currentPrediction.label === label && currentPrediction.confidence >= confidenceThreshold;
}

// Turn video on/off using Scratch's video system
async function setVideoState(state) {
    if (!runtime || !runtime.ioDevices || !runtime.ioDevices.video) {
        console.error('Teachable Machine: Video system not available');
        return;
    }
    
    try {
        if (state === 'on') {
            // Try to enable video with error handling
            try {
                await runtime.ioDevices.video.enableVideo();
                videoEnabled = true;
                isDetecting = true;
                console.log('Teachable Machine: Video enabled and detection started');
            } catch (videoError) {
                console.warn('Teachable Machine: Could not enable Scratch video system:', videoError.message);
                
                // Fallback: try to setup webcam directly
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    try {
                        console.log('Teachable Machine: Attempting to setup webcam directly...');
                        await window.setupTeachableMachineWebcam();
                        videoEnabled = true;
                        isDetecting = true;
                        console.log('Teachable Machine: Webcam setup successful, detection started');
                    } catch (webcamError) {
                        console.error('Teachable Machine: Webcam setup also failed:', webcamError.message);
                        throw webcamError;
                    }
                } else {
                    throw videoError;
                }
            }
        } else {
            runtime.ioDevices.video.disableVideo();
            videoEnabled = false;
            isDetecting = false;
            console.log('Teachable Machine: Video disabled and detection stopped');
        }
    } catch (error) {
        console.error('Teachable Machine: Failed to change video state:', error);
        videoEnabled = false;
        isDetecting = false;
    }
}

// Set video transparency using Scratch's video system
function setVideoTransparency(value) {
    if (!runtime || !runtime.ioDevices || !runtime.ioDevices.video) {
        console.error('Teachable Machine: Video system not available');
        return;
    }
    
    try {
        // Convert percentage to Scratch's ghost effect (0-100)
        const ghostValue = Math.max(0, Math.min(100, value));
        runtime.ioDevices.video.setPreviewGhost(ghostValue);
        console.log(`Teachable Machine: Video transparency set to ${ghostValue}%`);
    } catch (error) {
        console.error('Teachable Machine: Failed to set video transparency:', error);
    }
}

// Get URL parameters - improved to handle multiple formats
function getURLParameter(name) {
    // Try multiple ways to get the parameter
    const urlParams = new URLSearchParams(window.location.search);
    let value = urlParams.get(name);
    
    if (!value) {
        // Try hash parameters
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        value = hashParams.get(name);
    }
    
    if (!value) {
        // Try different parameter names
        value = urlParams.get('teachableLink') || urlParams.get('teachable_link') || urlParams.get('link');
    }
    
    console.log(`Teachable Machine: Looking for parameter '${name}', found:`, value);
    return value;
}

// Initialize extension with URL parameters
function initializeFromURL() {
    const link = getURLParameter('teachableLink');
    if (link && link !== 'https://teachablemachine.withgoogle.com/models/your-model-id/') {
        console.log('Teachable Machine: Auto-loading model from URL:', link);
        loadModel(link);
    } else {
        // Try to load the model from your example URL
        const exampleUrl = 'https://teachablemachine.withgoogle.com/models/-Y0Sh0vSa/';
        console.log('Teachable Machine: No valid teachableLink found in URL, trying example URL:', exampleUrl);
        loadModel(exampleUrl);
    }
}

// Test function to manually set labels for debugging
function setTestLabels() {
    // Clear old callbacks first
    detectionCallbacks.clear();
    lastTriggeredLabels.clear();
    registeredLabels.clear();
    console.log('Teachable Machine: Cleared old detection callbacks, trigger history, and registered labels');
    
    modelLabels = ['Ranjith', 'Usha'];
    console.log('Teachable Machine: Test labels set:', modelLabels);
    
    // Force refresh the extension menus
    if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
        try {
            window.Scratch.vm.emit('BLOCKSINFO_UPDATE');
            console.log('Teachable Machine: Extension menus refreshed with test labels');
        } catch (e) {
            console.log('Teachable Machine: Could not refresh menus:', e.message);
        }
    }
    
    // Also try to refresh the runtime
    if (runtime) {
        try {
            runtime.emit('BLOCKSINFO_UPDATE');
            console.log('Teachable Machine: Runtime refresh completed');
        } catch (e) {
            console.log('Teachable Machine: Runtime refresh failed:', e.message);
        }
    }
    
    // Force a re-render by triggering a workspace update
    if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm && window.Scratch.vm.workspace) {
        try {
            window.Scratch.vm.workspace.emit('change');
            console.log('Teachable Machine: Workspace change event triggered');
        } catch (e) {
            console.log('Teachable Machine: Could not trigger workspace change:', e.message);
        }
    }
}

// Manual functions that can be called from console
window.clearTeachableMachineCallbacks = function() {
    detectionCallbacks.clear();
    lastTriggeredLabels.clear();
    registeredLabels.clear();
    console.log('Teachable Machine: All detection callbacks, trigger history, and registered labels cleared manually');
};

window.resetTeachableMachineRegistrations = function() {
    detectionCallbacks.clear();
    lastTriggeredLabels.clear();
    registeredLabels.clear();
    console.log('Teachable Machine: All registrations reset - you can now re-add your detection blocks');
};

window.debugTeachableMachineBlocks = function() {
    console.log('=== Teachable Machine Block Debug ===');
    
    if (!runtime) {
        console.log('❌ No runtime available');
        return;
    }
    
    if (runtime.targets) {
        console.log(`📊 Found ${runtime.targets.length} targets (sprites/stage)`);
        
        for (const target of runtime.targets) {
            console.log(`🎭 Target: ${target.name} (${target.isStage ? 'Stage' : 'Sprite'})`);
            
            if (target.blocks && target.blocks._blocks) {
                const blocks = target.blocks._blocks;
                console.log(`  📦 Has ${Object.keys(blocks).length} blocks`);
                
                // Look for our specific blocks
                for (const blockId in blocks) {
                    const block = blocks[blockId];
                    if (block.opcode === 'tm_whenModelDetects') {
                        console.log(`  🎯 Found tm_whenModelDetects block:`, {
                            id: blockId,
                            label: block.fields?.label?.value,
                            opcode: block.opcode
                        });
                    }
                }
            } else {
                console.log(`  ❌ No blocks found`);
            }
        }
    } else {
        console.log('❌ No targets available');
    }
    
    // Check runtime capabilities
    console.log('🔧 Runtime capabilities:');
    console.log('  - startHats:', !!runtime.startHats);
    console.log('  - sequencer:', !!runtime.sequencer);
    console.log('  - stepThread:', !!(runtime.sequencer && runtime.sequencer.stepThread));
    console.log('  - emit:', !!runtime.emit);
    
    console.log('=====================================');
};

window.getTeachableMachineStatus = function() {
    return {
        isModelLoaded: isModelLoaded,
        videoEnabled: videoEnabled,
        isDetecting: isDetecting,
        currentPrediction: currentPrediction,
        labels: modelLabels,
        callbacks: Array.from(detectionCallbacks.keys()),
        lastTriggered: Array.from(lastTriggeredLabels),
        registeredLabels: Array.from(registeredLabels)
    };
};

window.refreshTeachableMachineLabels = function() {
    console.log('Teachable Machine: Manual refresh requested');
    if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
        try {
            window.Scratch.vm.emit('BLOCKSINFO_UPDATE');
            console.log('Teachable Machine: Manual refresh completed');
        } catch (e) {
            console.log('Teachable Machine: Manual refresh failed:', e.message);
        }
    }
    
    // Also try runtime refresh
    if (runtime) {
        try {
            runtime.emit('BLOCKSINFO_UPDATE');
            console.log('Teachable Machine: Runtime refresh completed');
        } catch (e) {
            console.log('Teachable Machine: Runtime refresh failed:', e.message);
        }
    }
};

window.getTeachableMachineLabels = function() {
    console.log('Teachable Machine: Current labels:', modelLabels);
    console.log('Teachable Machine: Current callbacks:', Array.from(detectionCallbacks.keys()));
    return { labels: modelLabels, callbacks: Array.from(detectionCallbacks.keys()) };
};

window.testTeachableMachineDetection = function(label) {
    console.log(`Teachable Machine: Manually testing detection for label: ${label}`);
    
    // Simulate a detection
    const mockPrediction = {
        label: label,
        confidence: 0.95
    };
    
    // Trigger callbacks for this label
    for (const [callbackKey, callbackData] of detectionCallbacks.entries()) {
        if (callbackData.label === label) {
            try {
                callbackData.callback(mockPrediction);
            } catch (e) {
                console.error(`Teachable Machine: Error in test callback for ${label}:`, e);
            }
        }
    }
    
    // Also try to trigger the Scratch block directly
    if (typeof triggerScratchBlock === 'function') {
        triggerScratchBlock(label, mockPrediction);
    }
};

window.forceTeachableMachineDetection = function(label) {
    console.log(`Teachable Machine: Force triggering detection for label: ${label}`);
    
    // Clear the label from triggered set to allow immediate re-triggering
    lastTriggeredLabels.delete(label);
    
    // Create a mock prediction
    const mockPrediction = {
        label: label,
        confidence: 0.95
    };
    
    // Trigger the Scratch block
    if (typeof triggerScratchBlock === 'function') {
        triggerScratchBlock(label, mockPrediction);
    }
};

window.testTeachableMachineMenu = function() {
    console.log('Teachable Machine: Testing menu items function...');
    
    // Simulate what the menu items function does
    if (modelLabels && Array.isArray(modelLabels) && modelLabels.length > 0) {
        const validLabels = modelLabels.filter(label => 
            label && typeof label === 'string' && label.trim().length > 0
        );
        
        // Format as [displayText, value] pairs
        const menuItems = validLabels.map(label => [label, label]);
        console.log('Teachable Machine: Menu would return:', menuItems);
        return menuItems;
    } else {
        console.log('Teachable Machine: Menu would return default labels');
        return [['class1', 'class1'], ['class2', 'class2'], ['class3', 'class3']];
    }
};

window.checkTeachableMachineSetup = function() {
    console.log('=== Teachable Machine Setup Check ===');
    console.log('Model loaded:', isModelLoaded);
    console.log('Video enabled:', videoEnabled);
    console.log('Detection active:', isDetecting);
    console.log('Current labels:', modelLabels);
    console.log('Registered callbacks:', detectionCallbacks.size);
    console.log('Prediction interval:', !!predictionInterval);
    console.log('Current prediction:', currentPrediction);
    console.log('Runtime available:', !!runtime);
    
    if (runtime && runtime.ioDevices) {
        console.log('Video system available:', !!runtime.ioDevices.video);
    }
    
    console.log('=====================================');
};

window.restartTeachableMachinePrediction = function() {
    console.log('Teachable Machine: Restarting prediction loop...');
    startPredictionLoop();
};

window.setupTeachableMachineWebcam = async function() {
    console.log('Teachable Machine: Setting up webcam directly...');
    
    try {
        // Check if we already have a webcam setup
        if (window.webcam && window.webcam.stream && window.webcam.stream.active) {
            console.log('Teachable Machine: Webcam already active');
            return true;
        }
        
        // Create a webcam element
        const video = document.createElement('video');
        video.width = 200;
        video.height = 200;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        
        // Get user media with better error handling
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 200 },
                    height: { ideal: 200 },
                    facingMode: 'user'
                },
                audio: false
            });
        } catch (mediaError) {
            console.warn('Teachable Machine: getUserMedia failed, trying with minimal constraints:', mediaError.message);
            
            // Try with minimal constraints
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: true,
                    audio: false
                });
            } catch (minimalError) {
                console.error('Teachable Machine: Even minimal video constraints failed:', minimalError.message);
                throw minimalError;
            }
        }
        
        video.srcObject = stream;
        
        // Create canvas for predictions
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        // Store webcam reference
        window.webcam = {
            video: video,
            canvas: canvas,
            stream: stream,
            ctx: ctx
        };
        
        // Start drawing frames to canvas
        function drawFrame() {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                ctx.drawImage(video, 0, 0, 200, 200);
            }
            requestAnimationFrame(drawFrame);
        }
        
        video.onloadedmetadata = () => {
            drawFrame();
            console.log('Teachable Machine: Webcam setup complete');
        };
        
        // Handle video errors
        video.onerror = (error) => {
            console.error('Teachable Machine: Video element error:', error);
        };
        
        return true;
    } catch (error) {
        console.error('Teachable Machine: Failed to setup webcam:', error);
        
        // Provide helpful error messages
        if (error.name === 'NotAllowedError') {
            console.error('Teachable Machine: Camera permission denied. Please allow camera access and try again.');
        } else if (error.name === 'NotFoundError') {
            console.error('Teachable Machine: No camera found on this device.');
        } else if (error.name === 'NotReadableError') {
            console.error('Teachable Machine: Camera is already in use by another application.');
        }
        
        return false;
    }
};

window.testTeachableMachineModel = async function() {
    console.log('Teachable Machine: Testing model with current frame...');
    
    if (!isModelLoaded) {
        console.log('Teachable Machine: Model not loaded yet');
        return null;
    }
    
    try {
        const result = await predict();
        console.log('Teachable Machine: Test prediction result:', result);
        return result;
    } catch (error) {
        console.error('Teachable Machine: Test prediction failed:', error);
        return null;
    }
};

window.checkTeachableMachineWebcam = function() {
    console.log('=== Teachable Machine Webcam Check ===');
    
    if (window.webcam) {
        console.log('Webcam object exists:', !!window.webcam);
        console.log('Video element:', !!window.webcam.video);
        console.log('Canvas element:', !!window.webcam.canvas);
        console.log('Stream active:', window.webcam.stream && window.webcam.stream.active);
        
        if (window.webcam.video) {
            console.log('Video ready state:', window.webcam.video.readyState);
            console.log('Video dimensions:', window.webcam.video.videoWidth, 'x', window.webcam.video.videoHeight);
        }
    } else {
        console.log('No webcam object found');
    }
    
    if (runtime && runtime.ioDevices && runtime.ioDevices.video) {
        console.log('Scratch video system available');
        try {
            const frame = runtime.ioDevices.video.getFrame({
                format: 'canvas',
                dimensions: [200, 200]
            });
            console.log('Scratch video frame available:', !!frame);
        } catch (e) {
            console.log('Scratch video frame error:', e.message);
        }
    } else {
        console.log('Scratch video system not available');
    }
    
    // Check camera permissions
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'camera' }).then(permissionStatus => {
            console.log('Camera permission status:', permissionStatus.state);
            if (permissionStatus.state === 'denied') {
                console.warn('⚠️ Camera permission denied. You need to allow camera access in your browser settings.');
            }
        }).catch(e => {
            console.log('Could not check camera permission status:', e.message);
        });
    }
    
    console.log('=====================================');
};

window.requestCameraPermission = async function() {
    console.log('Teachable Machine: Requesting camera permission...');
    
    try {
        // Try to get a minimal video stream to request permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true,
            audio: false
        });
        
        // Stop the stream immediately after getting permission
        stream.getTracks().forEach(track => track.stop());
        
        console.log('✅ Camera permission granted!');
        return true;
    } catch (error) {
        console.error('❌ Camera permission denied:', error.message);
        
        if (error.name === 'NotAllowedError') {
            console.error('💡 To fix this:');
            console.error('1. Click the camera icon in your browser address bar');
            console.error('2. Select "Allow" for camera access');
            console.error('3. Refresh the page and try again');
        }
        
        return false;
    }
};

// Auto-initialize when extension loads
setTimeout(initializeFromURL, 1000);

// Test labels after 3 seconds for debugging
setTimeout(setTestLabels, 3000);

// Additional test after 5 seconds to ensure labels are set
setTimeout(() => {
    console.log('Teachable Machine: 5-second check - current labels:', modelLabels);
    if (modelLabels && modelLabels.length > 0) {
        console.log('Teachable Machine: Labels are set, testing menu function...');
        window.testTeachableMachineMenu();
    } else {
        console.log('Teachable Machine: Labels are still not set after 5 seconds');
    }
}, 5000);

// Start prediction loop when extension is loaded
function startPredictionLoop() {
    if (predictionInterval) {
        clearInterval(predictionInterval);
    }
    
    predictionInterval = setInterval(async () => {
        if (isModelLoaded && videoEnabled) {
            await predict();
        }
    }, 100);
    
    console.log('Teachable Machine: Prediction loop started');
}

// Start the prediction loop
startPredictionLoop();

// Main extension function that Scratch calls
function TeachableMachineExtension(runtimeInstance) {
    // Store runtime reference for video access
    runtime = runtimeInstance;
    
    console.log('Teachable Machine Extension: Runtime initialized:', !!runtime);
    console.log('Teachable Machine Extension: Video system available:', !!(runtime && runtime.ioDevices && runtime.ioDevices.video));
    
    // Function to trigger Scratch blocks when detection occurs
    const triggerScratchBlock = (label, prediction) => {
        if (!runtime) return;
        
        console.log(`Teachable Machine: 🔥 Attempting to trigger Scratch block for ${label}...`);
        
        try {
            // Method 1: Try to start hats using the runtime (most reliable)
            if (runtime.startHats) {
                try {
                    console.log(`🎯 Teachable Machine: Trying startHats for ${label}...`);
                    runtime.startHats('tm_whenModelDetects', {
                        label: label,
                        prediction: prediction
                    });
                    console.log(`✅ Teachable Machine: Successfully triggered hat block for ${label} using startHats`);
                    return; // Exit if successful
                } catch (e) {
                    console.log(`⚠️ Teachable Machine: startHats failed for ${label}:`, e.message);
                }
            }
            
            // Method 2: Try to trigger blocks directly using runtime.sequencer
            if (runtime.sequencer && runtime.sequencer.stepThread) {
                try {
                    console.log(`🎯 Teachable Machine: Trying sequencer.stepThread for ${label}...`);
                    // Find all sprites and trigger their hat blocks
                    for (const target of runtime.targets) {
                        if (target.blocks && target.blocks._blocks) {
                            for (const blockId in target.blocks._blocks) {
                                const block = target.blocks._blocks[blockId];
                                if (block.opcode === 'tm_whenModelDetects' && 
                                    block.fields && 
                                    block.fields.label && 
                                    block.fields.label.value === label) {
                                    
                                    console.log(`🎯 Teachable Machine: Found EXACT matching block for ${label} in target ${target.name}`);
                                    
                                    // Create a proper block object and step the thread
                                    const blockObj = target.blocks.createBlock(blockId);
                                    if (blockObj) {
                                        console.log(`🎯 Teachable Machine: Created block object for ${label}, stepping thread...`);
                                        runtime.sequencer.stepThread(blockObj);
                                        console.log(`✅ Teachable Machine: Successfully stepped thread for ${label} in ${target.name}`);
                                        return; // Exit if successful
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log(`⚠️ Teachable Machine: sequencer.stepThread failed for ${label}:`, e.message);
                }
            }
            
            // Method 3: Try using runtime.emit for custom events
            if (runtime.emit) {
                try {
                    console.log(`🎯 Teachable Machine: Trying emit for ${label}...`);
                    runtime.emit('HAT_BLOCK_TRIGGERED', {
                        opcode: 'tm_whenModelDetects',
                        label: label,
                        prediction: prediction
                    });
                    console.log(`📡 Teachable Machine: Emitted HAT_BLOCK_TRIGGERED event for ${label}`);
                } catch (e) {
                    console.log(`⚠️ Teachable Machine: emit failed for ${label}:`, e.message);
                }
            }
            
            // Method 4: Try to force a runtime update with exact label matching
            if (runtime.targets) {
                try {
                    console.log(`🎯 Teachable Machine: Trying runtime update for ${label}...`);
                    // Force all targets to update
                    for (const target of runtime.targets) {
                        if (target.blocks && target.blocks._blocks) {
                            // Look for any blocks that might be waiting for this event
                            for (const blockId in target.blocks._blocks) {
                                const block = target.blocks._blocks[blockId];
                                if (block.opcode === 'tm_whenModelDetects' && 
                                    block.fields && 
                                    block.fields.label && 
                                    block.fields.label.value === label) {
                                    
                                    console.log(`🔄 Teachable Machine: Found EXACT ${block.opcode} block for ${label} in ${target.name}, attempting to trigger...`);
                                    
                                    // Try to create a new thread for this block
                                    if (runtime.sequencer && runtime.sequencer.stepThread) {
                                        try {
                                            const blockObj = target.blocks.createBlock(blockId);
                                            runtime.sequencer.stepThread(blockObj);
                                            console.log(`✅ Teachable Machine: Thread stepped successfully for ${label} in ${target.name}`);
                                            return; // Exit if successful
                                        } catch (e) {
                                            console.log(`⚠️ Teachable Machine: Could not step thread for ${target.name}:`, e.message);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log(`⚠️ Teachable Machine: Runtime update failed:`, e.message);
                }
            }
            
            // Method 5: Try using Scratch's internal event system with exact matching
            if (runtime.targets) {
                try {
                    console.log(`🎯 Teachable Machine: Trying internal event system for ${label}...`);
                    for (const target of runtime.targets) {
                        if (target.blocks && target.blocks._blocks) {
                            for (const blockId in target.blocks._blocks) {
                                const block = target.blocks._blocks[blockId];
                                if (block.opcode === 'tm_whenModelDetects' && 
                                    block.fields && 
                                    block.fields.label && 
                                    block.fields.label.value === label) {
                                    
                                    console.log(`🎯 Teachable Machine: Method 5 - Found EXACT match for ${label} in ${target.name}`);
                                    
                                    // Try to trigger the block using Scratch's internal methods
                                    if (target.blocks && target.blocks.createBlock) {
                                        try {
                                            const blockObj = target.blocks.createBlock(blockId);
                                            
                                            // Try multiple ways to start the block
                                            if (runtime.sequencer && runtime.sequencer.stepThread) {
                                                runtime.sequencer.stepThread(blockObj);
                                                console.log(`✅ Teachable Machine: Method 5 - Thread stepped successfully for ${label}`);
                                                return;
                                            }
                                            
                                            // Alternative: try to start the block directly
                                            if (blockObj && typeof blockObj.start === 'function') {
                                                blockObj.start();
                                                console.log(`✅ Teachable Machine: Method 5 - Block started directly for ${label}`);
                                                return;
                                            }
                                            
                                        } catch (e) {
                                            console.log(`⚠️ Teachable Machine: Method 5 failed for ${label}:`, e.message);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log(`⚠️ Teachable Machine: Method 5 failed:`, e.message);
                }
            }
            
            console.log(`❌ Teachable Machine: All triggering methods failed for ${label}`);
            
        } catch (e) {
            console.error(`💥 Teachable Machine: Critical error triggering Scratch block for ${label}:`, e);
        }
    };
    
    // Cleanup function for when extension is unloaded
    const cleanup = () => {
        if (predictionInterval) {
            clearInterval(predictionInterval);
            predictionInterval = null;
        }
        detectionCallbacks.clear();
        lastTriggeredLabels.clear();
        registeredLabels.clear();
        console.log('Teachable Machine: Extension cleaned up');
    };
    
    // Register cleanup on runtime dispose
    if (runtime && runtime.on) {
        runtime.on('dispose', cleanup);
    }
    
    // Return the extension object
    return {
        getInfo() {
            console.log('Teachable Machine: getInfo() called, current labels:', modelLabels);
            return {
                id: 'tm',
                name: 'Teachable Machine',
                color1: '#800080',
                color2: '#800080',
                blocks: [
                    {
                        opcode: 'useModel',
                        blockType: BlockType.COMMAND,
                        text: formatMessage({
                            id: 'teachable_machine.useModel',
                            default: 'use model [url]',
                            description: 'Load a Teachable Machine model from URL'
                        }),
                        arguments: {
                            url: {
                                type: ArgumentType.STRING,
                                defaultValue: 'https://teachablemachine.withgoogle.com/models/-Y0Sh0vSa/'
                            }
                        },
                        iconURI: 'static/Neural Logo-Light Green.png'
                    },

                    {
                        opcode: 'whenModelDetects',
                        blockType: BlockType.HAT,
                        text: formatMessage({
                            id: 'teachable_machine.whenModelDetects',
                            default: 'when model detects [label]',
                            description: 'Trigger when a specific label is detected'
                        }),
                        arguments: {
                            label: {
                                type: ArgumentType.STRING,
                                menu: 'labels',
                                defaultValue: 'class1'
                            }
                        },
                        iconURI: 'static/Neural Logo-Light Green.png'
                    },
                    {
                        opcode: 'modelPrediction',
                        blockType: BlockType.REPORTER,
                        text: formatMessage({
                            id: 'teachable_machine.modelPrediction',
                            default: 'model prediction',
                            description: 'Get the current predicted label'
                        }),
                        iconURI: 'static/Neural Logo-Light Green.png'
                    },
                    {
                        opcode: 'predictionIs',
                        blockType: BlockType.BOOLEAN,
                        text: formatMessage({
                            id: 'teachable_machine.predictionIs',
                            default: 'prediction is [label]',
                            description: 'Check if current prediction matches a label'
                        }),
                        arguments: {
                            label: {
                                type: ArgumentType.STRING,
                                menu: 'labels',
                                defaultValue: 'class1'
                            }
                        },
                        iconURI: 'static/Neural Logo-Light Green.png'
                    },
                    {
                        opcode: 'confidenceFor',
                        blockType: BlockType.REPORTER,
                        text: formatMessage({
                            id: 'teachable_machine.confidenceFor',
                            default: 'confidence for [label]',
                            description: 'Get confidence score for a specific label'
                        }),
                        arguments: {
                            label: {
                                type: ArgumentType.STRING,
                                menu: 'labels',
                                defaultValue: 'class1'
                            }
                        },
                        iconURI: 'static/Neural Logo-Light Green.png'
                    },
                    {
                        opcode: 'turnVideo',
                        blockType: BlockType.COMMAND,
                        text: formatMessage({
                            id: 'teachable_machine.turnVideo',
                            default: 'turn video [state]',
                            description: 'Turn video on or off'
                        }),
                        arguments: {
                            state: {
                                type: ArgumentType.STRING,
                                menu: 'videoState',
                                defaultValue: 'on'
                            }
                        },
                        iconURI: 'static/Neural Logo-Light Green.png'
                    },
                    {
                        opcode: 'setVideoTransparency',
                        blockType: BlockType.COMMAND,
                        text: formatMessage({
                            id: 'teachable_machine.setVideoTransparency',
                            default: 'set video transparency to [value]',
                            description: 'Set video transparency level'
                        }),
                        arguments: {
                            value: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 50
                            }
                        },
                        iconURI: 'static/Neural Logo-Light Green.png'
                    }
                ],
                menus: {
                    labels: {
                        acceptReporters: false,
                        items: () => {
                            console.log('Teachable Machine: Menu labels function called, current labels:', modelLabels);
                            console.log('Teachable Machine: modelLabels type:', typeof modelLabels);
                            console.log('Teachable Machine: modelLabels isArray:', Array.isArray(modelLabels));
                            
                            // Always return valid labels, with fallback to defaults
                            if (modelLabels && Array.isArray(modelLabels) && modelLabels.length > 0) {
                                // Filter out any invalid labels and ensure they're strings
                                const validLabels = modelLabels.filter(label => 
                                    label && typeof label === 'string' && label.trim().length > 0
                                );
                                
                                console.log('Teachable Machine: Filtered valid labels:', validLabels);
                                
                                if (validLabels.length > 0) {
                                    console.log('Teachable Machine: Returning valid labels:', validLabels);
                                    
                                    // Return labels in the format that Scratch expects
                                    // Each item should be [displayText, value] pair
                                    const menuItems = validLabels.map(label => [label, label]);
                                    console.log('Teachable Machine: Menu items formatted:', menuItems);
                                    return menuItems;
                                }
                            }
                            
                            // Fallback to default labels
                            console.log('Teachable Machine: Using default labels');
                            return [['class1', 'class1'], ['class2', 'class2'], ['class3', 'class3']];
                        }
                    },
                    videoState: {
                        acceptReporters: false,
                        items: ['on', 'off']
                    }
                },

            };
        },

        // Block implementations
        useModel: async function (args, util) {
            const url = args.url;
            if (url && url.trim()) {
                console.log('Teachable Machine: Loading model from:', url);
                const success = await loadModel(url.trim());
                if (success) {
                    console.log('Teachable Machine: Model loaded successfully, ready for detection');
                } else {
                    console.error('Teachable Machine: Failed to load model');
                }
            }
        },

        
        whenModelDetects: function (args, util) {
            const label = args.label;
            
            // Check if this label is already registered to prevent duplicates during recompilation
            if (registeredLabels.has(label)) {
                console.log(`Teachable Machine: Label ${label} already registered, skipping duplicate`);
                return true;
            }
            
            // Generate a unique callback key using label and a timestamp
            const callbackKey = `${label}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Store the callback with the unique key
            detectionCallbacks.set(callbackKey, {
                label: label,
                callback: (prediction) => {
                    // This will be called when the label is detected
                    console.log(`Teachable Machine: Label ${label} detected with confidence ${prediction.confidence}`);
                    
                    // The actual triggering will be handled by the main trigger function
                    // This callback just logs the detection
                }
            });
            
            // Mark this label as registered
            registeredLabels.add(label);
            
            console.log(`Teachable Machine: Registered detection callback for label: ${label} (key: ${callbackKey})`);
            
            // Return true to indicate the block is ready
            return true;
        },
        
        modelPrediction: function (args, util) {
            if (currentPrediction) {
                return currentPrediction.label;
            }
            return '';
        },
        
        predictionIs: function (args, util) {
            const label = args.label;
            return isPrediction(label);
        },
        
        confidenceFor: function (args, util) {
            const label = args.label;
            return getConfidenceForLabel(label);
        },
        
        turnVideo: async function (args, util) {
            const state = args.state;
            console.log(`Teachable Machine: Turning video ${state}`);
            await setVideoState(state);
        },
        
        setVideoTransparency: function (args, util) {
            const value = args.value;
            console.log(`Teachable Machine: Setting video transparency to ${value}%`);
            setVideoTransparency(value);
        }
    };
}

console.log('Teachable Machine Extension: Extension loaded successfully');
console.log('Teachable Machine Extension: All 7 blocks registered');
console.log('Teachable Machine Extension: Ready to use');
module.exports = TeachableMachineExtension;
