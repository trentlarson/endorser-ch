/**
 * Visualize Profile Similarities using Multidimensional Scaling (MDS)
 * 
 * This script:
 * 1. Loads test profile embeddings
 * 2. Calculates pairwise cosine similarities
 * 3. Uses MDS to project into 2D space
 * 4. Generates an ASCII and HTML visualization
 * 
 * Usage:
 *   node test/profile-similarity-visualizer.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// Multidimensional Scaling (MDS) Algorithm
// ============================================================================

/**
 * Classical MDS algorithm to project high-dimensional similarities into 2D
 * @param {number[][]} distanceMatrix - N×N matrix of pairwise distances
 * @returns {number[][]} - N×2 matrix of 2D coordinates
 */
function classicalMDS(distanceMatrix) {
  const n = distanceMatrix.length;
  
  // Step 1: Square the distances
  const squaredDistances = distanceMatrix.map(row => 
    row.map(d => d * d)
  );
  
  // Step 2: Create centering matrix and apply double centering
  const rowMeans = squaredDistances.map(row => 
    row.reduce((sum, val) => sum + val, 0) / n
  );
  const totalMean = rowMeans.reduce((sum, val) => sum + val, 0) / n;
  
  const B = squaredDistances.map((row, i) => 
    row.map((val, j) => -0.5 * (val - rowMeans[i] - rowMeans[j] + totalMean))
  );
  
  // Step 3: Eigenvalue decomposition (simplified - using power iteration for top 2 eigenvectors)
  const eigenvectors = powerIterationTop2(B);
  
  return eigenvectors;
}

/**
 * Simplified eigenvalue decomposition using power iteration
 * Gets the top 2 eigenvectors for 2D projection
 */
function powerIterationTop2(matrix) {
  const n = matrix.length;
  
  // Get first eigenvector
  let v1 = Array(n).fill(1).map(() => Math.random());
  for (let iter = 0; iter < 100; iter++) {
    v1 = multiplyMatrixVector(matrix, v1);
    v1 = normalize(v1);
  }
  
  // Deflate matrix to get second eigenvector
  const lambda1 = dotProduct(multiplyMatrixVector(matrix, v1), v1);
  const deflatedMatrix = matrix.map((row, i) =>
    row.map((val, j) => val - lambda1 * v1[i] * v1[j])
  );
  
  let v2 = Array(n).fill(1).map(() => Math.random());
  for (let iter = 0; iter < 100; iter++) {
    v2 = multiplyMatrixVector(deflatedMatrix, v2);
    v2 = normalize(v2);
  }
  
  // Return coordinates as [x, y] pairs
  const coords = v1.map((x, i) => [x, v2[i]]);
  
  // Normalize to [-1, 1] range
  const maxAbs = Math.max(...coords.flat().map(Math.abs));
  return coords.map(([x, y]) => [x / maxAbs, y / maxAbs]);
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map(row =>
    row.reduce((sum, val, i) => sum + val * vector[i], 0)
  );
}

function dotProduct(v1, v2) {
  return v1.reduce((sum, val, i) => sum + val * v2[i], 0);
}

function normalize(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / magnitude);
}

// ============================================================================
// Visualization Functions
// ============================================================================

function generateASCIIVisualization(profiles, coordinates) {
  const width = 80;
  const height = 40;
  
  // Create empty grid
  const grid = Array(height).fill().map(() => Array(width).fill(' '));
  
  // Scale coordinates to grid
  const scaledCoords = coordinates.map(([x, y]) => {
    const gridX = Math.floor((x + 1) / 2 * (width - 1));
    const gridY = Math.floor((1 - (y + 1) / 2) * (height - 1)); // Flip Y axis
    return [gridX, gridY];
  });
  
  // Draw axes
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  for (let i = 0; i < width; i++) grid[centerY][i] = '-';
  for (let i = 0; i < height; i++) grid[i][centerX] = '|';
  grid[centerY][centerX] = '+';
  
  // Place profiles
  scaledCoords.forEach((coord, i) => {
    const [x, y] = coord;
    const initial = profiles[i].name[0];
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = initial;
    }
  });
  
  // Convert to string
  return grid.map(row => row.join('')).join('\n');
}

function generateHTMLVisualization(profiles, coordinates, similarities) {
  const profileList = profiles.map(p => p.name).join(', ');
  
  const pointsHTML = profiles.map((profile, i) => {
    const [x, y] = coordinates[i];
    // Scale from [-1, 1] to [50, 450] for a 500px canvas
    const canvasX = (x + 1) * 225 + 25;
    const canvasY = (1 - y) * 225 + 25; // Flip Y for canvas coordinates
    
    return `
      <g class="profile-point" data-name="${profile.name}">
        <circle cx="${canvasX}" cy="${canvasY}" r="20" 
                fill="hsl(${i * 60}, 70%, 60%)" 
                stroke="#333" stroke-width="2"/>
        <text x="${canvasX}" y="${canvasY}" 
              text-anchor="middle" 
              dominant-baseline="middle"
              font-size="16" font-weight="bold" fill="#000">
          ${profile.name[0]}
        </text>
      </g>`;
  }).join('\n');
  
  // Generate similarity table
  const tableRows = profiles.map((p1, i) => {
    const cells = profiles.map((p2, j) => {
      if (i >= j) return '<td></td>';
      const sim = similarities[i][j];
      const color = sim > 0.9 ? '#4ade80' : 
                    sim > 0.8 ? '#86efac' :
                    sim > 0.7 ? '#fde047' :
                    sim > 0.6 ? '#fbbf24' : '#f87171';
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
  <title>Profile Similarity Visualization</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    
    h1 {
      color: #333;
      border-bottom: 3px solid #4ade80;
      padding-bottom: 10px;
    }
    
    .container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    
    svg {
      border: 2px solid #ddd;
      border-radius: 8px;
      background: #fafafa;
    }
    
    .profile-point {
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .profile-point:hover {
      transform: scale(1.2);
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
    }
    
    .legend-color {
      width: 30px;
      height: 20px;
      border-radius: 4px;
      border: 1px solid #999;
    }
    
    .info-text {
      color: #666;
      line-height: 1.6;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <h1>Profile Similarity Visualization</h1>
  
  <div class="container">
    <h2>2D Projection using Multidimensional Scaling (MDS)</h2>
    <p class="info-text">
      Each point represents a profile: <strong>${profileList}</strong>
      <br>
      The distances between points approximate their cosine similarity - 
      closer points have more similar profiles.
    </p>
    
    <svg width="500" height="500" viewBox="0 0 500 500">
      <!-- Axes -->
      <line x1="250" y1="0" x2="250" y2="500" stroke="#ccc" stroke-width="2"/>
      <line x1="0" y1="250" x2="500" y2="250" stroke="#ccc" stroke-width="2"/>
      
      <!-- Axis labels -->
      <text x="490" y="245" font-size="12" fill="#666">x</text>
      <text x="255" y="15" font-size="12" fill="#666">y</text>
      <text x="255" y="495" font-size="10" fill="#666">(-1, -1)</text>
      <text x="470" y="495" font-size="10" fill="#666">(1, -1)</text>
      <text x="255" y="15" font-size="10" fill="#666">(-1, 1)</text>
      <text x="470" y="15" font-size="10" fill="#666">(1, 1)</text>
      
      <!-- Profile points -->
      ${pointsHTML}
    </svg>
  </div>
  
  <div class="container">
    <h2>Pairwise Cosine Similarity Matrix</h2>
    <div class="legend">
      <div class="legend-item">
        <div class="legend-color" style="background: #4ade80"></div>
        <span>Very Similar (>0.9)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #86efac"></div>
        <span>Similar (>0.8)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #fde047"></div>
        <span>Medium (>0.7)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #fbbf24"></div>
        <span>Low (>0.6)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #f87171"></div>
        <span>Different (<0.6)</span>
      </div>
    </div>
    <table>
      ${headerRow}
      ${tableRows}
    </table>
  </div>
  
  <div class="container">
    <h2>Profile Descriptions</h2>
    <ul>
      ${profiles.map(p => `
        <li><strong>${p.name}:</strong> ${p.profileText}</li>
      `).join('')}
    </ul>
  </div>
  
  <div class="container info-text">
    <h2>About This Visualization</h2>
    <p>
      This visualization uses <strong>Classical Multidimensional Scaling (MDS)</strong> 
      to project high-dimensional profile embeddings (${profiles[0].embedding.length} dimensions) 
      into a 2D space while preserving pairwise distances.
    </p>
    <p>
      <strong>How it works:</strong>
    </p>
    <ol>
      <li>Calculate cosine similarity for every pair of profiles</li>
      <li>Convert similarities to distances: distance = 1 - similarity</li>
      <li>Use MDS to find 2D coordinates that best preserve these distances</li>
      <li>Plot each profile using the first letter of their name</li>
    </ol>
    <p>
      <strong>Interpretation:</strong> Profiles that are closer together in the visualization 
      have more similar embeddings (based on their text descriptions). The exact positions 
      are less important than the relative distances between points.
    </p>
  </div>
</body>
</html>`;
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  // Load embeddings
  const embeddingsPath = path.join(__dirname, 'embeddings.json');
  
  if (!fs.existsSync(embeddingsPath)) {
    console.error('❌ embeddings.json not found!');
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
        console.log(`  ${profiles[i].name} ↔ ${profiles[j].name}: ${sim.toFixed(3)}`);
      }
    }
  }
  
  console.log('─'.repeat(60));
  
  // Step 2: Convert similarities to distances
  const distances = similarities.map(row =>
    row.map(sim => 1 - sim)
  );
  
  // Step 3: Apply MDS to get 2D coordinates
  console.log('\n🔄 Applying Multidimensional Scaling (MDS)...\n');
  const coordinates = classicalMDS(distances);
  
  // Display coordinates
  console.log('2D Coordinates:');
  console.log('─'.repeat(60));
  profiles.forEach((profile, i) => {
    const [x, y] = coordinates[i];
    console.log(`  ${profile.name}: (${x.toFixed(3)}, ${y.toFixed(3)})`);
  });
  console.log('─'.repeat(60));
  
  // Step 4: Generate visualizations
  console.log('\n📈 Generating ASCII visualization...\n');
  const asciiViz = generateASCIIVisualization(profiles, coordinates);
  console.log(asciiViz);
  
  console.log('\n📊 Generating HTML visualization...\n');
  const htmlViz = generateHTMLVisualization(profiles, coordinates, similarities);
  
  const outputPath = path.join(__dirname, 'profile-similarities.html');
  fs.writeFileSync(outputPath, htmlViz);
  
  console.log(`\n✅ HTML visualization saved to: ${outputPath}`);
  console.log(`   Open it in your browser to see the interactive visualization!\n`);
  
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

export { cosineSimilarity, classicalMDS };

