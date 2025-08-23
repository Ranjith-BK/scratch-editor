const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');
const config = require('./config');

// Global variables
let SESSION_ID = '';
let PROJECT_ID = '';
let PROJECT_NAME = config.DEFAULT_PROJECT_NAME;
const API_BASE_URL = config.API_BASE_URL;

// Storage utility functions
function saveToStorage(key, value) {
    if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        console.log(`ML Extension: Saved ${key}: ${value}`);
    }
}

function loadFromStorage(key) {
    if (typeof window !== 'undefined' && window.localStorage) {
        const value = window.localStorage.getItem(key);
        console.log(`ML Extension: Loaded ${key}: ${value}`);
        return value;
    }
    return null;
}

function clearStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
        Object.values(config.STORAGE_KEYS).forEach(key => {
            window.localStorage.removeItem(key);
        });
        console.log('ML Extension: Storage cleared');
    }
}

// URL parsing function - PRIMARY method for getting session and project IDs
function extractIdsFromURL() {
    if (typeof window !== 'undefined' && window.location) {
        const url = window.location.href;
        console.log(`ML Extension: Extracting IDs from URL (primary method): ${url}`);
        
        // Try multiple URL patterns for sessionId and projectId
        let sessionMatch = url.match(/[?&]sessionId[=:]([^&\/]+)/);
        let projectMatch = url.match(/[?&]projectId[=:]([^&\/]+)/);
        
        if (!sessionMatch) {
            sessionMatch = url.match(/[?&]session[=:]([^&\/]+)/);
        }
        if (!projectMatch) {
            projectMatch = url.match(/[?&]project[=:]([^&\/]+)/);
        }
        
        if (sessionMatch && projectMatch) {
            SESSION_ID = sessionMatch[1];
            PROJECT_ID = projectMatch[1];
            
            console.log(`ML Extension: Successfully extracted from URL - Session: ${SESSION_ID}, Project: ${PROJECT_ID}`);
            return true;
        } else {
            console.warn('ML Extension: Could not extract session_id and project_id from URL');
            return false;
        }
    }
    return false;
}

// Load IDs from URL FIRST, then localStorage as fallback
function initializeIds() {
    // ALWAYS prioritize URL parameters over localStorage
    console.log(`ML Extension: Initializing - prioritizing URL parameters over localStorage`);
    
    // First, try to extract from URL
    const urlExtracted = extractIdsFromURL();
    if (urlExtracted) {
        console.log(`ML Extension: Successfully extracted from URL - Session: ${SESSION_ID}, Project: ${PROJECT_ID}`);
        
        // Store URL values in localStorage for consistency
        saveToStorage(config.STORAGE_KEYS.SESSION_ID, SESSION_ID);
        saveToStorage(config.STORAGE_KEYS.PROJECT_ID, PROJECT_ID);
        
        // Try to get project name from localStorage if available
        const storedProjectName = loadFromStorage(config.STORAGE_KEYS.PROJECT_NAME);
        if (storedProjectName) {
            PROJECT_NAME = storedProjectName;
            console.log(`ML Extension: Using project name from localStorage: ${PROJECT_NAME}`);
        } else {
            console.log(`ML Extension: No project name in localStorage, using default: ${PROJECT_NAME}`);
        }
        
        return true;
    }
    
    // If URL extraction failed, fall back to localStorage
    console.log(`ML Extension: URL extraction failed, falling back to localStorage`);
    const storedSessionId = loadFromStorage(config.STORAGE_KEYS.SESSION_ID);
    const storedProjectId = loadFromStorage(config.STORAGE_KEYS.PROJECT_ID);
    const storedProjectName = loadFromStorage(config.STORAGE_KEYS.PROJECT_NAME);
    
    if (storedSessionId && storedProjectId) {
        SESSION_ID = storedSessionId;
        PROJECT_ID = storedProjectId;
        if (storedProjectName) {
            PROJECT_NAME = storedProjectName;
        }
        console.log(`ML Extension: Fallback to localStorage - Session: ${SESSION_ID}, Project: ${PROJECT_ID}, Name: ${PROJECT_NAME}`);
        return true;
    }
    
    console.error(`ML Extension: ERROR - No valid session/project data found in URL or localStorage`);
    return false;
}

// Function to set session and project IDs manually
async function setSessionAndProjectIds(sessionId, projectId) {
    SESSION_ID = sessionId;
    PROJECT_ID = projectId;
    
    // Save to localStorage
    saveToStorage(config.STORAGE_KEYS.SESSION_ID, SESSION_ID);
    saveToStorage(config.STORAGE_KEYS.PROJECT_ID, PROJECT_ID);
    
    console.log(`ML Extension: IDs set manually - Session: ${SESSION_ID}, Project: ${PROJECT_ID}`);
    
    // Fetch project name and update UI
    const newProjectName = await fetchProjectName();
    if (newProjectName !== config.DEFAULT_PROJECT_NAME) {
        PROJECT_NAME = newProjectName;
        console.log(`ML Extension: Project name updated to: ${PROJECT_NAME}`);
        
        // Force UI refresh to show new project name
        if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
            try {
                window.Scratch.vm.refreshWorkspace();
            } catch (e) {
                console.log('ML Extension: Could not refresh workspace, but project name updated');
            }
        }
    }
}

// Function to fetch project name from backend
async function fetchProjectName() {
    if (!SESSION_ID || !PROJECT_ID) {
        console.warn('ML Extension: Cannot fetch project name - missing session_id or project_id');
        return config.DEFAULT_PROJECT_NAME;
    }

    try {
        const url = `${API_BASE_URL}/api/guests/session/${SESSION_ID}/projects/${PROJECT_ID}`;
        console.log(`ML Extension: Fetching project name from: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET', // Using GET as per API specification
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('ML Extension: Project API response:', data);
        
        // Handle the response structure from your API
        if (data.success && data.data && data.data.name) {
            const newProjectName = data.data.name;
            PROJECT_NAME = newProjectName;
            saveToStorage(config.STORAGE_KEYS.PROJECT_NAME, PROJECT_NAME);
            console.log(`ML Extension: Project name updated from API to: ${PROJECT_NAME}`);
            
            // Force multiple UI refresh attempts to ensure the name updates
            if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                try {
                    // Immediate refresh
                    window.Scratch.vm.refreshWorkspace();
                    console.log('ML Extension: Workspace refreshed immediately');
                    
                    // Delayed refresh to ensure UI updates
                    setTimeout(() => {
                        try {
                            window.Scratch.vm.refreshWorkspace();
                            console.log('ML Extension: Workspace refreshed after delay');
                        } catch (e) {
                            console.log('ML Extension: Delayed refresh failed');
                        }
                    }, 500);
                    
                    // Force refresh the extension blocks specifically
                    setTimeout(() => {
                        try {
                            const extensionManager = window.Scratch.vm.extensionManager;
                            if (extensionManager && extensionManager._loadedExtensions.has('ml')) {
                                // Re-trigger extension info update
                                window.Scratch.vm.emit('BLOCKSINFO_UPDATE');
                                console.log('ML Extension: Extension blocks info updated');
                            }
                        } catch (e) {
                            console.log('ML Extension: Could not update extension blocks info');
                        }
                    }, 1000);
                    
                } catch (e) {
                    console.log('ML Extension: Could not refresh workspace, but project name updated');
                }
            }
            
            return PROJECT_NAME;
        } else {
            console.warn('ML Extension: No name field in project data, using default');
            return config.DEFAULT_PROJECT_NAME;
        }
    } catch (error) {
        console.error('ML Extension: Error fetching project name:', error);
        
        if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
            console.log('ML Extension: CORS error detected. This usually means:');
            console.log('  1. Your backend needs CORS configuration for localhost:8601');
            console.log('  2. Or update config.js to use your frontend port (localhost:3000)');
            console.log('  3. Or use MLExtension.setProjectName() to set name manually');
        }
        
        return config.DEFAULT_PROJECT_NAME;
    }
}

// API helper function
async function apiCall(endpoint, options = {}) {
    if (!SESSION_ID || !PROJECT_ID) {
        throw new Error('Session ID or Project ID not available. Please set them using the extension.');
    }

    const url = `${API_BASE_URL}/api/guests/session/${SESSION_ID}/projects/${PROJECT_ID}${endpoint}`;
    console.log(`ML Extension: Making API call to: ${url}`);
    
    // Always include session_id and project_id in the payload
    const defaultPayload = {
        session_id: SESSION_ID,
        project_id: PROJECT_ID
    };
    
    const defaultOptions = {
        method: 'POST', // Default to POST to send payloads
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(defaultPayload),
        ...options
    };

    // If body is provided in options, merge it with default payload
    if (options.body) {
        try {
            const customBody = JSON.parse(options.body);
            defaultOptions.body = JSON.stringify({
                ...defaultPayload,
                ...customBody
            });
        } catch (e) {
            console.warn('ML Extension: Could not parse custom body, using default payload');
        }
    }

    try {
        const response = await fetch(url, defaultOptions);
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        console.log(`ML Extension: API response for ${endpoint}:`, result);
        console.log(`ML Extension: Response structure analysis:`, {
            hasSuccess: 'success' in result,
            successValue: result.success,
            hasLabel: 'label' in result,
            labelValue: result.label,
            hasConfidence: 'confidence' in result,
            confidenceValue: result.confidence,
            hasData: 'data' in result,
            dataType: result.data ? typeof result.data : 'undefined'
        });
        return result;
    } catch (error) {
        console.error(`ML Extension: API call failed for ${endpoint}:`, error);
        return { error: error.message, success: false };
    }
}

/**
 * Class for the ML extension blocks.
 */
class MLExtension {
    constructor() {
        // Initialize IDs from storage or URL
        initializeIds();
        
        // Try to fetch project name if IDs are available
        if (SESSION_ID && PROJECT_ID) {
            // Fetch project name immediately and update UI
            fetchProjectName().then(newName => {
                if (newName !== config.DEFAULT_PROJECT_NAME) {
                    PROJECT_NAME = newName;
                    console.log(`ML Extension: Project name updated to: ${PROJECT_NAME}`);
                    
                    // Force immediate UI refresh to show new name
                    this.forceImmediateUIRefresh();
                }
            }).catch(error => {
                console.error('ML Extension: Error fetching project name on init:', error);
            });
        }
        
        // Also check localStorage for project name on initialization
        const storedProjectName = loadFromStorage(config.STORAGE_KEYS.PROJECT_NAME);
        if (storedProjectName && storedProjectName !== config.DEFAULT_PROJECT_NAME) {
            PROJECT_NAME = storedProjectName;
            console.log(`ML Extension: Project name loaded from localStorage: ${PROJECT_NAME}`);
        }
        
        console.log(`ML Extension: Initialized with project name: ${PROJECT_NAME}`);
    }
    
    // Force immediate UI refresh with multiple strategies
    forceImmediateUIRefresh() {
        if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
            try {
                // Strategy 1: Immediate workspace refresh
                window.Scratch.vm.refreshWorkspace();
                console.log('ML Extension: Immediate workspace refresh completed');
                
                // Strategy 2: Force extension blocks update
                setTimeout(() => {
                    try {
                        window.Scratch.vm.emit('BLOCKSINFO_UPDATE');
                        console.log('ML Extension: Extension blocks info updated');
                    } catch (e) {
                        console.log('ML Extension: Could not update extension blocks info');
                    }
                }, 100);
                
                // Strategy 3: Force extension re-registration
                setTimeout(() => {
                    try {
                        const extensionManager = window.Scratch.vm.extensionManager;
                        if (extensionManager && extensionManager._loadedExtensions.has('ml')) {
                            // Remove and re-add the extension to force refresh
                            extensionManager._loadedExtensions.delete('ml');
                            extensionManager.loadExtensionIdSync('ml');
                            console.log('ML Extension: Extension re-registered for fresh display');
                            
                            // Final workspace refresh
                            setTimeout(() => {
                                try {
                                    window.Scratch.vm.refreshWorkspace();
                                    console.log('ML Extension: Final workspace refresh after re-registration');
                                } catch (e) {
                                    console.log('ML Extension: Final refresh failed');
                                }
                            }, 200);
                        }
                    } catch (e) {
                        console.log('ML Extension: Could not re-register extension');
                    }
                }, 300);
                
            } catch (e) {
                console.log('ML Extension: Could not perform immediate UI refresh');
            }
        }
    }

    /**
     * @return {object} This extension's metadata.
     */
    getInfo() {
        // Always get the current project name from localStorage or use default
        const currentProjectName = loadFromStorage(config.STORAGE_KEYS.PROJECT_NAME) || PROJECT_NAME || config.DEFAULT_PROJECT_NAME;
        
        console.log(`ML Extension: getInfo() called - Current: ${PROJECT_NAME}, Stored: ${loadFromStorage(config.STORAGE_KEYS.PROJECT_NAME)}, Final: ${currentProjectName}`);
        
        return {
            id: 'ml',
            name: currentProjectName, // Use the most up-to-date name
            color1: config.COLOR_PRIMARY,
            color2: config.COLOR_SECONDARY,
        blocks: [
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
            {
                opcode: 'addTrainingData',
                blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'ml.addTrainingData',
                        default: 'add training data [TEXT] [LABEL]',
                        description: 'Add training data with text and label'
                    }),
                arguments: {
                        TEXT: {
                        type: ArgumentType.STRING,
                            defaultValue: 'text'
                    },
                        LABEL: {
                        type: ArgumentType.STRING,
                        defaultValue: 'Happy'
                    }
                }
            },
            {
                opcode: 'trainModel',
                blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'ml.trainModel',
                        default: 'train new machine learning model',
                        description: 'Train a new machine learning model'
                    })
            },
            {
                opcode: 'isModelReady',
                blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'ml.isModelReady',
                        default: 'is the machine learning model [STATUS]',
                        description: 'Check if the model has the specified status'
                    }),
                    arguments: {
                        STATUS: {
                            type: ArgumentType.STRING,
                            defaultValue: 'ready',
                            menu: 'modelStatus'
                        }
                    }
                },
                {
                    opcode: 'getTrainingExamples',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'ml.getTrainingExamples',
                        default: 'get training examples',
                        description: 'Get all training examples'
                    })
                },
                '---', // Separator
                {
                    opcode: 'setSessionAndProject',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'ml.setSessionAndProject',
                        default: 'set session [SESSION_ID] and project [PROJECT_ID]',
                        description: 'Set session and project IDs'
                    }),
                    arguments: {
                        SESSION_ID: {
                            type: ArgumentType.STRING,
                            defaultValue: 'session_aa3bffbf72c444c5'
                        },
                        PROJECT_ID: {
                            type: ArgumentType.STRING,
                            defaultValue: 'eff8a1b8-4998-442a-a3a2-2e386ddbc9b8'
                        }
                    }
                },
                {
                    opcode: 'getCurrentIds',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'ml.getCurrentIds',
                        default: 'get current session and project IDs',
                        description: 'Get current session and project IDs'
                    })
                },
                {
                    opcode: 'clearStoredData',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'ml.clearStoredData',
                        default: 'clear stored data',
                        description: 'Clear stored session and project data'
                    })
                }
            ],
            menus: {
                modelStatus: {
                    acceptReporters: true,
                    items: ['ready', 'training', 'trained', 'error']
                }
            }
        };
    }

    // Block implementations
    async recogniseTextLabel(args) {
        const text = args.TEXT;
        try {
            const result = await apiCall('/predict', {
                body: JSON.stringify({
                    text: text
                })
            });
            
            console.log('ML Extension: recogniseTextLabel result:', result);
            
            // Handle the actual API response structure
            if (result.success && result.label) {
                return result.label;
            } else if (result.success && result.data && result.data.prediction) {
                // Fallback to nested structure
                return result.data.prediction.label || 'unknown';
            } else if (result.success && result.data && result.data.label) {
                // Another possible structure
                return result.data.label;
            } else {
                console.warn('ML Extension: Unexpected response structure:', result);
                return 'unknown';
            }
        } catch (error) {
            console.error('ML Extension: Error in recogniseTextLabel:', error);
            return 'error';
        }
    }

    async recogniseTextConfidence(args) {
        const text = args.TEXT;
        try {
            const result = await apiCall('/predict', {
                body: JSON.stringify({
                    text: text
                })
            });
            
            console.log('ML Extension: recogniseTextConfidence result:', result);
            
            // Handle the actual API response structure - same as recogniseTextLabel
            if (result.success && result.confidence !== undefined) {
                // API returns confidence as percentage (e.g., 52.86), so return as is
                return result.confidence;
            } else if (result.success && result.data && result.data.prediction) {
                // Fallback to nested structure
                return result.data.prediction.confidence || 0;
            } else if (result.success && result.data && result.data.confidence !== undefined) {
                // Another possible structure
                return result.data.confidence;
            } else {
                console.warn('ML Extension: Unexpected response structure for confidence:', result);
                return 0;
            }
        } catch (error) {
            console.error('ML Extension: Error in recogniseTextConfidence:', error);
            return 0;
        }
    }

    async addTrainingData(args) {
        const text = args.TEXT;
        const label = args.LABEL;
        try {
            const result = await apiCall('/examples', {
                body: JSON.stringify({
                    text: text,
                    label: label
                })
            });
            
            if (result.success) {
                console.log(`ML Extension: Training data added - Text: ${text}, Label: ${label}`);
            } else {
                console.error('ML Extension: Failed to add training data:', result);
            }
        } catch (error) {
            console.error('ML Extension: Error in addTrainingData:', error);
        }
    }

    async trainModel() {
        try {
            const result = await apiCall('/train', {
                body: JSON.stringify({})
            });
            
            if (result.success) {
                console.log('ML Extension: Model training started');
            } else {
                console.error('ML Extension: Failed to start training:', result);
            }
        } catch (error) {
            console.error('ML Extension: Error in trainModel:', error);
        }
    }

    async isModelReady(args) {
        const status = args.STATUS.toLowerCase();
        try {
            const result = await apiCall('/train', {
                body: JSON.stringify({
                    check_status: true,
                    expected_status: status
                })
            });
            
            if (result.success && result.data && result.data.status) {
                const currentStatus = result.data.status.toLowerCase();
                return currentStatus === status;
            }
            return false;
        } catch (error) {
            console.error('ML Extension: Error in isModelReady:', error);
            return false;
        }
    }

    async getTrainingExamples() {
        try {
            const result = await apiCall('/examples', {
                body: JSON.stringify({
                    get_examples: true
                })
            });
            
            if (result.success && result.data && Array.isArray(result.data)) {
                return JSON.stringify(result.data);
            }
            return '[]';
        } catch (error) {
            console.error('ML Extension: Error in getTrainingExamples:', error);
            return '[]';
        }
    }

    // Utility blocks
    async setSessionAndProject(args) {
        const sessionId = args.SESSION_ID;
        const projectId = args.PROJECT_ID;
        await setSessionAndProjectIds(sessionId, projectId);
    }

    getCurrentIds() {
        return JSON.stringify({
            sessionId: SESSION_ID,
            projectId: PROJECT_ID,
            projectName: PROJECT_NAME
        });
    }

    clearStoredData() {
        clearStorage();
        SESSION_ID = '';
        PROJECT_ID = '';
        PROJECT_NAME = config.DEFAULT_PROJECT_NAME;
        console.log('ML Extension: All stored data cleared');
    }
}

// Function to check for localStorage vs URL mismatches
function checkForMismatches() {
    if (typeof window !== 'undefined' && window.location) {
        const url = window.location.href;
        const urlSessionMatch = url.match(/[?&]sessionId[=:]([^&\/]+)/);
        const urlProjectMatch = url.match(/[?&]projectId[=:]([^&\/]+)/);
        
        if (urlSessionMatch && urlProjectMatch) {
            const urlSessionId = urlSessionMatch[1];
            const urlProjectId = urlProjectMatch[1];
            
            const storedSessionId = loadFromStorage(config.STORAGE_KEYS.SESSION_ID);
            const storedProjectId = loadFromStorage(config.STORAGE_KEYS.PROJECT_ID);
            
            if (storedSessionId && storedProjectId) {
                if (storedSessionId !== urlSessionId || storedProjectId !== urlProjectId) {
                    console.log('ML Extension: URL vs localStorage comparison:');
                    console.log('URL parameters:', { sessionId: urlSessionId, projectId: urlProjectId });
                    console.log('localStorage values:', { sessionId: storedSessionId, projectId: storedProjectId });
                    console.log('Note: URL parameters take priority. localStorage values may be outdated.');
                    console.log('The extension will use URL parameters for API calls.');
                } else {
                    console.log('ML Extension: URL and localStorage values are in sync');
                }
            }
        }
    }
}

// Initialize extension
const extensionObject = new MLExtension();

// Check for mismatches after initialization
setTimeout(() => {
    checkForMismatches();
}, 1000); // Small delay to ensure everything is loaded

// Set up periodic refresh of extension name from both localStorage and API
setInterval(() => {
    // Check localStorage first
    const storedProjectName = loadFromStorage(config.STORAGE_KEYS.PROJECT_NAME);
    if (storedProjectName && storedProjectName !== PROJECT_NAME) {
        console.log(`ML Extension: Project name changed from "${PROJECT_NAME}" to "${storedProjectName}"`);
        PROJECT_NAME = storedProjectName;
        
        // Try to refresh the workspace to show new name
        if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
            try {
                window.Scratch.vm.refreshWorkspace();
                console.log('ML Extension: Workspace refreshed to show new project name');
            } catch (e) {
                console.log('ML Extension: Could not refresh workspace, but project name updated');
            }
        }
    }
    
    // Also periodically fetch from API if we have valid session/project IDs
    if (SESSION_ID && PROJECT_ID) {
        fetchProjectName().then(apiProjectName => {
            if (apiProjectName && apiProjectName !== config.DEFAULT_PROJECT_NAME && apiProjectName !== PROJECT_NAME) {
                console.log(`ML Extension: Project name updated from API periodic check: "${PROJECT_NAME}" -> "${apiProjectName}"`);
                PROJECT_NAME = apiProjectName;
                
                // Try to refresh the workspace
                if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                    try {
                        window.Scratch.vm.refreshWorkspace();
                        console.log('ML Extension: Workspace refreshed after API periodic check');
                    } catch (e) {
                        console.log('ML Extension: Could not refresh workspace after API check');
                    }
                }
            }
        }).catch(error => {
            console.warn('ML Extension: Periodic API check failed:', error);
        });
    }
}, 5000); // Check every 5 seconds

// Add global functions for testing from browser console
if (typeof window !== 'undefined') {
    window.MLExtension = {
        setIds: setSessionAndProjectIds,
        getIds: () => ({ 
            sessionId: SESSION_ID, 
            projectId: PROJECT_ID, 
            projectName: PROJECT_NAME 
        }),
        testConnection: async () => {
            try {
                if (!SESSION_ID || !PROJECT_ID) {
                    return 'No session/project IDs set';
                }
                const response = await apiCall('', { 
                    body: JSON.stringify({ test_connection: true })
                });
                return response;
            } catch (error) {
                return { error: error.message };
            }
        },
        setApiUrl: (url) => {
            console.log(`ML Extension: Note - API URL is configured in config.js: ${url}`);
        },
        clearStorage: clearStorage,
        initFromUrl: () => {
            initializeIds();
            if (SESSION_ID && PROJECT_ID) {
                fetchProjectName();
            }
        },
        refreshProjectName: async () => {
            if (SESSION_ID && PROJECT_ID) {
                const newName = await fetchProjectName();
                return { success: true, projectName: newName };
            } else {
                return { success: false, error: 'No session or project ID set' };
            }
        },
        forceUIRefresh: () => {
            if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                try {
                    window.Scratch.vm.refreshWorkspace();
                    return { success: true, message: 'Workspace refreshed' };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            } else {
                return { success: false, error: 'Scratch VM not available' };
            }
        },
        setProjectName: (name) => {
            if (name && typeof name === 'string') {
                PROJECT_NAME = name;
                saveToStorage(config.STORAGE_KEYS.PROJECT_NAME, PROJECT_NAME);
                console.log(`ML Extension: Project name manually set to: ${PROJECT_NAME}`);
                return { success: true, projectName: PROJECT_NAME };
            } else {
                return { success: false, error: 'Invalid project name' };
            }
        },
        checkProjectNameStatus: async () => {
            if (!SESSION_ID || !PROJECT_ID) {
                return { success: false, error: 'No session or project ID set' };
            }
            
            try {
                const url = `${API_BASE_URL}/api/guests/session/${SESSION_ID}/projects/${PROJECT_ID}`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.success && result.data) {
                    const apiProjectName = result.data.name || 'unknown';
                    const isCurrent = apiProjectName === PROJECT_NAME;
                    
                    return {
                        success: true,
                        currentName: PROJECT_NAME,
                        apiName: apiProjectName,
                        isCurrent: isCurrent,
                        needsUpdate: !isCurrent
                    };
                } else {
                    return { success: false, error: 'API call failed' };
                }
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        testCORS: async () => {
            const testUrls = [
                `${API_BASE_URL}/api/guests/session/test/projects/test`,
                'http://localhost:8080/api/guests/session/test/projects/test',
                'http://localhost:3000/api/guests/session/test/projects/test'
            ];
            
            const results = [];
            
            for (const url of testUrls) {
                try {
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    results.push({
                        url: url,
                        status: response.status,
                        cors: response.headers.get('Access-Control-Allow-Origin') || 'Not set',
                        success: true
                    });
                } catch (error) {
                    results.push({
                        url: url,
                        status: 'Error',
                        cors: 'N/A',
                        success: false,
                        error: error.message
                    });
                }
            }
            
            return {
                success: true,
                results: results,
                currentConfig: API_BASE_URL,
                recommendation: results.find(r => r.success && r.cors !== 'Not set') 
                    ? 'Use the URL that shows CORS headers' 
                    : 'Configure CORS in your backend'
            };
        },
        syncWithUrl: () => {
            // Force sync localStorage with URL parameters (primary method)
            const url = window.location.href;
            const urlSessionMatch = url.match(/[?&]sessionId[=:]([^&\/]+)/);
            const urlProjectMatch = url.match(/[?&]projectId[=:]([^&\/]+)/);
            
            if (urlSessionMatch && urlProjectMatch) {
                const urlSessionId = urlSessionMatch[1];
                const urlProjectId = urlProjectMatch[1];
                
                // Update localStorage with URL values
                saveToStorage(config.STORAGE_KEYS.SESSION_ID, urlSessionId);
                saveToStorage(config.STORAGE_KEYS.PROJECT_ID, urlProjectId);
                
                // Update global variables
                SESSION_ID = urlSessionId;
                PROJECT_ID = urlProjectId;
                
                console.log('ML Extension: Synced with URL parameters:', {
                    sessionId: urlSessionId,
                    projectId: urlProjectId
                });
                
                // Try to fetch project name
                fetchProjectName();
                
                return { success: true, message: 'Synced with URL parameters' };
            } else {
                return { success: false, error: 'No URL parameters found' };
            }
        },
        forceUseLocalStorage: () => {
            // Force the extension to use localStorage values (fallback method)
            const storedSessionId = loadFromStorage(config.STORAGE_KEYS.SESSION_ID);
            const storedProjectId = loadFromStorage(config.STORAGE_KEYS.PROJECT_ID);
            const storedProjectName = loadFromStorage(config.STORAGE_KEYS.PROJECT_NAME);
            
            if (storedSessionId && storedProjectId) {
                SESSION_ID = storedSessionId;
                PROJECT_ID = storedProjectId;
                PROJECT_NAME = storedProjectName || config.DEFAULT_PROJECT_NAME;
                
                console.log('ML Extension: Forced to use localStorage values (fallback):', {
                    sessionId: SESSION_ID,
                    projectId: PROJECT_ID,
                    projectName: PROJECT_NAME
                });
                
                return { success: true, message: 'Using localStorage values' };
            } else {
                return { success: false, error: 'No localStorage data found' };
            }
        },
        getStatus: () => {
            // Get comprehensive status of the extension
            const url = window.location.href;
            const urlSessionMatch = url.match(/[?&]sessionId[=:]([^&\/]+)/);
            const urlProjectMatch = url.match(/[?&]projectId[=:]([^&\/]+)/);
            
            const urlSessionId = urlSessionMatch ? urlSessionMatch[1] : null;
            const urlProjectId = urlProjectMatch ? urlProjectMatch[1] : null;
            
            const storedSessionId = loadFromStorage(config.STORAGE_KEYS.SESSION_ID);
            const storedProjectId = loadFromStorage(config.STORAGE_KEYS.PROJECT_ID);
            const storedProjectName = loadFromStorage(config.STORAGE_KEYS.PROJECT_NAME);
            
            const hasMismatch = (storedSessionId && storedProjectId) && 
                               (storedSessionId !== urlSessionId || storedProjectId !== urlProjectId);
            
            return {
                current: {
                    sessionId: SESSION_ID,
                    projectId: PROJECT_ID,
                    projectName: PROJECT_NAME
                },
                localStorage: {
                    sessionId: storedSessionId,
                    projectId: storedProjectId,
                    projectName: storedProjectName
                },
                url: {
                    sessionId: urlSessionId,
                    projectId: urlProjectId
                },
                hasMismatch: hasMismatch,
                priority: 'URL parameters take priority over localStorage',
                recommendation: hasMismatch ? 
                    'URL parameters take priority. Use MLExtension.forceUseLocalStorage() if you need localStorage values' : 
                    'All values are in sync'
            };
        },
        updateExtensionName: () => {
            // Force update the extension name in Scratch
            const storedProjectName = loadFromStorage(config.STORAGE_KEYS.PROJECT_NAME);
            if (storedProjectName) {
                PROJECT_NAME = storedProjectName;
                console.log(`ML Extension: Project name updated to: ${PROJECT_NAME}`);
                
                // Try to refresh the Scratch workspace to show new name
                if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                    try {
                        // Force refresh of the extension blocks
                        window.Scratch.vm.refreshWorkspace();
                        console.log('ML Extension: Workspace refreshed to show new project name');
                        return { success: true, message: 'Extension name updated and workspace refreshed', projectName: PROJECT_NAME };
                    } catch (e) {
                        console.log('ML Extension: Could not refresh workspace, but project name updated');
                        return { success: true, message: 'Extension name updated but workspace refresh failed', projectName: PROJECT_NAME, error: e.message };
                    }
                } else {
                    return { success: true, message: 'Extension name updated but Scratch VM not available', projectName: PROJECT_NAME };
                }
            } else {
                return { success: false, error: 'No project name found in localStorage' };
            }
        },
        refreshExtensionDisplay: () => {
            // Comprehensive refresh of extension display
            const storedProjectName = loadFromStorage(config.STORAGE_KEYS.PROJECT_NAME);
            const storedProjectId = loadFromStorage(config.STORAGE_KEYS.PROJECT_ID);
            const storedSessionId = loadFromStorage(config.STORAGE_KEYS.SESSION_ID);
            
            if (storedProjectName && storedProjectId && storedSessionId) {
                // Update global variables
                PROJECT_NAME = storedProjectName;
                PROJECT_ID = storedProjectId;
                SESSION_ID = storedSessionId;
                
                console.log('ML Extension: All values refreshed from localStorage:', {
                    projectName: PROJECT_NAME,
                    projectId: PROJECT_ID,
                    sessionId: SESSION_ID
                });
                
                // Try to refresh Scratch workspace
                if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                    try {
                        window.Scratch.vm.refreshWorkspace();
                        console.log('ML Extension: Workspace refreshed with new values');
                        return { success: true, message: 'Extension refreshed and workspace updated' };
                    } catch (e) {
                        console.log('ML Extension: Could not refresh workspace, but values updated');
                        return { success: true, message: 'Extension refreshed but workspace update failed', error: e.message };
                    }
                } else {
                    return { success: true, message: 'Extension refreshed but Scratch VM not available' };
                }
            } else {
                return { success: false, error: 'Missing required data in localStorage' };
            }
        },
        testPredictResponse: async (text = 'test') => {
            // Test function to debug API response parsing
            try {
                const result = await apiCall('/predict', {
                    body: JSON.stringify({ text: text })
                });
                
                console.log('ML Extension: Test predict response:', result);
                
                // Test different parsing approaches
                const testResults = {
                    original: result,
                    directLabel: result.success && result.label ? result.label : 'NOT_FOUND',
                    directConfidence: result.success && result.confidence !== undefined ? result.confidence : 'NOT_FOUND',
                    nestedLabel: result.success && result.data && result.data.prediction ? result.data.prediction.label : 'NOT_FOUND',
                    nestedConfidence: result.success && result.data && result.data.prediction ? result.data.prediction.confidence : 'NOT_FOUND'
                };
                
                console.log('ML Extension: Parsing test results:', testResults);
                
                return {
                    success: true,
                    apiResponse: result,
                    parsingResults: testResults,
                    recommendation: result.success && result.label ? 
                        'Use direct properties (result.label, result.confidence)' : 
                        'Check response structure - may need nested properties'
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        forceUpdateProjectName: async () => {
            // Force update project name from API and refresh UI
            if (!SESSION_ID || !PROJECT_ID) {
                return { success: false, error: 'No session or project ID available' };
            }
            
            try {
                console.log('ML Extension: Force updating project name from API...');
                const newProjectName = await fetchProjectName();
                
                if (newProjectName && newProjectName !== config.DEFAULT_PROJECT_NAME) {
                    PROJECT_NAME = newProjectName;
                    
                    // Force multiple UI refreshes
                    if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                        try {
                            // Immediate refresh
                            window.Scratch.vm.refreshWorkspace();
                            
                            // Delayed refreshes
                            setTimeout(() => window.Scratch.vm.refreshWorkspace(), 500);
                            setTimeout(() => window.Scratch.vm.refreshWorkspace(), 1000);
                            setTimeout(() => {
                                window.Scratch.vm.emit('BLOCKSINFO_UPDATE');
                                console.log('ML Extension: Extension blocks info updated');
                            }, 1500);
                            
                            console.log('ML Extension: UI refresh attempts completed');
                        } catch (e) {
                            console.warn('ML Extension: UI refresh failed:', e);
                        }
                    }
                    
                    return {
                        success: true,
                        projectName: newProjectName,
                        message: 'Project name updated and UI refresh attempted'
                    };
                } else {
                    return {
                        success: false,
                        error: 'Failed to fetch valid project name from API'
                    };
                }
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
    };
    
    console.log('ML Extension: Global functions available at window.MLExtension');
    console.log('ML Extension: Available functions:');
    console.log('  - MLExtension.setIds(sessionId, projectId)');
    console.log('  - MLExtension.getIds()');
    console.log('  - MLExtension.testConnection()');
    console.log('  - MLExtension.clearStorage()');
    console.log('  - MLExtension.initFromUrl()');
    console.log('  - MLExtension.refreshProjectName()');
    console.log('  - MLExtension.forceUIRefresh()');
    console.log('  - MLExtension.setProjectName(name)');
    console.log('  - MLExtension.checkProjectNameStatus()');
    console.log('  - MLExtension.testCORS()');
    console.log('  - MLExtension.syncWithUrl() - Sync localStorage with URL parameters (primary)');
    console.log('  - MLExtension.forceUseLocalStorage() - Force use localStorage values (fallback)');
    console.log('  - MLExtension.getStatus() - Get comprehensive extension status');
    console.log('  - MLExtension.updateExtensionName() - Update extension name in Scratch');
    console.log('  - MLExtension.refreshExtensionDisplay() - Refresh entire extension display');
    console.log('  - MLExtension.testPredictResponse(text) - Test API response parsing');
    console.log('  - MLExtension.forceUpdateProjectName() - Force update project name from API');
}

console.log(`ML Extension: Extension loaded with project name: ${PROJECT_NAME}`);
console.log(`ML Extension: Session ID: ${SESSION_ID || 'Not set'}`);
console.log(`ML Extension: Project ID: ${PROJECT_ID || 'Not set'}`);

module.exports = MLExtension;