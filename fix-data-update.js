// Fix ML Extension Data Update Issue
// This script ensures the extension uses the latest API data instead of cached defaults

console.log('=== Fixing ML Extension Data Update Issue ===');

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

// Fix the data update issue
async function fixDataUpdate() {
    try {
        const ext = await waitForExtension();
        
        console.log('\n🔍 Current Extension State:');
        ext.debugState();
        
        console.log('\n📋 Current Labels:', ext.projectLabels);
        console.log('\n📊 isReady Status:', ext.isReady);
        
        // Check if we have real API data
        if (ext.projectLabels && ext.projectLabels.length > 0) {
            console.log('\n🚀 API data detected! Forcing extension refresh...');
            
            // Force refresh with current labels to ensure blocks are updated
            ext.forceRefreshWithLabels(ext.projectLabels);
            
            // Wait for refresh to complete
            setTimeout(() => {
                console.log('\n✅ Extension refreshed!');
                console.log('\n🔍 Updated State:');
                ext.debugState();
                
                console.log('\n📋 Available Label Methods:');
                ext.listLabelMethods();
                
                console.log('\n🎯 Next Steps:');
                console.log('1. Remove the ML extension from Scratch');
                console.log('2. Add it back - it should now show the correct labels');
                console.log('3. The blocks should reflect your API data (Cat, Dog)');
                
                // If you want to manually set specific labels, uncomment this:
                // ext.forceRefreshWithLabels(["Cat", "Dog"]);
                
            }, 2000);
            
        } else {
            console.log('\n❌ No API data found. Checking localStorage...');
            
            // Check if we have session/project IDs
            const sessionId = localStorage.getItem('ml_extension_session_id');
            const projectId = localStorage.getItem('ml_extension_project_id');
            
            if (sessionId && projectId) {
                console.log('\n🔍 Found stored IDs, re-fetching data...');
                console.log('Session ID:', sessionId);
                console.log('Project ID:', projectId);
                
                // Re-fetch project data
                ext.setProjectDataForTesting(sessionId, projectId);
                
                // Wait for data to load
                setTimeout(() => {
                    console.log('\n🔍 After re-fetch:');
                    ext.debugState();
                    
                    if (ext.projectLabels && ext.projectLabels.length > 0) {
                        console.log('\n✅ Data re-fetched! Now refresh extension...');
                        ext.forceRefreshWithLabels(ext.projectLabels);
                    }
                }, 3000);
                
            } else {
                console.log('\n❌ No stored IDs found. You may need to set them manually.');
                console.log('\n💡 Try setting project data manually:');
                console.log('ext.setProjectDataForTesting("session_123", "project_456")');
            }
        }
        
        return ext;
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
    }
}

// Auto-run the fix
fixDataUpdate();

// Export for manual use
window.fixDataUpdate = fixDataUpdate;
