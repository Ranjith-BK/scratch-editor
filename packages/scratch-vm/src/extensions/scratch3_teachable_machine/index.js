const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');

// Global variables for the extension
let model = null;
let webcam = null;
let isModelLoaded = false;
let modelLabels = ['class1', 'class2', 'class3']; // Default labels
let currentPrediction = null;
let confidenceThreshold = 0.8;
let teachableLink = '';
let isDetecting = false;
let detectionCallbacks = new Map();

// Load TensorFlow.js and Teachable Machine libraries
function loadTeachableMachineLibraries() {
    return new Promise((resolve, reject) => {
        // Check if libraries are already loaded
        if (window.tf && window.tmPose) {
            resolve();
            return;
        }

        // Load TensorFlow.js
        const tfScript = document.createElement('script');
        tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js';
        tfScript.onload = () => {
            // Load Teachable Machine Pose
            const tmScript = document.createElement('script');
            tmScript.src = 'https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8/dist/teachablemachine-pose.min.js';
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
        model = await window.tmPose.load(modelURL, metadataURL);
        
        // Get labels from metadata
        try {
            const response = await fetch(metadataURL);
            const metadata = await response.json();
            if (metadata.labels && Array.isArray(metadata.labels)) {
                modelLabels = metadata.labels;
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

// Initialize webcam
async function initWebcam() {
    if (!isModelLoaded) return false;
    
    try {
        const size = 200;
        const flip = true;
        webcam = new window.tmPose.Webcam(size, size, flip);
        await webcam.setup();
        await webcam.play();
        return true;
    } catch (error) {
        console.error('Teachable Machine: Failed to initialize webcam:', error);
        return false;
    }
}

// Make prediction
async function predict() {
    if (!isModelLoaded || !webcam) return null;
    
    try {
        webcam.update();
        
        // Estimate pose
        const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
        
        // Get prediction
        const prediction = await model.predict(posenetOutput);
        
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
        
        // Trigger detection events for hat blocks
        if (bestPrediction && bestPrediction.confidence >= confidenceThreshold) {
            // Trigger the specific label detection
            if (detectionCallbacks.has(bestPrediction.label)) {
                detectionCallbacks.get(bestPrediction.label).forEach(callback => {
                    callback(bestPrediction);
                });
            }
        }
        
        return bestPrediction;
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

// Turn video on/off
function setVideoState(state) {
    if (webcam) {
        if (state === 'on') {
            webcam.play();
        } else {
            webcam.pause();
        }
    }
}

// Set video transparency
function setVideoTransparency(value) {
    if (webcam && webcam.canvas) {
        webcam.canvas.style.opacity = value / 100;
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
        console.log('Teachable Machine: No valid teachableLink found in URL, waiting for manual input');
    }
}

// Test function to manually set labels for debugging
function setTestLabels() {
    modelLabels = ['flowers', 'fruits'];
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
}

// Auto-initialize when extension loads
setTimeout(initializeFromURL, 1000);

// Test labels after 3 seconds for debugging
setTimeout(setTestLabels, 3000);

// Start prediction loop when extension is loaded
setInterval(async () => {
    if (isModelLoaded && webcam && isDetecting) {
        await predict();
    }
}, 100);

// Main extension function that Scratch calls
function TeachableMachineExtension(runtime) {
    // Return the extension object
    return {
        getInfo() {
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
                                defaultValue: 'https://teachablemachine.withgoogle.com/models/your-model-id/'
                            }
                        }
                    },
                    {
                        opcode: 'startDetection',
                        blockType: BlockType.COMMAND,
                        text: formatMessage({
                            id: 'teachable_machine.startDetection',
                            default: 'start detection',
                            description: 'Start pose detection'
                        })
                    },
                    {
                        opcode: 'stopDetection',
                        blockType: BlockType.COMMAND,
                        text: formatMessage({
                            id: 'teachable_machine.stopDetection',
                            default: 'stop detection',
                            description: 'Stop pose detection'
                        })
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
                        }
                    },
                    {
                        opcode: 'modelPrediction',
                        blockType: BlockType.REPORTER,
                        text: formatMessage({
                            id: 'teachable_machine.modelPrediction',
                            default: 'model prediction',
                            description: 'Get the current predicted label'
                        })
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
                        }
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
                        }
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
                        }
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
                        }
                    }
                ],
                menus: {
                    labels: {
                        acceptReporters: false,
                        items: () => {
                            // Always return valid labels, with fallback to defaults
                            if (modelLabels && Array.isArray(modelLabels) && modelLabels.length > 0) {
                                // Filter out any invalid labels and ensure they're strings
                                const validLabels = modelLabels.filter(label => 
                                    label && typeof label === 'string' && label.trim().length > 0
                                );
                                
                                if (validLabels.length > 0) {
                                    console.log('Teachable Machine: Menu labels:', validLabels);
                                    return validLabels;
                                }
                            }
                            
                            // Fallback to default labels
                            console.log('Teachable Machine: Using default labels');
                            return ['class1', 'class2', 'class3'];
                        }
                    },
                    videoState: {
                        acceptReporters: false,
                        items: ['on', 'off']
                    }
                }
            };
        },

        // Block implementations
        useModel: async function (args, util) {
            const url = args.url;
            if (url && url.trim()) {
                const success = await loadModel(url.trim());
                if (success) {
                    await initWebcam();
                }
            }
        },
        
        startDetection: function (args, util) {
            isDetecting = true;
        },
        
        stopDetection: function (args, util) {
            isDetecting = false;
        },
        
        whenModelDetects: function (args, util) {
            const label = args.label;
            // Register callback for this label
            if (!detectionCallbacks.has(label)) {
                detectionCallbacks.set(label, []);
            }
            detectionCallbacks.get(label).push((prediction) => {
                // This will be called when the label is detected
                console.log(`Teachable Machine: Label ${label} detected with confidence ${prediction.confidence}`);
            });
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
        
        turnVideo: function (args, util) {
            const state = args.state;
            setVideoState(state);
        },
        
        setVideoTransparency: function (args, util) {
            const value = args.value;
            setVideoTransparency(value);
        }
    };
}

console.log('Teachable Machine Extension: Extension loaded successfully');
console.log('Teachable Machine Extension: All 9 blocks registered');
console.log('Teachable Machine Extension: Ready to use');

module.exports = TeachableMachineExtension;
