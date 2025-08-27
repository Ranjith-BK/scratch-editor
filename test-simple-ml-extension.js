// Simple ML Extension Test Script
// Run this in the browser console to test the simplified ML extension

console.log('=== Simple ML Extension Test ===');

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

// Test the simplified extension
async function testSimpleExtension() {
    try {
        const ext = await waitForExtension();
        
        console.log('\n🔍 Current Extension State:');
        ext.debugState();
        
        console.log('\n📊 Extension Status:');
        console.log(ext.getStatus());
        
        // Set test project data
        console.log('\n🚀 Setting test project data...');
        ext.setProjectDataForTesting(
            'session_98fbd0572b074638', 
            '5977c5cd-57cd-4fe1-b01e-3076c724c5da'
        );
        
        // Wait a bit for API call to complete
        setTimeout(() => {
            console.log('\n✅ Test complete!');
            console.log('Current state:');
            ext.debugState();
            
            console.log('\n🎯 What you should see in Scratch:');
            console.log('1. "recognise text [text] (label)" block');
            console.log('2. "recognise text [text] (confidence)" block');
            console.log('3. Individual label blocks (e.g., "Happy", "Sad")');
            console.log('\nTry adding the ML extension again in Scratch!');
        }, 3000);
        
        return ext;
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Auto-run the test
testSimpleExtension();

// Export for manual use
window.testSimpleExtension = testSimpleExtension;
