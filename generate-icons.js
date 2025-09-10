const fs = require('fs');
const path = require('path');

// Create SVG icon
const createSvgIcon = (size) => {
  const scale = size / 128;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background circle -->
  <circle cx="${size/2}" cy="${size/2}" r="${(size/2 - 2*scale)}" fill="#4F46E5"/>
  
  <!-- Eye white -->
  <ellipse cx="${size/2}" cy="${size/2}" rx="${40*scale}" ry="${20*scale}" fill="white"/>
  
  <!-- Iris -->
  <circle cx="${size/2}" cy="${size/2}" r="${16*scale}" fill="#3B82F6"/>
  
  <!-- Pupil -->
  <circle cx="${size/2}" cy="${size/2}" r="${8*scale}" fill="#1F2937"/>
  
  <!-- Highlight -->
  <circle cx="${size/2 + 4*scale}" cy="${size/2 - 4*scale}" r="${4*scale}" fill="rgba(255,255,255,0.8)"/>
</svg>`;
};

// Ensure assets directory exists
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate icons for different sizes
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const svg = createSvgIcon(size);
  const filename = path.join(assetsDir, `icon${size}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`Generated ${filename}`);
});

// Also create a default icon.svg
const defaultIcon = createSvgIcon(128);
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), defaultIcon);
console.log(`Generated ${path.join(assetsDir, 'icon.svg')}`);

console.log('All icons generated successfully!');