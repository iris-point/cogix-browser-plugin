const fs = require('fs');
const path = require('path');

// Create a simple 512x512 PNG icon
// This is a minimal valid PNG with a blue circle (eye icon)
const createPngIcon = (size) => {
  // Create a canvas-like buffer for a simple icon
  const Canvas = require('canvas');
  const canvas = Canvas.createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#4F46E5';
  ctx.fillRect(0, 0, size, size);
  
  // Eye shape
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(size/2, size/2, size*0.35, size*0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Iris
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size*0.15, 0, Math.PI * 2);
  ctx.fill();
  
  // Pupil
  ctx.fillStyle = '#1F2937';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size*0.08, 0, Math.PI * 2);
  ctx.fill();
  
  return canvas.toBuffer('image/png');
};

// Try using canvas if available, otherwise create a minimal PNG
try {
  const Canvas = require('canvas');
  
  const sizes = [16, 32, 48, 128, 512];
  sizes.forEach(size => {
    const buffer = createPngIcon(size);
    fs.writeFileSync(path.join(__dirname, 'assets', `icon${size}.png`), buffer);
    console.log(`Created icon${size}.png`);
  });
  
  // Also create default icon.png
  const defaultBuffer = createPngIcon(512);
  fs.writeFileSync(path.join(__dirname, 'assets', 'icon.png'), defaultBuffer);
  console.log('Created icon.png');
  
} catch (e) {
  console.log('Canvas not available, creating minimal PNG manually');
  
  // Create a minimal valid 16x16 PNG (red square)
  // PNG header + IHDR + IDAT + IEND
  const minimalPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10, // 16x16
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x91, 0x68, // 8-bit RGB
    0x36, // CRC
    0x00, 0x00, 0x00, 0x1E, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
    0x78, 0x9C, 0x62, 0x18, 0x05, 0xA3, 0x60, 0x14, // Compressed data
    0x8C, 0x02, 0x08, 0x00, 0x00, 0x05, 0x00, 0x01,
    0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
    0x0A, 0x0B, 0x0C, 0x00, 0x01, 0x81,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
    0xAE, 0x42, 0x60, 0x82
  ]);
  
  // Write minimal PNG
  fs.writeFileSync(path.join(__dirname, 'assets', 'icon.png'), minimalPng);
  console.log('Created minimal icon.png');
}