// Debug script for Teachable Machine Extension
// Run this in the browser console to troubleshoot issues

console.log('=== Teachable Machine Debug Script Loaded ===');

// Function to check the current state
function debugTeachableMachine() {
    console.log('🔍 Debugging Teachable Machine Extension...');
    
    // Check if extension functions exist
    const functions = [
        'checkTeachableMachineSetup',
        'getTeachableMachineStatus',
        'clearTeachableMachineCallbacks',
        'testTeachableMachineDetection',
        'forceTeachableMachineDetection',
        'checkTeachableMachineWebcam',
        'setupTeachableMachineWebcam'
    ];
    
    console.log('📋 Available functions:');
    functions.forEach(func => {
        if (typeof window[func] === 'function') {
            console.log(`✅ ${func}`);
        } else {
            console.log(`❌ ${func} - NOT FOUND`);
        }
    });
    
    // Check if the extension is loaded
    if (typeof window.checkTeachableMachineSetup === 'function') {
        console.log('\n🔧 Extension is loaded, checking setup...');
        window.checkTeachableMachineSetup();
    } else {
        console.log('\n❌ Extension not loaded yet');
    }
    
    // Check webcam status
    if (typeof window.checkTeachableMachineWebcam === 'function') {
        console.log('\n📹 Checking webcam status...');
        window.checkTeachableMachineWebcam();
    }
    
    console.log('\n=== Debug Complete ===');
}

// Function to test detection manually
function testDetection(label) {
    console.log(`🧪 Testing detection for: ${label}`);
    
    if (typeof window.testTeachableMachineDetection === 'function') {
        window.testTeachableMachineDetection(label);
    } else {
        console.log('❌ testTeachableMachineDetection function not found');
    }
}

// Function to force detection (bypasses cooldown)
function forceDetection(label) {
    console.log(`⚡ Force triggering detection for: ${label}`);
    
    if (typeof window.forceTeachableMachineDetection === 'function') {
        window.forceTeachableMachineDetection(label);
    } else {
        console.log('❌ forceTeachableMachineDetection function not found');
    }
}

// Function to clear all callbacks
function clearCallbacks() {
    console.log('🧹 Clearing all callbacks...');
    
    if (typeof window.clearTeachableMachineCallbacks === 'function') {
        window.clearTeachableMachineCallbacks();
    } else {
        console.log('❌ clearTeachableMachineCallbacks function not found');
    }
}

// Function to setup webcam manually
async function setupWebcam() {
    console.log('📹 Setting up webcam manually...');
    
    if (typeof window.setupTeachableMachineWebcam === 'function') {
        try {
            const result = await window.setupTeachableMachineWebcam();
            console.log('Webcam setup result:', result);
        } catch (error) {
            console.error('Webcam setup failed:', error);
        }
    } else {
        console.log('❌ setupTeachableMachineWebcam function not found');
    }
}

// Function to check Scratch runtime
function checkScratchRuntime() {
    console.log('🎮 Checking Scratch runtime...');
    
    if (typeof window !== 'undefined') {
        // Check for Scratch objects
        if (window.Scratch) {
            console.log('✅ Scratch object found');
            if (window.Scratch.vm) {
                console.log('✅ Scratch VM found');
                console.log('Runtime targets:', window.Scratch.vm.runtime ? window.Scratch.vm.runtime.targets?.length : 'No runtime');
            } else {
                console.log('❌ Scratch VM not found');
            }
        } else {
            console.log('❌ Scratch object not found');
        }
        
        // Check for runtime directly
        if (window.runtime) {
            console.log('✅ Runtime object found directly');
        } else {
            console.log('❌ Runtime object not found directly');
        }
    }
}

// Function to run all checks
function runAllChecks() {
    console.log('🚀 Running all Teachable Machine checks...\n');
    
    debugTeachableMachine();
    console.log('\n');
    checkScratchRuntime();
    console.log('\n');
    checkTeachableMachineWebcam();
    
    console.log('\n🎯 Quick Test Commands:');
    console.log('• testDetection("Usha") - Test Usha detection');
    console.log('• testDetection("Ranjith") - Test Ranjith detection');
    console.log('• forceDetection("Usha") - Force trigger Usha block');
    console.log('• clearCallbacks() - Clear all callbacks');
    console.log('• setupWebcam() - Setup webcam manually');
}

// Auto-run debug after a short delay
setTimeout(() => {
    console.log('🔄 Auto-running Teachable Machine debug...');
    runAllChecks();
}, 2000);

// Export functions to global scope
window.debugTeachableMachine = debugTeachableMachine;
window.testDetection = testDetection;
window.forceDetection = forceDetection;
window.clearCallbacks = clearCallbacks;
window.setupWebcam = setupWebcam;
window.checkScratchRuntime = checkScratchRuntime;
window.runAllChecks = runAllChecks;

console.log('📚 Available debug functions:');
console.log('• debugTeachableMachine() - Check extension status');
console.log('• testDetection("label") - Test detection for a label');
console.log('• forceDetection("label") - Force trigger a block');
console.log('• clearCallbacks() - Clear all callbacks');
console.log('• setupWebcam() - Setup webcam manually');
console.log('• checkScratchRuntime() - Check Scratch runtime');
console.log('• runAllChecks() - Run all checks');
