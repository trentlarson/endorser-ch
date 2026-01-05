/**
 * Helper script to generate real embeddings for test profiles
 * 
 * Usage:
 *   export OPENAI_API_KEY=your-key-here
 *   node test/embeddings-generator.js
 * 
 * This will generate embeddings for all test profiles and save them to a JSON file
 * that can be loaded in tests to avoid repeated API calls.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const modelId = 'text-embedding-3-small';
// const modelId = 'text-embedding-3-large'; // not very different results

// Test profiles - diverse interests with varying description lengths
const profileData = {
  agriculture1: {
    id: 'user-001',
    name: 'Alice',
    profileText: 'Passionate about sustainable agriculture, permaculture design, and regenerative farming practices'
  },
  agriculture2: {
    id: 'user-002',
    name: 'Bob',
    profileText: 'Interested in organic farming, permaculture, and sustainable food systems'
  },
  tech: {
    id: 'user-003',
    name: 'Carol',
    profileText: 'Software developer passionate about open source, decentralization, and blockchain'
  },
  community: {
    id: 'user-004',
    name: 'Dave',
    profileText: 'Community organizer focused on local resilience, mutual aid, and grassroots movements'
  },
  environment: {
    id: 'user-005',
    name: 'Eve',
    profileText: 'Environmental activist working on climate justice and ecosystem restoration'
  },
  techCommunity: {
    id: 'user-006',
    name: 'Frank',
    profileText: 'Building community tech platforms and digital tools for grassroots organizing'
  },
  
  // Education & Homeschooling
  homeschool1: {
    id: 'user-007',
    name: 'Grace',
    profileText: 'Homeschooling mom using Montessori and unschooling methods. Love nature-based learning, hands-on projects, and building community with other homeschool families. Always looking for co-op opportunities and field trip ideas.'
  },
  education1: {
    id: 'user-008',
    name: 'Henry',
    profileText: 'Education reform and alternative schools'
  },
  teacher1: {
    id: 'user-009',
    name: 'Iris',
    profileText: 'Former public school teacher now developing project-based curriculum for small learning communities. Interested in democratic education, Reggio Emilia approach, and helping kids develop critical thinking skills.'
  },
  
  // Construction & Machinery
  construction1: {
    id: 'user-010',
    name: 'Jack',
    profileText: 'Heavy equipment operator and mechanic. Love working on excavators, dozers, backhoes. Also into welding and metal fabrication.'
  },
  builder1: {
    id: 'user-011',
    name: 'Kate',
    profileText: 'Natural building techniques'
  },
  carpenter1: {
    id: 'user-012',
    name: 'Liam',
    profileText: 'Finish carpenter specializing in timber framing and traditional joinery. I build custom furniture using hand tools and teach workshops on woodworking skills. Looking to connect with other craftspeople who appreciate the old ways of building things that last.'
  },
  
  // Software & AI
  aiResearcher1: {
    id: 'user-013',
    name: 'Maya',
    profileText: 'Machine learning engineer working on natural language processing and ethical AI. Fascinated by large language models, alignment problems, and how we can build AI systems that actually benefit humanity rather than just optimize for engagement metrics.'
  },
  developer1: {
    id: 'user-014',
    name: 'Noah',
    profileText: 'Full-stack dev. React, Node, Python.'
  },
  dataScience1: {
    id: 'user-015',
    name: 'Olivia',
    profileText: 'Data scientist and visualization specialist interested in making complex information accessible to everyone'
  },
  
  // Guns & Firearms
  firearms1: {
    id: 'user-016',
    name: 'Paul',
    profileText: 'Competitive shooter and firearms instructor teaching safety and marksmanship. Focus on responsible gun ownership, hunting ethics, and Second Amendment rights. Also enjoy reloading ammunition and long-range precision shooting.'
  },
  gunsmith1: {
    id: 'user-017',
    name: 'Quinn',
    profileText: 'Gunsmithing and custom builds'
  },
  
  // Outdoors & Nature
  hiking1: {
    id: 'user-018',
    name: 'Rachel',
    profileText: 'Backpacking and wilderness survival'
  },
  climber1: {
    id: 'user-019',
    name: 'Sam',
    profileText: 'Rock climbing, mountaineering, and alpine adventures. Love pushing my limits on technical routes and multi-day expeditions. Always planning the next big objective in the mountains and looking for climbing partners who are passionate about the vertical world.'
  },
  outdoors1: {
    id: 'user-020',
    name: 'Tara',
    profileText: 'Fly fishing, hunting, wilderness camping. Spend as much time as possible in the backcountry away from screens and crowds.'
  },
  
  // Mushrooms & Foraging
  mycology1: {
    id: 'user-021',
    name: 'Uma',
    profileText: 'Mushroom cultivation and mycology enthusiast. Growing gourmet and medicinal mushrooms at home, experimenting with different substrates and species. Fascinated by the fungal kingdom and its role in ecosystem health. Also into foraging wild mushrooms and teaching others about identification.'
  },
  forager1: {
    id: 'user-022',
    name: 'Victor',
    profileText: 'Wild edibles and medicinal plants'
  },
  
  // Travel & Culture
  traveler1: {
    id: 'user-023',
    name: 'Wendy',
    profileText: 'Digital nomad living in different countries every few months. Love immersing myself in local cultures, learning languages, and finding the best street food. Currently exploring Southeast Asia and always looking for off-the-beaten-path recommendations and travel buddies for the next adventure.'
  },
  backpacker1: {
    id: 'user-024',
    name: 'Xavier',
    profileText: 'Budget travel and cultural exchange'
  },
  
  // Games & Sports
  basketball1: {
    id: 'user-025',
    name: 'Yara',
    profileText: 'Basketball coach and player. Love pickup games, teaching kids, and watching college hoops.'
  },
  boardgames1: {
    id: 'user-026',
    name: 'Zack',
    profileText: 'Board game designer and enthusiast with a collection of over 300 games. Host weekly game nights featuring everything from heavy euros to social deduction games. Also run a podcast reviewing new releases and interviewing designers. Looking to playtest prototypes and connect with other gamers in the area.'
  }
};

async function generateEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable required');
  }
  
  console.log(`Generating embedding for: "${text.substring(0, 50)}..."`);
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelId,
      input: text
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

async function generateAllEmbeddings() {
  console.log('Generating embeddings for test profiles...\n');
  
  const profilesWithEmbeddings = {};
  
  for (const [key, profile] of Object.entries(profileData)) {
    try {
      const embedding = await generateEmbedding(profile.profileText);
      profilesWithEmbeddings[key] = {
        ...profile,
        embedding
      };
      console.log(`✓ ${profile.name} (${embedding.length} dimensions)\n`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`✗ Failed to generate embedding for ${profile.name}:`, error.message);
      throw error;
    }
  }
  
  // Save to file with metadata
  const outputPath = path.join(__dirname, 'embeddings.json');
  const outputData = {
    meta: {
      modelProvider: 'api.openai.com',
      model: modelId,
      generatedAt: new Date().toISOString(),
      dimensions: Object.values(profilesWithEmbeddings)[0].embedding.length
    },
    data: profilesWithEmbeddings
  };
  
  fs.writeFileSync(
    outputPath,
    JSON.stringify(outputData, null, 2)
  );
  
  console.log(`\n✓ All embeddings generated and saved to ${outputPath}`);
  console.log(`✓ Model: ${outputData.meta.model} (${outputData.meta.dimensions} dimensions)`);
  console.log(`✓ Provider: ${outputData.meta.modelProvider}`);
  
  // Display some statistics
  console.log('\nSimilarity Analysis:');
  const entries = Object.entries(profilesWithEmbeddings);
  
  function cosineSimilarity(vec1, vec2) {
    const dot = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dot / (mag1 * mag2);
  }
  
  // Show most similar pairs
  const similarities = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [key1, profile1] = entries[i];
      const [key2, profile2] = entries[j];
      const sim = cosineSimilarity(profile1.embedding, profile2.embedding);
      similarities.push({
        pair: `${profile1.name} ↔ ${profile2.name}`,
        similarity: sim
      });
    }
  }
  
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  console.log('\nTop 3 most similar:');
  similarities.slice(0, 3).forEach(({ pair, similarity }) => {
    console.log(`  ${pair}: ${similarity.toFixed(3)}`);
  });
  
  console.log('\nTop 3 least similar:');
  similarities.slice(-3).reverse().forEach(({ pair, similarity }) => {
    console.log(`  ${pair}: ${similarity.toFixed(3)}`);
  });

  console.log('\nVisualize similarities:');
  console.log(`  run: node test/profile-similarity-visualizer.js`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAllEmbeddings().catch(error => {
    console.error('\nError:', error.message);
    process.exit(1);
  });
}

export { generateEmbedding, profileData };

