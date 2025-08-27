const { createCanvas } = require('canvas');
const fs = require('fs');

// Generate large icon (48x48)
function generateLargeIcon() {
    const canvas = createCanvas(48, 48);
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#4FFF50';
    ctx.fillRect(0, 0, 48, 48);
    
    // Rounded corners
    ctx.fillStyle = '#4FFF50';
    ctx.beginPath();
    ctx.roundRect(0, 0, 48, 48, 8);
    ctx.fill();
    
    // Neural network nodes
    ctx.fillStyle = '#FFFFFF';
    const nodeSize = 8;
    const positions = [
        [12, 12], [24, 12], [36, 12],
        [12, 24], [24, 24], [36, 24],
        [12, 36], [24, 36], [36, 36]
    ];
    
    positions.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, nodeSize/2, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    // Connections
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    
    // Horizontal connections
    ctx.beginPath();
    ctx.moveTo(16, 24);
    ctx.lineTo(32, 24);
    ctx.stroke();
    
    // Vertical connections
    ctx.beginPath();
    ctx.moveTo(24, 16);
    ctx.lineTo(24, 32);
    ctx.stroke();
    
    return canvas;
}

// Generate small icon (24x24)
function generateSmallIcon() {
    const canvas = createCanvas(24, 24);
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#4FFF50';
    ctx.fillRect(0, 0, 24, 24);
    
    // Rounded corners
    ctx.fillStyle = '#4FFF50';
    ctx.beginPath();
    ctx.roundRect(0, 0, 24, 24, 4);
    ctx.fill();
    
    // Neural network nodes (4 nodes in 2x2 grid)
    ctx.fillStyle = '#FFFFFF';
    const nodeSize = 4;
    const positions = [
        [8, 8], [16, 8],
        [8, 16], [16, 16]
    ];
    
    positions.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, nodeSize/2, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    // Connections
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    
    // Horizontal connection
    ctx.beginPath();
    ctx.moveTo(10, 12);
    ctx.lineTo(14, 12);
    ctx.stroke();
    
    // Vertical connection
    ctx.beginPath();
    ctx.moveTo(12, 10);
    ctx.lineTo(12, 14);
    ctx.stroke();
    
    return canvas;
}

// Save icons
function saveIcon(canvas, filename) {
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filename, buffer);
    console.log(`Generated ${filename}`);
}

// Generate both icons
try {
    const largeIcon = generateLargeIcon();
    const smallIcon = generateSmallIcon();
    
    // Create directory if it doesn't exist
    const dir = './packages/scratch-gui/src/lib/libraries/extensions/teachable-machine';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    saveIcon(largeIcon, `${dir}/teachable-machine.png`);
    saveIcon(smallIcon, `${dir}/teachable-machine-small.png`);
    
    console.log('Icons generated successfully!');
} catch (error) {
    console.error('Error generating icons:', error);
    console.log('Note: If canvas module is not available, you can manually create PNG files or use the SVG versions.');
}
