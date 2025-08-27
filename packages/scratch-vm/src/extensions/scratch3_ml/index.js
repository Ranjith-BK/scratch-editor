const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');

class ML3Extension {
    constructor(runtime) {
        this.runtime = runtime;
        console.log('ML Extension: CLEAN VERSION LOADED - DYNAMIC BLOCKS');
        
        // Initialize with default values to prevent undefined errors
        this.projectName = 'ML Project';
        this.projectId = null;
        this.sessionId = null;
        this.projectLabels = ['Happy', 'Sad']; // Default labels to prevent undefined errors
        this.lastPrediction = null; // Store the last prediction result
        this.isRefreshing = false; // Prevent duplicate refreshes
        
        // Make extension globally accessible for debugging
        if (typeof window !== 'undefined') {
            window.MLExtension = this;
            console.log('ML Extension: Made globally accessible as window.MLExtension');
        }
        
        // Initialize project data
        this.initializeProjectDataSync();
        
        // Set up periodic check for URL parameters (in case they're added after extension loads)
        if (typeof window !== 'undefined') {
            setTimeout(() => {
                this.checkForUrlParams();
            }, 1000);
        }
        
        // Also run async initialization immediately to get project data
        this.initializeProjectDataAsync();
    }

    extractUrlParams() {
        if (typeof window !== 'undefined' && window.location) {
            const urlParams = new URLSearchParams(window.location.search);
            const sessionId = urlParams.get('sessionId');
            const projectId = urlParams.get('projectId');
            
            if (sessionId && projectId) {
                console.log(`ML Extension: Found URL params - Session: ${sessionId}, Project: ${projectId}`);
                
                // Save to localStorage
                window.localStorage.setItem('ml_extension_session_id', sessionId);
                window.localStorage.setItem('ml_extension_project_id', projectId);
                
                return { sessionId, projectId };
            }
        }
        return null;
    }

    checkForUrlParams() {
        if (!this.sessionId || !this.projectId) {
            console.log('ML Extension: Checking for URL parameters...');
            const urlParams = this.extractUrlParams();
            if (urlParams) {
                console.log('ML Extension: Found URL parameters, reinitializing...');
                this.initializeProjectDataAsync();
            }
        }
    }

    // Synchronous initialization - runs immediately
    initializeProjectDataSync() {
        console.log('ML Extension: Running synchronous initialization...');
        
        // Set default values to ensure getInfo() works
        this.projectName = 'ML Project';
        this.projectId = null;
        this.sessionId = null;
        this.projectLabels = ['Happy', 'Sad'];
        this.lastPrediction = null;
        this.isReady = false;
        
        // Don't mark as ready until we have real data
        console.log('ML Extension: Synchronous initialization complete - waiting for API data');
    }

    // Asynchronous initialization - runs after constructor
    async initializeProjectDataAsync() {
        console.log('ML Extension: Running asynchronous initialization...');
        
        if (typeof window !== 'undefined' && window.localStorage) {
            // First try to get from URL params
            const urlParams = this.extractUrlParams();
            
            // Get project data from localStorage or URL params
            let projectId = window.localStorage.getItem('ml_extension_project_id');
            let sessionId = window.localStorage.getItem('ml_extension_session_id');
            
            if (!projectId || !sessionId) {
                if (urlParams) {
                    projectId = urlParams.projectId;
                    sessionId = urlParams.sessionId;
                }
            }
            
            if (projectId && sessionId) {
                this.projectId = projectId;
                this.sessionId = sessionId;
                
                console.log(`ML Extension: Using project data - ID: ${projectId}, Session: ${sessionId}`);
                
                // Fetch project data from API
                try {
                    const response = await fetch(`https://theneural-backend-ed2fe2fxhq-uc.a.run.app/api/guests/session/${sessionId}/projects/${projectId}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.data) {
                            this.projectName = data.data.name;
                            this.projectLabels = data.data.dataset?.labels || data.data.model?.labels || [];
                            console.log(`ML Extension: Project data loaded from API - Name: ${this.projectName}, Labels: ${this.projectLabels.join(', ')}`);
                            
                            // Add dynamic label block methods for each label
                            this.addDynamicLabelMethods();
                        } else {
                            this.projectName = 'ML Project';
                            this.projectLabels = ['Happy', 'Sad'];
                            console.log('ML Extension: API response not successful, using defaults');
                        }
                    } else {
                        this.projectName = 'ML Project';
                        this.projectLabels = ['Happy', 'Sad'];
                        console.log('ML Extension: Failed to fetch project data, using defaults');
                    }
                } catch (error) {
                    this.projectName = 'ML Project';
                    this.projectLabels = ['Happy', 'Sad'];
                    console.error('ML Extension: Error fetching project data:', error);
                }
            } else {
                this.projectName = 'ML Project';
                this.projectId = null;
                this.sessionId = null;
                this.projectLabels = ['Happy', 'Sad'];
                console.log('ML Extension: No project data found, using defaults');
            }
        } else {
            this.projectName = 'ML Project';
            this.projectId = null;
            this.sessionId = null;
            this.projectLabels = ['Happy', 'Sad'];
        }
        
        // Mark as fully ready
        this.isReady = true;
        console.log('ML Extension: Asynchronous initialization complete');
    }

    addDynamicLabelMethods() {
        // Add a method for each label from the API
        const self = this; // Store reference to 'this'
        this.projectLabels.forEach(label => {
            // Use arrow function to preserve 'this' context, or use 'self'
            this[`label_${label}`] = (args, util) => {
                console.log(`ML Extension: label_${label} block called`);
                return label;
            };
        });
        
        console.log('ML Extension: Dynamic label methods added for:', this.projectLabels);
    }

    getInfo() {
        console.log('ML Extension: getInfo() called - CREATING DYNAMIC BLOCKS');
        console.log('ML Extension: Current projectLabels:', this.projectLabels);
        console.log('ML Extension: isReady:', this.isReady);
        
        // Safety check - if not ready, return basic blocks
        if (!this.isReady) {
            console.log('ML Extension: Not ready yet, returning basic blocks');
            return {
                id: 'ml',
                name: 'ML Project',
                color1: '#4B5566',
                color2: '#374151',
                blocks: [
                    {
                        opcode: 'waitForReady',
                        blockType: BlockType.COMMAND,
                        text: formatMessage({
                            id: 'ml.waitForReady',
                            default: 'wait for ML extension to be ready',
                            description: 'Wait for the ML extension to finish loading'
                        })
                    }
                ],
                menus: {}
            };
        }
        
        // Ensure projectLabels is always an array to prevent map errors
        const labels = Array.isArray(this.projectLabels) ? this.projectLabels : ['Happy', 'Sad'];
        
        // Create dynamic label blocks based on API response
        const dynamicLabelBlocks = labels.map(label => ({
            opcode: `label_${label}`,
            blockType: BlockType.REPORTER,
            text: formatMessage({
                id: `ml.label_${label}`,
                default: label,
                description: `Represents the "${label}" label from your project`
            })
        }));
        
        // Only the 2 main blocks plus dynamic label blocks
        const allBlocks = [
            {
                opcode: 'recogniseTextLabel',
                blockType: BlockType.REPORTER,
                text: formatMessage({
                    id: 'ml.recogniseTextLabel',
                    default: 'recognise text [TEXT] (label)',
                    description: 'Recognise text and return the predicted label'
                }),
                arguments: {
                    TEXT: {
                        type: ArgumentType.STRING,
                        defaultValue: 'text'
                    }
                }
            },
            {
                opcode: 'recogniseTextConfidence',
                blockType: BlockType.REPORTER,
                text: formatMessage({
                    id: 'ml.recogniseTextConfidence',
                    default: 'recognise text [TEXT] (confidence)',
                    description: 'Recognise text and return the confidence score'
                }),
                arguments: {
                    TEXT: {
                        type: ArgumentType.STRING,
                        defaultValue: 'text'
                    }
                }
            },
            ...dynamicLabelBlocks
        ];
        
        console.log(`ML Extension: Project: ${this.projectName}, Labels: ${labels.join(', ')}, Total blocks: ${allBlocks.length}`);
        
        return {
            id: 'ml',
            name: this.projectName,
            color1: '#4B5566',
            color2: '#374151',
            blocks: allBlocks,
            menus: {}
        };
    }

    async recogniseTextLabel(args, util) {
        const text = args.TEXT;
        console.log(`ML Extension: recogniseTextLabel called with text: "${text}"`);
        
        if (!this.sessionId || !this.projectId) {
            console.warn('ML Extension: Missing session or project ID for prediction');
            return 'Error: No project loaded';
        }
        
        try {
            console.log(`ML Extension: Making prediction API call to: /api/guests/session/${this.sessionId}/projects/${this.projectId}/predict`);
            
            // Make API call to get prediction using the correct endpoint
            const response = await fetch(`https://theneural-backend-ed2fe2fxhq-uc.a.run.app/api/guests/session/${this.sessionId}/projects/${this.projectId}/predict`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('ML Extension: Prediction response:', data);
                
                if (data.success && data.label) {
                    // Store the last prediction
                    this.lastPrediction = data.label;
                    return data.label;
                } else {
                    console.warn('ML Extension: No label in response:', data);
                    this.lastPrediction = 'Unknown';
                    return 'Unknown';
                }
            } else {
                console.error('ML Extension: Prediction failed:', response.status);
                this.lastPrediction = 'Error: Prediction failed';
                return 'Error: Prediction failed';
            }
        } catch (error) {
            console.error('ML Extension: Error in prediction:', error);
            return 'Error: Network error';
        }
    }

    async recogniseTextConfidence(args, util) {
        const text = args.TEXT;
        console.log(`ML Extension: recogniseTextConfidence called with text: "${text}"`);
        
        if (!this.sessionId || !this.projectId) {
            console.warn('ML Extension: Missing session or project ID for prediction');
            return 0;
        }
        
        try {
            console.log(`ML Extension: Making confidence API call to: /api/guests/session/${this.sessionId}/projects/${this.projectId}/predict`);
            
            // Make API call to get prediction using the correct endpoint
            const response = await fetch(`https://theneural-backend-ed2fe2fxhq-uc.a.run.app/api/guests/session/${this.sessionId}/projects/${this.projectId}/predict`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('ML Extension: Confidence response:', data);
                
                if (data.success && data.confidence !== undefined) {
                    // Store the last prediction with confidence
                    this.lastPrediction = `${data.label || 'Unknown'} (${data.confidence}%)`;
                    return data.confidence;
                } else {
                    console.warn('ML Extension: No confidence in response:', data);
                    this.lastPrediction = 'Unknown (0%)';
                    return 0;
                }
            } else {
                console.error('ML Extension: Confidence request failed:', response.status);
                this.lastPrediction = 'Error: Request failed';
                return 0;
            }
        } catch (error) {
            console.error('ML Extension: Error getting confidence:', error);
            return 0;
        }
    }

    // Block implementation for setting project data
    setProjectData(args, util) {
        const sessionId = args.SESSION_ID;
        const projectId = args.PROJECT_ID;
        
        if (sessionId && projectId) {
            this.sessionId = sessionId;
            this.projectId = projectId;
            
            // Save to localStorage
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('ml_extension_session_id', sessionId);
                window.localStorage.setItem('ml_extension_project_id', projectId);
            }
            
            console.log(`ML Extension: Block set project data - Session: ${sessionId}, Project: ${projectId}`);
            
            // Re-fetch project data
            this.initializeProjectDataAsync();
        }
    }

    // Block implementation for getting project name
    getProjectName(args, util) {
        return this.projectName || 'ML Project';
    }

    // Block implementation for getting project labels
    getProjectLabels(args, util) {
        if (Array.isArray(this.projectLabels) && this.projectLabels.length > 0) {
            return this.projectLabels.join(', ');
        }
        return 'Happy, Sad';
    }

    // Debug method to manually set session and project IDs (for console use)
    setProjectDataManually(sessionId, projectId) {
        if (sessionId && projectId) {
            this.sessionId = sessionId;
            this.projectId = projectId;
            
            // Save to localStorage
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('ml_extension_session_id', sessionId);
                window.localStorage.setItem('ml_extension_project_id', projectId);
            }
            
            console.log(`ML Extension: Manually set project data - Session: ${sessionId}, Project: ${projectId}`);
            
            // Re-fetch project data
            this.initializeProjectDataAsync();
        }
    }

    // Block implementation for refreshing the extension
    refreshExtension(args, util) {
        console.log('ML Extension: Refreshing extension from block...');
        this.initializeProjectDataAsync();
        
        // Notify the runtime that the extension has changed
        if (this.runtime && this.runtime.emit) {
            this.runtime.emit('EXTENSION_ADDED', 'ml');
        }
    }

    // Block implementation for checking if extension is ready
    isExtensionReady(args, util) {
        return !!(this.sessionId && this.projectId && this.projectLabels && this.projectLabels.length > 0);
    }

    // Block implementation for getting session ID
    getSessionId(args, util) {
        return this.sessionId || 'No session ID set';
    }

    // Block implementation for getting project ID
    getProjectId(args, util) {
        return this.projectId || 'No project ID set';
    }

    // Block implementation for clearing project data
    clearProjectData(args, util) {
        console.log('ML Extension: Clearing project data from block...');
        
        // Clear project data
        this.sessionId = null;
        this.projectId = null;
        this.projectName = 'ML Project';
        this.projectLabels = ['Happy', 'Sad'];
        this.lastPrediction = null;
        
        // Clear localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem('ml_extension_session_id');
            window.localStorage.removeItem('ml_extension_project_id');
            window.localStorage.removeItem('ml_extension_project_name');
        }
        
        console.log('ML Extension: Project data cleared');
    }

    // Block implementation for testing API connection
    async testAPIConnection(args, util) {
        console.log('ML Extension: Testing API connection from block...');
        
        if (!this.sessionId || !this.projectId) {
            console.warn('ML Extension: Cannot test API without session and project IDs');
            return;
        }
        
        try {
            const response = await fetch(`https://theneural-backend-ed2fe2fxhq-uc.a.run.app/api/guests/session/${this.sessionId}/projects/${this.projectId}`);
            if (response.ok) {
                console.log('ML Extension: API connection test successful');
            } else {
                console.warn(`ML Extension: API connection test failed with status ${response.status}`);
            }
        } catch (error) {
            console.error('ML Extension: API connection test error:', error);
        }
    }

    // Block implementation for waiting for extension to be ready
    waitForReady(args, util) {
        console.log('ML Extension: waitForReady block called');
        
        if (this.isReady) {
            console.log('ML Extension: Extension is already ready');
            return;
        }
        
        // Wait a bit and check again
        setTimeout(() => {
            if (this.isReady) {
                console.log('ML Extension: Extension is now ready');
            } else {
                console.log('ML Extension: Extension still not ready');
            }
        }, 1000);
    }

    // Method to force extension to be ready (for debugging)
    forceReady() {
        console.log('ML Extension: Force setting extension to ready');
        this.isReady = true;
        this.projectLabels = this.projectLabels || ['Happy', 'Sad'];
        
        // Notify runtime that extension has changed
        if (this.runtime && this.runtime.emit) {
            this.runtime.emit('EXTENSION_ADDED', 'ml');
        }
    }

    // Method to manually trigger async initialization (for debugging)
    async manualInit() {
        console.log('ML Extension: Manual initialization triggered');
        await this.initializeProjectDataAsync();
        
        // Force refresh the extension
        if (this.runtime && this.runtime.emit) {
            this.runtime.emit('EXTENSION_ADDED', 'ml');
        }
    }

    // Method to manually set project labels (for debugging)
    setProjectLabels(labels) {
        console.log('ML Extension: Manually setting project labels:', labels);
        this.projectLabels = Array.isArray(labels) ? labels : ['Happy', 'Sad'];
        this.isReady = true;
        
        // Force refresh the extension
        if (this.runtime && this.runtime.emit) {
            this.runtime.emit('EXTENSION_ADDED', 'ml');
        }
    }

    // Method to manually set project data for testing
    setProjectDataForTesting(sessionId, projectId) {
        console.log('ML Extension: Setting project data for testing:', { sessionId, projectId });
        this.sessionId = sessionId;
        this.projectId = projectId;
        
        // Save to localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('ml_extension_session_id', sessionId);
            window.localStorage.setItem('ml_extension_project_id', projectId);
        }
        
        // Re-fetch project data
        this.initializeProjectDataAsync();
    }

    // Block implementation for getting last prediction
    getLastPrediction(args, util) {
        return this.lastPrediction || 'No predictions yet';
    }

    // Block implementation for showing status in console
    showStatus(args, util) {
        const status = this.getStatus();
        console.log('ML Extension Status:', status);
        console.log('ML Extension: Session ID:', status.sessionId);
        console.log('ML Extension: Project ID:', status.projectId);
        console.log('ML Extension: Project Name:', status.projectName);
        console.log('ML Extension: Project Labels:', status.projectLabels);
        console.log('ML Extension: Last Prediction:', status.lastPrediction);
    }

    // Debug method to get current status
    getStatus() {
        return {
            sessionId: this.sessionId,
            projectId: this.projectId,
            projectName: this.projectName,
            projectLabels: this.projectLabels,
            lastPrediction: this.lastPrediction,
            isReady: this.isReady,
            localStorage: {
                sessionId: typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('ml_extension_session_id') : null,
                projectId: typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('ml_extension_project_id') : null
            }
        };
    }

    // Debug method to check what's happening
    debugState() {
        console.log('=== ML Extension Debug State ===');
        console.log('isReady:', this.isReady);
        console.log('projectLabels:', this.projectLabels);
        console.log('projectLabels type:', typeof this.projectLabels);
        console.log('projectLabels isArray:', Array.isArray(this.projectLabels));
        console.log('projectLabels length:', this.projectLabels ? this.projectLabels.length : 'undefined');
        console.log('sessionId:', this.sessionId);
        console.log('projectId:', this.projectId);
        console.log('projectName:', this.projectName);
        console.log('lastPrediction:', this.lastPrediction);
        console.log('================================');
    }

    // Method to refresh the extension (useful when new project data is loaded)
    refreshExtension() {
        console.log('ML Extension: Refreshing extension...');
        this.initializeProjectDataAsync();
        
        // Force ready state and notify the runtime that the extension has changed
        this.isReady = true;
        if (this.runtime && this.runtime.emit) {
            this.runtime.emit('EXTENSION_ADDED', 'ml');
        }
    }

    // Method to force refresh with new labels
    forceRefreshWithLabels(labels) {
        console.log('ML Extension: Force refreshing with labels:', labels);
        
        // Prevent duplicate refreshes
        if (this.isRefreshing) {
            console.log('ML Extension: Already refreshing, skipping...');
            return;
        }
        
        this.isRefreshing = true;
        
        // Update labels
        this.projectLabels = Array.isArray(labels) ? labels : ['Happy', 'Sad'];
        this.isReady = true;
        
        // Add dynamic methods for new labels
        this.addDynamicLabelMethods();
        
        // Notify runtime that extension has changed
        if (this.runtime && this.runtime.emit) {
            console.log('ML Extension: Emitting EXTENSION_ADDED event');
            this.runtime.emit('EXTENSION_ADDED', 'ml');
        }
        
        // Reset refresh flag after a delay
        setTimeout(() => {
            this.isRefreshing = false;
        }, 1000);
        
        console.log('ML Extension: Extension refreshed with labels:', this.projectLabels);
    }

    // Method to check if a label method exists
    hasLabelMethod(label) {
        return typeof this[`label_${label}`] === 'function';
    }

    // Method to list all available label methods
    listLabelMethods() {
        const methods = [];
        this.projectLabels.forEach(label => {
            if (this.hasLabelMethod(label)) {
                methods.push(`label_${label}`);
            }
        });
        return methods;
    }
}

module.exports = ML3Extension;