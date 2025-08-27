// Quick Fix for ML Extension Data Update
// Run this immediately to fix the label issue

console.log('🚀 Quick Fix for ML Extension Data Update');

// Quick fix function
function quickFix() {
    if (window.MLExtension) {
        const ext = window.MLExtension;
        
        console.log('✅ ML Extension found, applying quick fix...');
        
        // Force refresh with the correct labels from your API
        ext.forceRefreshWithLabels(["Cat", "Dog"]);
        
        console.log('✅ Quick fix applied!');
        console.log('📋 Now remove and re-add the ML extension in Scratch');
        console.log('🎯 You should see blocks for: Cat, Dog');
        
        return ext;
    } else {
        console.log('❌ ML Extension not found. Wait for it to load and try again.');
        return null;
    }
}

// Auto-run the quick fix
const result = quickFix();

// Export for manual use
window.quickFix = quickFix;
