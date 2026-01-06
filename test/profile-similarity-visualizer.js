/**
 * Interactive Profile Similarity Visualizer
 * 
 * This script:
 * 1. Loads test profile embeddings
 * 2. Calculates pairwise cosine similarities
 * 3. Generates an interactive radial visualization
 * 4. Click any profile to center it and see similarities
 * 
 * Usage:
 *   node test/profile-similarity-visualizer.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMBEDDINGS_FILE = 'embeddings.json';
const PRINT_SIMILARITIES = false;

// ============================================================================
// Vector Math Functions
// ============================================================================

function cosineSimilarity(vec1, vec2) {
  const dot = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  
  if (mag1 === 0 || mag2 === 0) return 0;
  return dot / (mag1 * mag2);
}

// ============================================================================
// Radial Layout Calculation
// ============================================================================

/**
 * Calculate radial positions around a center profile based on similarity
 * @param {number} centerIndex - Index of the profile in the center
 * @param {number[][]} similarities - Similarity matrix
 * @param {number} maxRadius - Maximum radius for the least similar profile
 * @returns {Array} - Array of {x, y, similarity} coordinates
 */
function calculateRadialLayout(centerIndex, similarities, maxRadius = 180) {
  const n = similarities.length;
  const positions = [];
  
  // Get similarities for all other profiles
  const others = [];
  for (let i = 0; i < n; i++) {
    if (i !== centerIndex) {
      others.push({
        index: i,
        similarity: similarities[centerIndex][i]
      });
    }
  }
  
  // Sort by similarity (most similar first) for better visual distribution
  others.sort((a, b) => b.similarity - a.similarity);
  
  // Distribute profiles evenly in a circle, with distance based on similarity
  const angleStep = (2 * Math.PI) / others.length;
  
  others.forEach((other, i) => {
    const angle = i * angleStep;
    // Distance inversely proportional to similarity
    // similarity 1.0 = minRadius (60px), similarity 0.0 = maxRadius (180px)
    const minRadius = 60;
    const distance = maxRadius - (other.similarity * (maxRadius - minRadius));
    
    positions[other.index] = {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      similarity: other.similarity
    };
  });
  
  // Center profile at origin
  positions[centerIndex] = { x: 0, y: 0, similarity: 1.0 };
  
  return positions;
}

// ============================================================================
// Visualization Functions
// ============================================================================

function generateInteractiveHTML(profiles, similarities) {
  // Serialize the data for JavaScript
  const profilesData = JSON.stringify(profiles.map((p, i) => ({
    name: p.name,
    profileText: p.profileText,
    index: i,
    color: `hsl(${i * 360 / profiles.length}, 70%, 60%)`
  })));
  
  const similaritiesData = JSON.stringify(similarities);
  
  // Generate similarity table
  const tableRows = profiles.map((p1, i) => {
    const cells = profiles.map((p2, j) => {
      if (i >= j) return '<td></td>';
      const sim = similarities[i][j];
      const color = sim > 0.9 ? '#16a34a' :  // Dark green
                    sim > 0.8 ? '#4ade80' :  // Medium green
                    sim > 0.7 ? '#86efac' :  // Light green
                    sim > 0.6 ? '#bbf7d0' :  // Very light green
                    sim > 0.5 ? '#fde047' :  // Light yellow
                    sim > 0.4 ? '#fb923c' :  // Orange
                    sim > 0.3 ? '#f97316' :  // Dark orange
                    '#f87171';               // Red
      return `<td style="background: ${color}">${sim.toFixed(3)}</td>`;
    }).join('');
    return `<tr><th>${p1.name}</th>${cells}</tr>`;
  }).join('\n');
  
  const headerRow = '<tr><th></th>' + 
    profiles.map(p => `<th>${p.name}</th>`).join('') + 
    '</tr>';
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Interactive Profile Similarity Visualization</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: #f5f5f5;
      overflow-x: hidden;
    }
    
    .header {
      background: white;
      padding: 20px 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      margin-bottom: 0;
    }
    
    h1 {
      color: #333;
      font-size: 28px;
    }
    
    .subtitle {
      color: #666;
      margin-top: 8px;
      font-size: 14px;
    }
    
    .main-container {
      display: flex;
      height: calc(100vh - 120px);
    }
    
    .viz-container {
      flex: 1;
      position: relative;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    #canvas {
      cursor: pointer;
    }
    
    .side-panel {
      width: 400px;
      background: white;
      border-left: 2px solid #e5e5e5;
      padding: 30px;
      overflow-y: auto;
    }
    
    .profile-card {
      margin-bottom: 30px;
    }
    
    .profile-card h2 {
      color: #333;
      font-size: 20px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .profile-letter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-weight: bold;
      color: white;
    }
    
    .profile-text {
      color: #555;
      line-height: 1.6;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 8px;
      border-left: 4px solid #4ade80;
    }
    
    .hover-profile {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px solid #e5e5e5;
    }
    
    .hover-profile h3 {
      color: #666;
      font-size: 16px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .hover-profile .profile-text {
      border-left-color: #86efac;
    }
    
    .similarity-badge {
      display: inline-block;
      background: #4ade80;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .instructions {
      background: #fffbeb;
      border: 2px solid #fbbf24;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
      font-size: 14px;
      color: #92400e;
    }
    
    .instructions strong {
      color: #78350f;
    }
    
    .profile-point {
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .profile-point:hover circle {
      stroke-width: 4 !important;
    }
    
    .connection-line {
      transition: opacity 0.3s ease;
    }
    
    .table-container {
      background: white;
      padding: 30px;
      margin: 20px 40px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    
    th, td {
      padding: 10px;
      text-align: center;
      border: 1px solid #ddd;
    }
    
    th {
      background: #4ade80;
      color: white;
      font-weight: 600;
    }
    
    .legend {
      display: flex;
      gap: 15px;
      margin: 20px 0;
      flex-wrap: wrap;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    
    .legend-color {
      width: 30px;
      height: 20px;
      border-radius: 4px;
      border: 1px solid #999;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 Interactive Profile Similarity Explorer</h1>
    <p class="subtitle">Click any profile to explore its relationships • Hover to see details</p>
  </div>
  
  <div class="main-container">
    <div class="viz-container">
      <svg id="canvas" width="800" height="700"></svg>
    </div>
    
    <div class="side-panel">
      <div class="instructions">
        <strong>How to use:</strong><br>
        • Click any profile letter to center it<br>
        • Other profiles arrange by similarity<br>
        • Click the same profile again to reset to alphabetical view<br>
        • Hover over any profile to see its details
      </div>
      
      <div id="selected-profile">
        <div style="text-align: center; color: #666; padding: 40px 20px;">
          <h3 style="margin-bottom: 15px;">👆 Click any profile</h3>
          <p>Click to explore similarities</p>
          <p style="margin-top: 15px; font-size: 14px; color: #999;">Hover to preview</p>
        </div>
      </div>
    </div>
  </div>
  
  <div class="table-container">
    <h2>Pairwise Cosine Similarity Matrix</h2>
    <div class="legend">
      <div class="legend-item">
        <div class="legend-color" style="background: #16a34a"></div>
        <span>Very High (>0.9)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #4ade80"></div>
        <span>High (>0.8)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #86efac"></div>
        <span>Med-High (>0.7)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #bbf7d0"></div>
        <span>Medium (>0.6)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #fde047"></div>
        <span>Med-Low (>0.5)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #fb923c"></div>
        <span>Low (>0.4)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #f97316"></div>
        <span>Very Low (>0.3)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #f87171"></div>
        <span>Minimal (≤0.3)</span>
      </div>
    </div>
    <table>
      ${headerRow}
      ${tableRows}
    </table>
  </div>
  
  <script>
    // Data from Node.js
    const profiles = ${profilesData};
    const similarities = ${similaritiesData};
    
    // State
    let currentCenter = 0;
    let hoveredProfile = null;
    let isAlphabeticalMode = true; // Start in alphabetical mode
    
    // Canvas setup
    const svg = document.getElementById('canvas');
    const centerX = 400;
    const centerY = 350;
    
    // Calculate alphabetical layout (all profiles in a circle)
    function calculateAlphabeticalLayout() {
      const positions = [];
      const radius = 220;
      const angleStep = (2 * Math.PI) / profiles.length;
      
      profiles.forEach((profile, i) => {
        const angle = i * angleStep - Math.PI / 2; // Start from top
        positions[i] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          similarity: null
        };
      });
      
      return positions;
    }
    
    // Calculate radial layout
    function calculateLayout(centerIndex) {
      const positions = [];
      const others = [];
      
      // Collect all other profiles with their similarities
      for (let i = 0; i < profiles.length; i++) {
        if (i !== centerIndex) {
          others.push({
            index: i,
            similarity: similarities[centerIndex][i]
          });
        }
      }
      
      // Sort by similarity for better distribution
      others.sort((a, b) => b.similarity - a.similarity);
      
      // Arrange in circle with distance based on similarity
      const angleStep = (2 * Math.PI) / others.length;
      const minRadius = 80;
      const maxRadius = 250;
      
      others.forEach((other, i) => {
        const angle = i * angleStep - Math.PI / 2; // Start from top
        const distance = maxRadius - (other.similarity * (maxRadius - minRadius));
        
        positions[other.index] = {
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
          similarity: other.similarity
        };
      });
      
      // Center profile at origin
      positions[centerIndex] = {
        x: centerX,
        y: centerY,
        similarity: 1.0
      };
      
      return positions;
    }
    
    // Render the visualization
    function render() {
      const positions = isAlphabeticalMode ? calculateAlphabeticalLayout() : calculateLayout(currentCenter);
      svg.innerHTML = '';
      
      // Draw connection lines first (so they're behind circles) - only in radial mode
      if (!isAlphabeticalMode) {
        for (let i = 0; i < profiles.length; i++) {
          if (i !== currentCenter) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', positions[currentCenter].x);
            line.setAttribute('y1', positions[currentCenter].y);
            line.setAttribute('x2', positions[i].x);
            line.setAttribute('y2', positions[i].y);
            line.setAttribute('stroke', '#e5e5e5');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('class', 'connection-line');
            line.setAttribute('opacity', '0.5');
            svg.appendChild(line);
          }
        }
      }
      
      // Draw profile circles
      profiles.forEach((profile, i) => {
        const pos = positions[i];
        const isCentered = !isAlphabeticalMode && i === currentCenter;
        const size = isCentered ? 50 : 35;
        
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'profile-point');
        g.setAttribute('data-index', i);
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', size);
        circle.setAttribute('fill', profile.color);
        circle.setAttribute('stroke', isCentered ? '#333' : '#666');
        circle.setAttribute('stroke-width', isCentered ? '4' : '2');
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos.x);
        text.setAttribute('y', pos.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', isCentered ? '28' : '20');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#fff');
        text.setAttribute('pointer-events', 'none');
        text.textContent = profile.name[0];
        
        g.appendChild(circle);
        g.appendChild(text);
        
        // Event listeners
        g.addEventListener('click', () => {
          // Toggle alphabetical mode if clicking the same centered profile
          if (!isAlphabeticalMode && i === currentCenter) {
            isAlphabeticalMode = true;
          } else {
            isAlphabeticalMode = false;
            currentCenter = i;
          }
          render();
          updateSidePanel();
        });
        
        g.addEventListener('mouseenter', () => {
          hoveredProfile = i;
          updateSidePanel();
        });
        
        g.addEventListener('mouseleave', () => {
          hoveredProfile = null;
          updateSidePanel();
        });
        
        svg.appendChild(g);
        
        // Add similarity label for non-centered profiles (only in radial mode)
        if (!isAlphabeticalMode && !isCentered) {
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.setAttribute('x', pos.x);
          label.setAttribute('y', pos.y + size + 20);
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('font-size', '12');
          label.setAttribute('fill', '#666');
          label.setAttribute('pointer-events', 'none');
          label.textContent = pos.similarity.toFixed(3);
          svg.appendChild(label);
        }
      });
    }
    
    // Update side panel with selected and hovered profiles
    function updateSidePanel() {
      const panel = document.getElementById('selected-profile');
      
      let html = '';
      
      if (isAlphabeticalMode) {
        // Alphabetical mode - show hoveredProfile or instructions
        if (hoveredProfile !== null) {
          const hovered = profiles[hoveredProfile];
          html = \`
            <div class="profile-card">
              <h2>
                <span class="profile-letter" style="background: \${hovered.color}">
                  \${hovered.name[0]}
                </span>
                \${hovered.name}
              </h2>
              <div class="profile-text">\${hovered.profileText}</div>
            </div>
          \`;
        } else {
          html = \`
            <div style="text-align: center; color: #666; padding: 40px 20px;">
              <h3 style="margin-bottom: 15px;">📋 Alphabetical View</h3>
              <p>All profiles arranged in alphabetical order.</p>
              <p style="margin-top: 15px;">Hover over any profile to see details, or click to explore similarities.</p>
            </div>
          \`;
        }
      } else {
        // Radial mode - show centered profile and hovered
        const centered = profiles[currentCenter];
        
        html = \`
          <div class="profile-card">
            <h2>
              <span class="profile-letter" style="background: \${centered.color}">
                \${centered.name[0]}
              </span>
              \${centered.name}
            </h2>
            <div class="profile-text">\${centered.profileText}</div>
          </div>
        \`;
        
        if (hoveredProfile !== null && hoveredProfile !== currentCenter) {
          const hovered = profiles[hoveredProfile];
          const sim = similarities[currentCenter][hoveredProfile];
          
          html += \`
            <div class="hover-profile">
              <h3>
                <span class="profile-letter" style="background: \${hovered.color}; width: 24px; height: 24px; font-size: 14px;">
                  \${hovered.name[0]}
                </span>
                \${hovered.name}
                <span class="similarity-badge">
                  \${(sim * 100).toFixed(1)}% similar
                </span>
              </h3>
              <div class="profile-text">\${hovered.profileText}</div>
            </div>
          \`;
        }
      }
      
      panel.innerHTML = html;
    }
    
    // Initial render
    render();
    updateSidePanel();
  </script>
</body>
</html>`;
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  // Load embeddings
  const embeddingsPath = path.join(__dirname, EMBEDDINGS_FILE);
  
  if (!fs.existsSync(embeddingsPath)) {
    console.error('❌ ${EMBEDDINGS_FILE} not found!');
    console.error('   Run: node test/embeddings-generator.js');
    process.exit(1);
  }
  
  const embeddingsFile = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));
  const profiles = Object.values(embeddingsFile.data);
  
  console.log(`\n📊 Analyzing ${profiles.length} profiles...\n`);
  
  // Step 1: Calculate all pairwise similarities
  const n = profiles.length;
  const similarities = Array(n).fill().map(() => Array(n).fill(0));
  
  console.log('Pairwise Cosine Similarities:');
  console.log('─'.repeat(60));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        similarities[i][j] = 1.0;
      } else if (i < j) {
        const sim = cosineSimilarity(profiles[i].embedding, profiles[j].embedding);
        similarities[i][j] = sim;
        similarities[j][i] = sim;
        if (PRINT_SIMILARITIES) {
          console.log(`  ${profiles[i].name} ↔ ${profiles[j].name}: ${sim.toFixed(3)}`);
        }
      }
    }
  }
  
  console.log('─'.repeat(60));
  
  // Step 2: Generate interactive HTML visualization
  console.log('\n📊 Generating interactive visualization...\n');
  const htmlViz = generateInteractiveHTML(profiles, similarities);
  
  const outputPath = path.join(__dirname, 'profile-similarities.html');
  fs.writeFileSync(outputPath, htmlViz);
  
  console.log(`\n✅ Interactive visualization saved to: ${outputPath}`);
  console.log(`   Open it in your browser and click any profile to explore!\n`);
  
  // Summary statistics
  const allSimilarities = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allSimilarities.push(similarities[i][j]);
    }
  }
  
  const avgSim = allSimilarities.reduce((a, b) => a + b, 0) / allSimilarities.length;
  const maxSim = Math.max(...allSimilarities);
  const minSim = Math.min(...allSimilarities);
  
  console.log('📈 Similarity Statistics:');
  console.log('─'.repeat(60));
  console.log(`  Average: ${avgSim.toFixed(3)}`);
  console.log(`  Maximum: ${maxSim.toFixed(3)}`);
  console.log(`  Minimum: ${minSim.toFixed(3)}`);
  console.log(`  Range:   ${(maxSim - minSim).toFixed(3)}`);
  console.log('─'.repeat(60));
}

// Run
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

export { cosineSimilarity, calculateRadialLayout };

