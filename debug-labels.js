// Debug script for ML Extension Label Methods
// Run this in the browser console to fix label method issues

console.log('=== ML Extension Label Debug ===');

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

// Fix label methods and refresh extension
async function fixLabelMethods() {
    try {
        const ext = await waitForExtension();
        
        console.log('\n🔍 Current Extension State:');
        ext.debugState();
        
        console.log('\n📋 Current Labels:', ext.projectLabels);
        
        // Check if label methods exist
        console.log('\n🔍 Checking Label Methods:');
        ext.projectLabels.forEach(label => {
            const methodName = `label_${label}`;
            const exists = ext.hasLabelMethod(label);
            console.log(`${methodName}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
        });
        
        // Force refresh with current labels
        console.log('\n🚀 Force refreshing extension with labels...');
        ext.forceRefreshWithLabels(ext.projectLabels);
        
        // Wait a bit and check again
        setTimeout(() => {
            console.log('\n🔍 After refresh - Label Methods:');
            ext.projectLabels.forEach(label => {
                const methodName = `label_${label}`;
                const exists = ext.hasLabelMethod(label);
                console.log(`${methodName}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
            });
            
            console.log('\n📋 Available Methods:', ext.listLabelMethods());
            
            console.log('\n🎯 Next Steps:');
            console.log('1. Try adding the ML extension again in Scratch');
            console.log('2. The label blocks should now work properly');
            console.log('3. If still having issues, run: ext.forceRefreshWithLabels(["Cat", "Dog"])');
        }, 2000);
        
        return ext;
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
    }
}

// Auto-run the fix
fixLabelMethods();

// Export for manual use
window.fixLabelMethods = fixLabelMethods;
