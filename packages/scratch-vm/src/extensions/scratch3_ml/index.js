const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');
const config = require('./config');

/**
 * ML Extension for Scratch - SIMPLIFIED VERSION
 * 
 * This extension provides only essential ML functionality:
 * - recognise text (label) - Returns predicted label for text
 * - recognise text (confidence) - Returns confidence score for text
 * - Dynamic label blocks - Automatically generated from API response
 * 
 * Features:
 * - 30-second cache duration for project names
 * - 60-second cache duration for project details
 * - Minimum 10-second interval between API requests
 * - Prevents duplicate concurrent requests
 * - Smart periodic checks (every 30 seconds)
 * 
 * Cache can be cleared manually using MLExtension.clearCache()
 * Cache status can be checked using MLExtension.getCacheStatus()
 */

// Global variables
let SESSION_ID = '';
let PROJECT_ID = '';
let PROJECT_NAME = config.DEFAULT_PROJECT_NAME;
const API_BASE_URL = config.API_BASE_URL;

// Add caching and throttling variables
let lastProjectNameFetch = 0;
let lastProjectNameResult = null;
let isFetchingProjectName = false;
const PROJECT_NAME_CACHE_DURATION = 30000; // 30 seconds cache
const MIN_FETCH_INTERVAL = 10000; // Minimum 10 seconds between fetches

// Add project details caching
let lastProjectDetailsFetch = 0;
let lastProjectDetailsResult = null;
let isFetchingProjectDetails = false;
let projectLabels = []; // Store the labels from the API
const PROJECT_DETAILS_CACHE_DURATION = 60000; // 1 minute cache for project details

// Add project detection variables
let currentProjectId = null;
let isProjectDetectionActive = false;
let projectDetectionInterval = null;

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

// Function to fetch project name from backend with caching and throttling
async function fetchProjectName(force = false) {
    if (!SESSION_ID || !PROJECT_ID) {
        console.warn('ML Extension: Cannot fetch project name - missing session_id or project_id');
        return config.DEFAULT_PROJECT_NAME;
    }

    const now = Date.now();
    
    // Check if we're already fetching
    if (isFetchingProjectName && !force) {
        console.log('ML Extension: Project name fetch already in progress, skipping duplicate request');
        return lastProjectNameResult || PROJECT_NAME;
    }
    
    // Check cache duration
    if (!force && lastProjectNameResult && (now - lastProjectNameFetch) < PROJECT_NAME_CACHE_DURATION) {
        console.log('ML Extension: Using cached project name (cache valid for', Math.round((PROJECT_NAME_CACHE_DURATION - (now - lastProjectNameFetch)) / 1000), 'more seconds)');
        return lastProjectNameResult;
    }
    
    // Check minimum fetch interval
    if (!force && (now - lastProjectNameFetch) < MIN_FETCH_INTERVAL) {
        console.log('ML Extension: Skipping fetch - too soon since last request (minimum interval:', MIN_FETCH_INTERVAL / 1000, 'seconds)');
        return lastProjectNameResult || PROJECT_NAME;
    }

    try {
        isFetchingProjectName = true;
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
            
            // Only update if the name actually changed
            if (newProjectName !== PROJECT_NAME) {
                PROJECT_NAME = newProjectName;
                saveToStorage(config.STORAGE_KEYS.PROJECT_NAME, PROJECT_NAME);
                console.log(`ML Extension: Project name updated from API to: ${PROJECT_NAME}`);
                
                // Force UI refresh only when name actually changes
                if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                    try {
                        window.Scratch.vm.refreshWorkspace();
                        console.log('ML Extension: Workspace refreshed after project name update');
                    } catch (e) {
                        console.log('ML Extension: Could not refresh workspace after project name update:', e);
                    }
                }
            } else {
                console.log('ML Extension: Project name unchanged, no UI refresh needed');
            }
            
            // Update cache
            lastProjectNameResult = PROJECT_NAME;
            lastProjectNameFetch = now;
            
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
    } finally {
        isFetchingProjectName = false;
    }
}

// Function to fetch project details and extract labels
async function fetchProjectDetails(force = false) {
    if (!SESSION_ID || !PROJECT_ID) {
        console.warn('ML Extension: Cannot fetch project details - missing session_id or project_id');
        return null;
    }

    const now = Date.now();
    
    // Check if we're already fetching
    if (isFetchingProjectDetails && !force) {
        console.log('ML Extension: Project details fetch already in progress, skipping duplicate request');
        return lastProjectDetailsResult;
    }
    
    // Check cache duration
    if (!force && lastProjectDetailsResult && (now - lastProjectDetailsFetch) < PROJECT_DETAILS_CACHE_DURATION) {
        console.log('ML Extension: Using cached project details (cache valid for', Math.round((PROJECT_DETAILS_CACHE_DURATION - (now - lastProjectDetailsFetch)) / 1000), 'more seconds)');
        return lastProjectDetailsResult;
    }

    try {
        isFetchingProjectDetails = true;
        const url = `${API_BASE_URL}/api/guests/session/${SESSION_ID}/projects/${PROJECT_ID}`;
        console.log(`ML Extension: Fetching project details from: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('ML Extension: Project details API response:', data);
        
        // Extract labels from the response
        if (data.success && data.data && data.data.model && Array.isArray(data.data.model.labels)) {
            projectLabels = data.data.model.labels;
            console.log(`ML Extension: Extracted ${projectLabels.length} labels:`, projectLabels);
            
            // Store labels in localStorage for persistence
            saveToStorage('ml_extension_project_labels', JSON.stringify(projectLabels));
            
            // Create dynamic methods for the new labels
            if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                try {
                    const extensionManager = window.Scratch.vm.extensionManager;
                    if (extensionManager && extensionManager._loadedExtensions.has('ml')) {
                        const extension = extensionManager._loadedExtensions.get('ml');
                        if (extension && extension.createDynamicLabelMethods) {
                            extension.createDynamicLabelMethods();
                            console.log('ML Extension: Dynamic label methods created from API response');
                        }
                    }
                } catch (e) {
                    console.log('ML Extension: Could not create dynamic methods from API response:', e);
                }
            }
        } else {
            console.warn('ML Extension: No labels found in project data, using empty array');
            projectLabels = [];
            saveToStorage('ml_extension_project_labels', JSON.stringify(projectLabels));
        }
        
        // Update cache
        lastProjectDetailsResult = data;
        lastProjectDetailsFetch = now;
        
        return data;
    } catch (error) {
        console.error('ML Extension: Error fetching project details:', error);
        return null;
    } finally {
        isFetchingProjectDetails = false;
    }
}

// Function to automatically detect when a project is opened
function startProjectDetection() {
    if (isProjectDetectionActive) {
        console.log('ML Extension: Project detection already active');
        return;
    }
    
    console.log('ML Extension: Starting automatic project detection...');
    isProjectDetectionActive = true;
    
    // Check for project ID in URL immediately
    detectProjectFromURL();
    
    // Set up interval to check for project changes
    projectDetectionInterval = setInterval(() => {
        detectProjectFromURL();
    }, 5000); // Check every 5 seconds for project changes (reduced frequency)
    
    // Also listen for URL changes
    if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('popstate', detectProjectFromURL);
        window.addEventListener('hashchange', detectProjectFromURL);
    }
}

// Function to detect project ID from URL and automatically fetch details
function detectProjectFromURL() {
    if (typeof window === 'undefined' || !window.location) {
        return;
    }
    
    const url = window.location.href;
    
    // Try multiple URL patterns for projectId
    let projectMatch = url.match(/[?&]projectId[=:]([^&\/]+)/);
    if (!projectMatch) {
        projectMatch = url.match(/[?&]project[=:]([^&\/]+)/);
    }
    if (!projectMatch) {
        projectMatch = url.match(/\/projects\/([^\/\?&]+)/);
    }
    if (!projectMatch) {
        projectMatch = url.match(/\/project\/([^\/\?&]+)/);
    }
    
    if (projectMatch) {
        const detectedProjectId = projectMatch[1];
        
        // Check if this is a new project
        if (detectedProjectId !== currentProjectId) {
            console.log(`ML Extension: 🎯 NEW PROJECT DETECTED: ${currentProjectId || 'none'} → ${detectedProjectId}`);
            currentProjectId = detectedProjectId;
            
            // Update the global PROJECT_ID
            PROJECT_ID = detectedProjectId;
            saveToStorage(config.STORAGE_KEYS.PROJECT_ID, PROJECT_ID);
            
            // Clear all caches to force fresh fetch
            lastProjectDetailsFetch = 0;
            lastProjectDetailsResult = null;
            lastProjectNameFetch = 0;
            lastProjectNameResult = null;
            projectLabels = [];
            
            // Clear stored labels to force refresh
            saveToStorage('ml_extension_project_labels', '[]');
            
            // Automatically fetch project details for the new project
            if (SESSION_ID && PROJECT_ID) {
                console.log('ML Extension: 🚀 Auto-fetching details for new project...');
                
                // Fetch both project details and project name
                Promise.all([
                    fetchProjectDetails(true),
                    fetchProjectName(true)
                ]).then(([details, projectName]) => {
                    console.log(`ML Extension: ✅ Successfully loaded new project: ${PROJECT_NAME}`);
                    console.log(`ML Extension: 📝 Labels found: ${projectLabels.join(', ')}`);
                    
                    // Force UI refresh to show new project name and labels
                    if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                        try {
                            window.Scratch.vm.refreshWorkspace();
                            console.log('ML Extension: 🔄 Workspace refreshed for new project');
                        } catch (e) {
                            console.log('ML Extension: ⚠️ Could not refresh workspace for new project:', e);
                        }
                    }
                }).catch(error => {
                    console.error('ML Extension: ❌ Error auto-fetching project details:', error);
                });
            }
        } else {
            // Same project, no need to log every time
            // console.log(`ML Extension: Same project detected: ${detectedProjectId}`);
        }
    } else {
        // Only log if we previously had a project
        if (currentProjectId) {
            console.log('ML Extension: ⚠️ No project ID detected in URL');
        }
    }
}

// Function to stop project detection
function stopProjectDetection() {
    if (projectDetectionInterval) {
        clearInterval(projectDetectionInterval);
        projectDetectionInterval = null;
    }
    
    if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('popstate', detectProjectFromURL);
        window.removeEventListener('hashchange', detectProjectFromURL);
    }
    
    isProjectDetectionActive = false;
    console.log('ML Extension: Project detection stopped');
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
        
        // Check localStorage for project name on initialization (fast, no API call)
        const storedProjectName = loadFromStorage(config.STORAGE_KEYS.PROJECT_NAME);
        if (storedProjectName && storedProjectName !== config.DEFAULT_PROJECT_NAME) {
            PROJECT_NAME = storedProjectName;
            console.log(`ML Extension: Project name loaded from localStorage: ${PROJECT_NAME}`);
        }
        
        // Only fetch project name from API if we don't have a valid name and IDs are available
        if (SESSION_ID && PROJECT_ID && (!PROJECT_NAME || PROJECT_NAME === config.DEFAULT_PROJECT_NAME)) {
            console.log('ML Extension: No valid project name found, fetching from API...');
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
        } else if (SESSION_ID && PROJECT_ID) {
            console.log(`ML Extension: Using existing project name: ${PROJECT_NAME}`);
        }
        
        // Load project labels from localStorage or fetch from API
        this.loadProjectLabels();
        
        // Start automatic project detection
        this.startAutoProjectDetection();
        
        console.log(`ML Extension: Initialized with project name: ${PROJECT_NAME}`);
    }
    
    // Start automatic project detection
    startAutoProjectDetection() {
        // Small delay to ensure Scratch is fully loaded
        setTimeout(() => {
            startProjectDetection();
        }, 1000);
    }
    
    // Load project labels from localStorage or fetch from API
    async loadProjectLabels() {
        // First try to load from localStorage
        const storedLabels = loadFromStorage('ml_extension_project_labels');
        if (storedLabels) {
            try {
                projectLabels = JSON.parse(storedLabels);
                console.log(`ML Extension: Loaded ${projectLabels.length} labels from localStorage:`, projectLabels);
                // Create dynamic methods for stored labels
                this.createDynamicLabelMethods();
            } catch (e) {
                console.warn('ML Extension: Failed to parse stored labels, clearing storage');
                saveToStorage('ml_extension_project_labels', '[]');
                projectLabels = [];
            }
        }
        
        // If we have session and project IDs, fetch fresh labels from API
        if (SESSION_ID && PROJECT_ID) {
            console.log('ML Extension: Fetching fresh project details to get labels...');
            fetchProjectDetails().then(details => {
                if (details && projectLabels.length > 0) {
                    console.log(`ML Extension: Successfully loaded ${projectLabels.length} labels from API`);
                    // Create dynamic methods for the labels
                    this.createDynamicLabelMethods();
                    // Force UI refresh to show new label blocks
                    this.forceImmediateUIRefresh();
                }
            }).catch(error => {
                console.error('ML Extension: Error fetching project details on init:', error);
            });
        }
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
        console.log(`ML Extension: Available labels for blocks:`, projectLabels);
        
        // Build the blocks array dynamically - ONLY essential blocks
        const blocks = [
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
            }
        ];
        
        // Add dynamic label blocks based on projectLabels
        if (projectLabels && projectLabels.length > 0) {
            // Add separator before label blocks
            blocks.push('---');
            
            // Add label blocks for each label
            projectLabels.forEach((label, index) => {
                blocks.push({
                    opcode: `label_${index}`,
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: `ml.label.${label.toLowerCase()}`,
                        default: label,
                        description: `Label: ${label}`
                    })
                });
            });
            
            console.log(`ML Extension: Added ${projectLabels.length} dynamic label blocks`);
        } else {
            console.log('ML Extension: No labels available, skipping dynamic label blocks');
        }
        
        return {
            id: 'ml',
            name: currentProjectName, // Use the most up-to-date name
            color1: config.COLOR_PRIMARY,
            color2: config.COLOR_SECONDARY,
            blocks: blocks
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










    
    // Dynamic label block implementations
    // These methods are generated dynamically based on the projectLabels array
    // Each label gets its own method that returns the label value
    
    // Method to get a label by index
    getLabelByIndex(index) {
        if (projectLabels && projectLabels[index] !== undefined) {
            return projectLabels[index];
        }
        return 'unknown';
    }
    
    // Method to get all available labels
    getAllLabels() {
        return projectLabels.join(', ');
    }
    
    // Method to check if a specific label exists
    hasLabel(label) {
        return projectLabels && projectLabels.includes(label);
    }
    
    // Method to get the count of available labels
    getLabelCount() {
        return projectLabels ? projectLabels.length : 0;
    }
    
    // Dynamic label block implementations
    // These methods are called by the dynamically generated label blocks
    // Each label block gets its own method that returns the label value
    
    // Dynamic label block implementations
    // These methods are called by the dynamically generated label blocks
    // Each label block gets its own method that returns the label value
    
    // Generic method to handle all label blocks
    getLabelValue(args, util) {
        // Extract the opcode to determine which label to return
        const opcode = util.runtime.getOpcode();
        if (opcode && opcode.startsWith('label_')) {
            const index = parseInt(opcode.replace('label_', ''));
            if (!isNaN(index) && projectLabels && projectLabels[index] !== undefined) {
                console.log(`ML Extension: Label block ${index} returning: ${projectLabels[index]}`);
                return projectLabels[index];
            }
        }
        return 'unknown';
    }
    
    // Dynamic label methods - these are created based on the projectLabels array
    // Each label block will call its corresponding method
    
    // Method for label_0 (first label)
    label_0() {
        if (projectLabels && projectLabels[0] !== undefined) {
            console.log(`ML Extension: label_0 returning: ${projectLabels[0]}`);
            return projectLabels[0];
        }
        return 'unknown';
    }
    
    // Method for label_1 (second label)
    label_1() {
        if (projectLabels && projectLabels[1] !== undefined) {
            console.log(`ML Extension: label_1 returning: ${projectLabels[1]}`);
            return projectLabels[1];
        }
        return 'unknown';
    }
    
    // Method for label_2 (third label)
    label_2() {
        if (projectLabels && projectLabels[2] !== undefined) {
            console.log(`ML Extension: label_2 returning: ${projectLabels[2]}`);
            return projectLabels[2];
        }
        return 'unknown';
    }
    
    // Method for label_3 (fourth label)
    label_3() {
        if (projectLabels && projectLabels[3] !== undefined) {
            console.log(`ML Extension: label_3 returning: ${projectLabels[3]}`);
            return projectLabels[3];
        }
        return 'unknown';
    }
    
    // Method for label_4 (fifth label)
    label_4() {
        if (projectLabels && projectLabels[4] !== undefined) {
            console.log(`ML Extension: label_4 returning: ${projectLabels[4]}`);
            return projectLabels[4];
        }
        return 'unknown';
    }
    
    // Generic method for any label index (fallback)
    getLabelByIndex(index) {
        if (projectLabels && projectLabels[index] !== undefined) {
            console.log(`ML Extension: getLabelByIndex(${index}) returning: ${projectLabels[index]}`);
            return projectLabels[index];
        }
        return 'unknown';
    }
    
    // Method to dynamically create label methods for any number of labels
    createDynamicLabelMethods() {
        if (!projectLabels || projectLabels.length === 0) {
            console.log('ML Extension: No labels available for dynamic method creation');
            return;
        }
        
        console.log(`ML Extension: Creating dynamic methods for ${projectLabels.length} labels`);
        
        // Create methods for each label dynamically
        projectLabels.forEach((label, index) => {
            const methodName = `label_${index}`;
            
            // Only create the method if it doesn't already exist
            if (!this[methodName]) {
                this[methodName] = function() {
                    console.log(`ML Extension: Dynamic method ${methodName} returning: ${label}`);
                    return label;
                };
                console.log(`ML Extension: Created dynamic method: ${methodName}`);
            }
        });
    }
    
    // Cleanup method to stop project detection
    cleanup() {
        stopProjectDetection();
        console.log('ML Extension: Cleanup completed');
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

// Cleanup when extension is unloaded
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (extensionObject && extensionObject.cleanup) {
            extensionObject.cleanup();
        }
    });
}

// Check for mismatches after initialization
setTimeout(() => {
    checkForMismatches();
}, 1000); // Small delay to ensure everything is loaded

// Set up periodic refresh of extension name from both localStorage and API
// Reduced frequency and added smart logic to prevent unnecessary API calls
setInterval(() => {
    // Check localStorage first (this is fast and doesn't make network requests)
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
    
    // Only fetch from API if we have valid session/project IDs AND enough time has passed
    if (SESSION_ID && PROJECT_ID) {
        const now = Date.now();
        const timeSinceLastFetch = now - lastProjectNameFetch;
        
        // Only fetch if cache is expired and minimum interval has passed
        if (timeSinceLastFetch >= PROJECT_NAME_CACHE_DURATION && timeSinceLastFetch >= MIN_FETCH_INTERVAL) {
            console.log(`ML Extension: Periodic API check - cache expired (${Math.round(timeSinceLastFetch / 1000)}s since last fetch)`);
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
                } else {
                    console.log('ML Extension: Periodic API check - no changes detected');
                }
            }).catch(error => {
                console.warn('ML Extension: Periodic API check failed:', error);
            });
        } else {
            const remainingCache = Math.max(0, PROJECT_NAME_CACHE_DURATION - timeSinceLastFetch);
            const remainingInterval = Math.max(0, MIN_FETCH_INTERVAL - timeSinceLastFetch);
            const nextCheckIn = Math.max(remainingCache, remainingInterval);
            console.log(`ML Extension: Skipping periodic API check - next check in ${Math.round(nextCheckIn / 1000)}s`);
        }
    }
}, 30000); // Check every 30 seconds instead of 5 seconds

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
        clearCache: () => {
            lastProjectNameFetch = 0;
            lastProjectNameResult = null;
            isFetchingProjectName = false;
            console.log('ML Extension: Cache cleared');
            return { success: true, message: 'Cache cleared' };
        },
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
                const newProjectName = await fetchProjectName(true); // Force fetch
                
                if (newProjectName && newProjectName !== config.DEFAULT_PROJECT_NAME) {
                    PROJECT_NAME = newProjectName;
                    
                    // Force UI refresh
                    if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                        try {
                            window.Scratch.vm.refreshWorkspace();
                            console.log('ML Extension: Workspace refreshed after force update');
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
        },
        getCacheStatus: () => {
            const now = Date.now();
            const timeSinceLastFetch = now - lastProjectNameFetch;
            const cacheValid = timeSinceLastFetch < PROJECT_NAME_CACHE_DURATION;
            const canFetch = timeSinceLastFetch >= MIN_FETCH_INTERVAL;
            
            return {
                lastFetch: lastProjectNameFetch,
                timeSinceLastFetch: timeSinceLastFetch,
                cacheValid: cacheValid,
                canFetch: canFetch,
                cacheDuration: PROJECT_NAME_CACHE_DURATION,
                minFetchInterval: MIN_FETCH_INTERVAL,
                isCurrentlyFetching: isFetchingProjectName,
                cachedResult: lastProjectNameResult
            };
        },
        // Dynamic label block functions
        getLabelByIndex: (index) => {
            if (projectLabels && projectLabels[index] !== undefined) {
                return projectLabels[index];
            }
            return 'unknown';
        },
        getAllLabels: () => {
            return projectLabels.join(', ');
        },
        hasLabel: (label) => {
            return projectLabels && projectLabels.includes(label);
        },
        getLabelCount: () => {
            return projectLabels ? projectLabels.length : 0;
        },
        refreshProjectLabels: async () => {
            if (SESSION_ID && PROJECT_ID) {
                console.log('ML Extension: Refreshing project labels...');
                const details = await fetchProjectDetails(true); // Force fetch
                if (details && projectLabels.length > 0) {
                    console.log(`ML Extension: Refreshed labels: ${projectLabels.join(', ')}`);
                    // Force UI refresh to show new label blocks
                    if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                        try {
                            window.Scratch.vm.refreshWorkspace();
                            console.log('ML Extension: Workspace refreshed after label update');
                        } catch (e) {
                            console.log('ML Extension: Could not refresh workspace after label update');
                        }
                    }
                    return { success: true, labels: projectLabels };
                } else {
                    return { success: false, error: 'No labels found' };
                }
            } else {
                return { success: false, error: 'No session or project ID set' };
            }
        },
        // Project detection and management functions
        startProjectDetection: () => {
            startProjectDetection();
            return { success: true, message: 'Project detection started' };
        },
        stopProjectDetection: () => {
            stopProjectDetection();
            return { success: true, message: 'Project detection stopped' };
        },
        detectCurrentProject: () => {
            detectProjectFromURL();
            return { success: true, message: 'Project detection triggered' };
        },
        getCurrentProjectInfo: () => {
            return {
                currentProjectId: currentProjectId,
                globalProjectId: PROJECT_ID,
                sessionId: SESSION_ID,
                projectName: PROJECT_NAME,
                labels: projectLabels,
                isDetectionActive: isProjectDetectionActive
            };
        },
        // Force refresh current project
        forceRefreshCurrentProject: async () => {
            if (SESSION_ID && PROJECT_ID) {
                console.log('ML Extension: 🔄 Force refreshing current project...');
                
                // Clear all caches
                lastProjectDetailsFetch = 0;
                lastProjectDetailsResult = null;
                lastProjectNameFetch = 0;
                lastProjectNameResult = null;
                
                // Fetch fresh data
                try {
                    const [details, projectName] = await Promise.all([
                        fetchProjectDetails(true),
                        fetchProjectName(true)
                    ]);
                    
                    console.log(`ML Extension: ✅ Project refreshed: ${PROJECT_NAME}`);
                    console.log(`ML Extension: 📝 Labels: ${projectLabels.join(', ')}`);
                    
                    // Force UI refresh
                    if (typeof window !== 'undefined' && window.Scratch && window.Scratch.vm) {
                        try {
                            window.Scratch.vm.refreshWorkspace();
                            console.log('ML Extension: 🔄 Workspace refreshed');
                        } catch (e) {
                            console.log('ML Extension: ⚠️ Could not refresh workspace:', e);
                        }
                    }
                    
                    return { success: true, projectName: PROJECT_NAME, labels: projectLabels };
                } catch (error) {
                    console.error('ML Extension: ❌ Error refreshing project:', error);
                    return { success: false, error: error.message };
                }
            } else {
                return { success: false, error: 'No session or project ID set' };
            }
        }
    };
    
    console.log('ML Extension: Global functions available at window.MLExtension');
    console.log('ML Extension: Available functions:');
    console.log('  - MLExtension.setIds(sessionId, projectId)');
    console.log('  - MLExtension.getIds()');
    console.log('  - MLExtension.testConnection()');
    console.log('  - MLExtension.clearStorage()');
    console.log('  - MLExtension.clearCache() - Clear API cache');
    console.log('  - MLExtension.getCacheStatus() - Get cache status');
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
    console.log('  - MLExtension.getLabelByIndex(index) - Get label by index');
    console.log('  - MLExtension.getAllLabels() - Get all available labels');
    console.log('  - MLExtension.hasLabel(label) - Check if label exists');
    console.log('  - MLExtension.getLabelCount() - Get count of available labels');
    console.log('  - MLExtension.refreshProjectLabels() - Refresh labels from API');
    console.log('  - MLExtension.createDynamicLabelMethods() - Create dynamic label methods');
    console.log('  - MLExtension.startProjectDetection() - Start automatic project detection');
    console.log('  - MLExtension.stopProjectDetection() - Stop automatic project detection');
    console.log('  - MLExtension.detectCurrentProject() - Manually detect current project');
    console.log('  - MLExtension.getCurrentProjectInfo() - Get current project information');
    console.log('  - MLExtension.forceRefreshCurrentProject() - Force refresh current project');
}

console.log(`ML Extension: Extension loaded with project name: ${PROJECT_NAME}`);
console.log(`ML Extension: Session ID: ${SESSION_ID || 'Not set'}`);
console.log(`ML Extension: Project ID: ${PROJECT_ID || 'Not set'}`);

module.exports = MLExtension;