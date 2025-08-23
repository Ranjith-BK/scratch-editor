import VM from '@scratch/scratch-vm';
import {GUIConfig} from '../gui-config';

const SET_VM = 'scratch-gui/vm/SET_VM';

// Helper function to ensure ML extension is loaded
const ensureMLExtensionLoaded = function (vm) {
    if (vm && vm.extensionManager) {
        try {
            // Check if ML extension is already loaded
            if (!vm.extensionManager._loadedExtensions.has('ml')) {
                vm.extensionManager.loadExtensionIdSync('ml');
                console.log('ML Extension: Automatically loaded');
            } else {
                console.log('ML Extension: Already loaded');
            }
        } catch (error) {
            console.warn('ML Extension: Failed to auto-load:', error);
        }
    }
};

const createVM = function (config: GUIConfig) {
    const defaultVM = new VM();
    defaultVM.attachStorage(config.storage.scratchStorage);
    
    // Automatically load the ML extension when VM is created
    ensureMLExtensionLoaded(defaultVM);
    
    return defaultVM;
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = null;
    switch (action.type) {
    case SET_VM:
        // Ensure ML extension is loaded on the new VM
        ensureMLExtensionLoaded(action.vm);
        return action.vm;
    default:
        return state;
    }
};
const setVM = function (vm) {
    return {
        type: SET_VM,
        vm: vm
    };
};

export {
    reducer as default,
    createVM as vmInitialState,
    setVM
};
