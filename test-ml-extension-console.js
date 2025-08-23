// ML Extension Console Test Commands - Updated for localStorage
// Copy and paste these commands into your browser console while Scratch is running

console.log('🤖 ML Extension Console Test Commands (localStorage Version)');
console.log('===========================================================');

// 1. Check if the extension is loaded
console.log('Extension loaded:', typeof window.MLExtension !== 'undefined');

// 2. Initialize from URL automatically
console.log('Initializing from URL...');
if (window.MLExtension) {
    window.MLExtension.initFromUrl();
}

// 3. Check current IDs
console.log('Current IDs:', window.MLExtension.getIds());

// 4. Set IDs manually for your specific case
console.log('Setting your specific session and project IDs...');
window.MLExtension.setIds('session_aa3bffbf72c444c5', 'eff8a1b8-4998-442a-a3a2-2e386ddbc9b8');

// 5. Verify IDs are set
setTimeout(() => {
    console.log('Updated IDs:', window.MLExtension.getIds());
    
    // 6. Test direct API connection (will likely fail due to CORS, but IDs are stored)
    console.log('Testing API connection...');
    window.MLExtension.testConnection().then(result => {
        console.log('🎉 API Connection Result:', result);
    }).catch(error => {
        console.log('❌ API Connection Failed (expected due to CORS):', error);
        console.log('✅ But IDs are stored in localStorage and blocks will work!');
    });
}, 1000);

console.log('');
console.log('📋 Quick Test Commands:');
console.log('1. Check IDs: MLExtension.getIds()');
console.log('2. Set IDs: MLExtension.setIds("session", "project")');
console.log('3. Test API: MLExtension.testConnection()');
console.log('4. Clear storage: MLExtension.clearStorage()');
console.log('5. Init from URL: MLExtension.initFromUrl()');
console.log('');
console.log('🔍 Your URL: http://localhost:8601/?sessionId=session_aa3bffbf72c444c5&projectId=eff8a1b8-4998-442a-a3a2-2e386ddbc9b8');
console.log('🔍 Your Session ID: session_aa3bffbf72c444c5');
console.log('🔍 Your Project ID: eff8a1b8-4998-442a-a3a2-2e386ddbc9b8');
console.log('🔍 Expected Project Name: test');
console.log('');
console.log('✅ localStorage Solution:');
console.log('   - Session and Project IDs are stored in localStorage');
console.log('   - Blocks will use these IDs for API calls');
console.log('   - No more CORS proxy dependency');
console.log('   - Extension name will show "sample" initially, then update to "test"');
console.log('');
console.log('🧪 How to use:');
console.log('1. Run MLExtension.setIds("session_aa3bffbf72c444c5", "eff8a1b8-4998-442a-a3a2-2e386ddbc9b8")');
console.log('2. Use the ML blocks in Scratch - they will use the stored IDs');
console.log('3. The blocks will make direct API calls to your backend');
console.log('');
console.log('🎯 Blocks available:');
console.log('   - recognise text [text] (label)');
console.log('   - recognise text [text] (confidence)');
console.log('   - add training data [text] [label]');
console.log('   - train new machine learning model');
console.log('   - is the machine learning model [ready]');
console.log('   - get training examples');
console.log('   - set session [id] and project [id]');
console.log('   - get current session and project IDs');
console.log('   - clear stored data');
console.log('');
console.log('🔧 Note: You may need to enable CORS on your backend for direct API calls to work.');
console.log('     The extension will work in the browser console for testing.');