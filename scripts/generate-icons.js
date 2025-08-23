/**
 * Generate extension icons programmatically
 * Creates all required icon sizes for Chrome extension
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we can use canvas (install with: npm install canvas)
let Canvas, createCanvas, registerFont;
try {
  const canvasModule = await import('canvas').catch(() => null);
  if (canvasModule) {
    Canvas = canvasModule.Canvas;
    createCanvas = canvasModule.createCanvas;
    registerFont = canvasModule.registerFont;
  }
} catch (error) {
  console.warn('Canvas module not found. Installing with: npm install canvas');
  // Fallback to generating SVG-based placeholder
}

// Icon sizes required by Chrome
const ICON_SIZES = [16, 32, 48, 128];

// Ensure icons directory exists
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

/**
 * Generate icon using Canvas (if available)
 */
function generateIconWithCanvas(size) {
  if (!createCanvas) return false;
  
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background - Cogix blue gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#3b82f6');
  gradient.addColorStop(1, '#2563eb');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Draw eye shape
  ctx.strokeStyle = 'white';
  ctx.fillStyle = 'white';
  ctx.lineWidth = Math.max(1, size / 16);
  
  const centerX = size / 2;
  const centerY = size / 2;
  
  // Outer eye shape (ellipse)
  ctx.beginPath();
  const eyeWidth = size * 0.7;
  const eyeHeight = size * 0.35;
  ctx.ellipse(centerX, centerY, eyeWidth/2, eyeHeight/2, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  // Iris (outer circle)
  ctx.beginPath();
  const irisRadius = size * 0.2;
  ctx.arc(centerX, centerY, irisRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Pupil (inner circle)
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  const pupilRadius = size * 0.12;
  ctx.arc(centerX, centerY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Add a highlight for depth
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  const highlightRadius = size * 0.05;
  ctx.arc(centerX - pupilRadius/2, centerY - pupilRadius/2, highlightRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  const filename = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`✅ Generated ${filename}`);
  return true;
}

/**
 * Generate SVG icon (fallback when canvas is not available)
 */
function generateSVGIcon(size) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6" />
      <stop offset="100%" style="stop-color:#2563eb" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="url(#bgGradient)" />
  
  <!-- Eye outline -->
  <ellipse cx="${size/2}" cy="${size/2}" rx="${size*0.35}" ry="${size*0.175}" 
           fill="none" stroke="white" stroke-width="${Math.max(1, size/16)}" />
  
  <!-- Iris -->
  <circle cx="${size/2}" cy="${size/2}" r="${size*0.2}" fill="white" />
  
  <!-- Pupil -->
  <circle cx="${size/2}" cy="${size/2}" r="${size*0.12}" fill="#2563eb" />
  
  <!-- Highlight -->
  <circle cx="${size/2 - size*0.06}" cy="${size/2 - size*0.06}" r="${size*0.05}" 
          fill="rgba(255,255,255,0.5)" />
</svg>`;
  
  const filename = path.join(iconsDir, `icon-${size}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`📝 Generated SVG: ${filename}`);
  
  // Note: SVG files need to be converted to PNG for Chrome extension
  console.log(`⚠️  Note: ${filename} needs to be converted to PNG format`);
  return false;
}

/**
 * Generate HTML canvas version (creates an HTML file that can be opened to save PNGs)
 */
function generateHTMLCanvasVersion() {
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Cogix Extension Icon Generator</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        .instructions {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .icon-container {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin-top: 20px;
        }
        .icon-box {
            text-align: center;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
        }
        canvas {
            display: block;
            margin: 10px auto;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        canvas:hover {
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .size-label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
        button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 20px;
        }
        button:hover {
            background: #2563eb;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 Cogix Extension Icon Generator</h1>
        <div class="instructions">
            <strong>Instructions:</strong><br>
            1. Click on any icon to download it as PNG<br>
            2. Or click "Download All" to get all icons<br>
            3. Save them to: <code>public/icons/</code>
        </div>
        
        <div class="icon-container" id="icons"></div>
        
        <button onclick="downloadAll()">📥 Download All Icons</button>
    </div>

    <script>
        const sizes = [16, 32, 48, 128];
        const container = document.getElementById('icons');
        
        function drawIcon(canvas, size) {
            const ctx = canvas.getContext('2d');
            
            // Background gradient
            const gradient = ctx.createLinearGradient(0, 0, size, size);
            gradient.addColorStop(0, '#3b82f6');
            gradient.addColorStop(1, '#2563eb');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
            
            // Eye shape
            ctx.strokeStyle = 'white';
            ctx.fillStyle = 'white';
            ctx.lineWidth = Math.max(1, size / 16);
            
            const centerX = size / 2;
            const centerY = size / 2;
            
            // Outer eye shape
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, size*0.35, size*0.175, 0, 0, Math.PI * 2);
            ctx.stroke();
            
            // Iris
            ctx.beginPath();
            ctx.arc(centerX, centerY, size * 0.2, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupil
            ctx.fillStyle = '#2563eb';
            ctx.beginPath();
            ctx.arc(centerX, centerY, size * 0.12, 0, Math.PI * 2);
            ctx.fill();
            
            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(centerX - size*0.06, centerY - size*0.06, size * 0.05, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Create icons
        sizes.forEach(size => {
            const box = document.createElement('div');
            box.className = 'icon-box';
            
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            canvas.id = 'icon-' + size;
            drawIcon(canvas, size);
            
            canvas.onclick = () => downloadIcon(canvas, size);
            
            const label = document.createElement('div');
            label.className = 'size-label';
            label.textContent = 'icon-' + size + '.png';
            
            box.appendChild(canvas);
            box.appendChild(label);
            container.appendChild(box);
        });
        
        function downloadIcon(canvas, size) {
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'icon-' + size + '.png';
                a.click();
                URL.revokeObjectURL(url);
            });
        }
        
        function downloadAll() {
            sizes.forEach(size => {
                const canvas = document.getElementById('icon-' + size);
                downloadIcon(canvas, size);
            });
        }
    </script>
</body>
</html>`;

  const filename = path.join(iconsDir, 'generate-icons.html');
  fs.writeFileSync(filename, html);
  console.log(`\n🌐 HTML generator created: ${filename}`);
  console.log('   Open this file in a browser to generate and download PNG icons');
}

/**
 * Main function
 */
async function generateIcons() {
  console.log('🎨 Generating Cogix extension icons...\n');
  
  let canvasAvailable = false;
  
  // Try to generate with canvas
  if (createCanvas) {
    for (const size of ICON_SIZES) {
      canvasAvailable = generateIconWithCanvas(size) || canvasAvailable;
    }
  }
  
  // If canvas is not available, create alternatives
  if (!canvasAvailable) {
    console.log('\n⚠️  Canvas module not installed.');
    console.log('Installing canvas for automatic PNG generation...\n');
    
    // Try to install canvas
    const { exec } = await import('child_process').then(m => m);
    exec('npm install canvas', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Could not install canvas automatically.');
        console.log('Generating fallback files instead...\n');
        
        // Generate SVG versions
        for (const size of ICON_SIZES) {
          generateSVGIcon(size);
        }
        
        // Generate HTML version for manual generation
        generateHTMLCanvasVersion();
        
        console.log('\n📋 Next steps:');
        console.log('1. Open public/icons/generate-icons.html in a browser');
        console.log('2. Click each icon to download as PNG');
        console.log('3. Or install canvas manually: npm install canvas');
      } else {
        console.log('✅ Canvas installed successfully!');
        console.log('Run this script again to generate PNG icons.');
      }
    });
  } else {
    console.log('\n✅ All icons generated successfully!');
  }
}

// Run the generator
generateIcons().catch(console.error);