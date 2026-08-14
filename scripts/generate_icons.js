const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. High-resolution 1024x1024 SVG design
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e2024"/>
      <stop offset="50%" stop-color="#141518"/>
      <stop offset="100%" stop-color="#0a0a0c"/>
    </linearGradient>

    <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff2e2e"/>
      <stop offset="50%" stop-color="#e60000"/>
      <stop offset="100%" stop-color="#b30000"/>
    </linearGradient>

    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255, 255, 255, 0.25)"/>
      <stop offset="100%" stop-color="rgba(255, 255, 255, 0.03)"/>
    </linearGradient>

    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="28" stdDeviation="36" flood-color="#000000" flood-opacity="0.6"/>
    </filter>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="#ff0000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Base macOS Squircle Container -->
  <rect x="80" y="80" width="864" height="864" rx="200" fill="url(#bgGrad)" filter="url(#dropShadow)"/>
  <rect x="80" y="80" width="864" height="864" rx="200" fill="none" stroke="url(#borderGrad)" stroke-width="8"/>

  <!-- Inner Glowing Red Badge Card -->
  <g filter="url(#glow)">
    <rect x="232" y="272" width="560" height="400" rx="100" fill="url(#redGrad)"/>
    <rect x="232" y="272" width="560" height="400" rx="100" fill="none" stroke="rgba(255, 255, 255, 0.3)" stroke-width="6"/>
  </g>

  <!-- Crisp Cinema Play Triangle -->
  <polygon points="452,382 632,472 452,562" fill="#FFFFFF"/>

  <!-- Studio Pro Accent Details -->
  <circle cx="512" cy="740" r="12" fill="#ff4d4d"/>
  <circle cx="552" cy="740" r="8" fill="rgba(255, 255, 255, 0.4)"/>
  <circle cx="472" cy="740" r="8" fill="rgba(255, 255, 255, 0.4)"/>
</svg>`;

const svgPath = path.join(assetsDir, 'icon.svg');
fs.writeFileSync(svgPath, svgContent);

console.log('SVG icon generated at assets/icon.svg');
