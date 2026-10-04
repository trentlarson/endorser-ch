/**
 * Interactive Similarity Visualizer
 *
 * Shows how the active embedding spec relates subjects:
 * 1. Loads vectors (test-vectors.json, or the whole evaluation corpus with --corpus)
 * 2. Calculates pairwise similarities
 * 3. Writes an interactive radial visualization; click a subject to center it
 *
 * Usage (from the repo root):
 *   npm run embedding:visualize                                    # test profiles -> similarities.html
 *   pkgx node test/embedding-eval/similarity-visualizer.js --corpus  # corpus -> corpus-similarities.html
 *
 * Radial distances and table colors are scaled to the range of similarities
 * shown, since each model has its own baseline (see results.md).
 */

const fs = require('fs')
const path = require('path')

const engine = require('../../src/api/services/embedding-engine')
const { activeEmbeddingSpec } = require('../../src/api/services/embedding-specs')

const PRINT_SIMILARITIES = false;

/**
 * Two-letter abbreviation for a name: first letter of first two words, or first two chars if one word.
 * @param {string} name
 * @returns {string}
 */
function twoLetterAbbrev(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  const s = String(name).trim();
  return (s.slice(0, 2) || s[0] || '?').toUpperCase();
}

// ============================================================================
// Visualization Functions
// ============================================================================

/**
 * @param {Array<{name, profileText}>} profiles
 * @param {number[][]} similarities
 * @param {string} title
 */
function generateInteractiveHTML(profiles, similarities, title) {
  // off-diagonal range and quantiles, for scaling distances and colors
  const offDiagonal = [];
  for (let i = 0; i < similarities.length; i++) {
    for (let j = i + 1; j < similarities.length; j++) {
      offDiagonal.push(similarities[i][j]);
    }
  }
  offDiagonal.sort((a, b) => a - b);
  const quantile = (q) => offDiagonal[Math.min(offDiagonal.length - 1, Math.floor(q * offDiagonal.length))];
  const scale = { lo: offDiagonal[0], hi: offDiagonal[offDiagonal.length - 1] };
  const [q95, q85, q70, q55, q40, q25, q10] = [0.95, 0.85, 0.7, 0.55, 0.4, 0.25, 0.1].map(quantile);

  // Serialize the data for JavaScript (include two-letter abbrev for labels)
  const profilesData = JSON.stringify(profiles.map((p, i) => ({
    name: p.name,
    abbrev: twoLetterAbbrev(p.name),
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
      // colored by rank among all pairs shown: top 5% dark green ... bottom 10% red
      const color = sim >= q95 ? '#16a34a' :  // Dark green
                    sim >= q85 ? '#4ade80' :  // Medium green
                    sim >= q70 ? '#86efac' :  // Light green
                    sim >= q55 ? '#bbf7d0' :  // Very light green
                    sim >= q40 ? '#fde047' :  // Light yellow
                    sim >= q25 ? '#fb923c' :  // Orange
                    sim >= q10 ? '#f97316' :  // Dark orange
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
  <title>Similarity Explorer</title>
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
      min-width: 32px;
      width: auto;
      padding: 0 6px;
      height: 32px;
      border-radius: 50%;
      font-weight: bold;
      font-size: 14px;
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
    
    .table-scroll-wrapper {
      overflow-x: auto;
      margin-top: 20px;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
    }
    
    table {
      width: max-content;
      min-width: 100%;
      border-collapse: collapse;
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
    
    /* Sticky first column so row headers stay visible when scrolling horizontally */
    th:first-child,
    td:first-child {
      position: sticky;
      left: 0;
      z-index: 2;
      background: white;
      border-right: 2px solid #999;
      min-width: 120px;
    }
    th:first-child {
      background: #4ade80;
      color: white;
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
    <p class="subtitle">${title} • Click any profile to explore its relationships • Hover to see details</p>
  </div>
  
  <div class="main-container">
    <div class="viz-container">
      <svg id="canvas" width="800" height="700"></svg>
    </div>
    
    <div class="side-panel">
      <div class="instructions">
        <strong>How to use:</strong><br>
        • Click any profile (two-letter label) to center it<br>
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
    <div class="table-scroll-wrapper">
      <table>
        ${headerRow}
        ${tableRows}
      </table>
    </div>
  </div>
  
  <script>
    // Data from Node.js
    const profiles = ${profilesData};
    const similarities = ${similaritiesData};
    // similarity range shown, so distances spread over the radius whatever the model's baseline
    const scale = ${JSON.stringify(scale)};
    const scaled = (sim) => (scale.hi > scale.lo ? (sim - scale.lo) / (scale.hi - scale.lo) : 1);
    
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
        const distance = maxRadius - (scaled(other.similarity) * (maxRadius - minRadius));
        
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
        text.setAttribute('font-size', isCentered ? '18' : '14');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#fff');
        text.setAttribute('pointer-events', 'none');
        text.textContent = profile.abbrev;
        
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
                  \${hovered.abbrev}
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
                \${centered.abbrev}
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
                <span class="profile-letter" style="background: \${hovered.color}; width: auto; min-width: 24px; height: 24px; font-size: 12px; padding: 0 4px;">
                  \${hovered.abbrev}
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

/**
 * @returns {Promise<{subjects: Array<{name, profileText, vector}>, label: string, outputFile: string}>}
 */
async function loadSubjects(useCorpus) {
  const spec = activeEmbeddingSpec();
  if (useCorpus) {
    const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus.json'), 'utf8'));
    const subjects = [];
    for (const subject of corpus.subjects) {
      const input = engine.subjectText(spec, subject.type, subject);
      const [vector] = await engine.embedTexts(spec, [input]);
      // drop the type prefix (eg. 'profile:') so the two-letter labels differ
      subjects.push({ name: subject.id.replace(/^[a-z]+:/, ''), profileText: input, vector });
    }
    return { subjects, label: `corpus.json, ${spec.embeddingSpecId}`, outputFile: 'corpus-similarities.html' };
  }
  const file = path.join(__dirname, 'test-vectors.json');
  if (!fs.existsSync(file)) {
    throw new Error('test-vectors.json not found; run: npm run embedding:test-vectors');
  }
  const vectorsFile = JSON.parse(fs.readFileSync(file, 'utf8'));
  const all = Object.values(vectorsFile.data);
  const withoutVectors = all.filter((p) => !p.vector).map((p) => p.name);
  if (withoutVectors.length > 0) {
    console.log(`Skipping profiles with no text (no vector): ${withoutVectors.join(', ')}`);
  }
  const subjects = all.filter((p) => p.vector).map((p) => ({ ...p, vector: engine.base64ToVector(p.vector) }));
  return { subjects, label: `test-vectors.json, ${vectorsFile.meta.embeddingSpecId}`, outputFile: 'similarities.html' };
}

async function main() {
  const { subjects: profiles, label, outputFile } = await loadSubjects(process.argv.includes('--corpus'));

  console.log(`\n📊 Analyzing ${profiles.length} subjects (${label})...\n`);

  // Step 1: Calculate all pairwise similarities (vectors are normalized, so dot = cosine)
  const n = profiles.length;
  const similarities = Array(n).fill().map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        similarities[i][j] = 1.0;
      } else if (i < j) {
        const sim = engine.dot(profiles[i].vector, profiles[j].vector);
        similarities[i][j] = sim;
        similarities[j][i] = sim;
        if (PRINT_SIMILARITIES) {
          console.log(`  ${profiles[i].name} ↔ ${profiles[j].name}: ${sim.toFixed(3)}`);
        }
      }
    }
  }

  // Step 2: Generate interactive HTML visualization
  const htmlViz = generateInteractiveHTML(profiles, similarities, label);
  const outputPath = path.join(__dirname, outputFile);
  fs.writeFileSync(outputPath, htmlViz);

  console.log(`✅ Interactive visualization saved to: ${path.relative(process.cwd(), outputPath)}`);
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

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
