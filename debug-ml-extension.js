// ML Extension Debug Script
// Run this in the browser console when the ML extension is loaded

console.log('=== ML Extension Debug Script ===');

// Wait for extension to be available
function waitForExtension() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.MLExtension) {
                console.log('✅ ML Extension found!');
                resolve(window.MLExtension);
            } else {
                console.log('⏳ Waiting for ML Extension...');
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// Main debug function
async function debugMLExtension() {
    try {
        const ext = await waitForExtension();
        
        console.log('\n🔍 Current Extension State:');
        ext.debugState();
        
        console.log('\n📊 Extension Status:');
        console.log(ext.getStatus());
        
        console.log('\n🛠️ Available Debug Methods:');
        console.log('- ext.forceReady() - Force extension to be ready');
        console.log('- ext.manualInit() - Manually trigger initialization');
        console.log('- ext.setProjectLabels([...]) - Set project labels manually');
        console.log('- ext.refreshExtension() - Refresh the extension');
        console.log('- ext.debugState() - Show detailed debug info');
        
        console.log('\n🚀 Quick Fix Commands:');
        console.log('1. ext.forceReady() - Make extension ready immediately');
        console.log('2. ext.setProjectLabels(["Happy", "Sad"]) - Set default labels');
        console.log('3. ext.refreshExtension() - Refresh and re-register');
        
        // Try to fix common issues automatically
        console.log('\n🔧 Attempting Auto-Fix...');
        
        if (!ext.isReady) {
            console.log('❌ Extension not ready, forcing ready state...');
            ext.forceReady();
        }
        
        if (!ext.projectLabels || !Array.isArray(ext.projectLabels)) {
            console.log('❌ Project labels invalid, setting defaults...');
            ext.setProjectLabels(['Happy', 'Sad']);
        }
        
        console.log('\n✅ Auto-fix complete!');
        console.log('Current state:');
        ext.debugState();
        
        return ext;
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    }
}

// Auto-run the debug script
debugMLExtension().then(ext => {
    if (ext) {
        console.log('\n🎉 ML Extension Debug Complete!');
        console.log('Extension should now work properly.');
        console.log('Try adding the ML extension again in Scratch.');
    }
});

// Export for manual use
window.debugMLExtension = debugMLExtension;
