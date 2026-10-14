/**
 * Embed the test profiles with the active embedding spec and write
 * test/embedding-eval/test-vectors.json, which the group-matching tests
 * (test/controller-partner-3-group-matching-funs.js) and
 * similarity-visualizer.js read.
 *
 * Usage (from the repo root):
 *   npm run embedding:test-vectors
 *
 * Regenerate after changing these profiles or the default spec, then rerun
 * the group-matching tests; their similarity bounds are specific to the spec.
 */

const fs = require('fs')
const path = require('path')

const engine = require('../../src/api/services/embedding-engine')
const { activeEmbeddingSpec } = require('../../src/api/services/embedding-specs')

// Test profiles - diverse interests with varying description lengths
const profileData = {
  agriculture1: {
    id: 'user-001',
    name: 'A Alice',
    profileText: 'Passionate about sustainable agriculture, permaculture design, and regenerative farming practices'
  },
  agriculture2: {
    id: 'user-002',
    name: 'A Bob',
    profileText: 'Interested in organic farming, permaculture, and sustainable food systems'
  },
  tech: {
    id: 'user-003',
    name: 'A Carol',
    profileText: 'Software developer passionate about open source, decentralization, and blockchain'
  },
  community: {
    id: 'user-004',
    name: 'A Dave',
    profileText: 'Community organizer focused on local resilience, mutual aid, and grassroots movements'
  },
  environment: {
    id: 'user-005',
    name: 'A Eve',
    profileText: 'Environmental activist working on climate justice and ecosystem restoration'
  },
  techCommunity: {
    id: 'user-006',
    name: 'A Frank',
    profileText: 'Building community tech platforms and digital tools for grassroots organizing'
  },
  
  // Education & Homeschooling
  homeschool1: {
    id: 'user-007',
    name: 'A Grace',
    profileText: 'Homeschooling mom using Montessori and unschooling methods. Love nature-based learning, hands-on projects, and building community with other homeschool families. Always looking for co-op opportunities and field trip ideas.'
  },
  education1: {
    id: 'user-008',
    name: 'A Henry',
    profileText: 'Education reform and alternative schools'
  },
  teacher1: {
    id: 'user-009',
    name: 'A Iris',
    profileText: 'Former public school teacher now developing project-based curriculum for small learning communities. Interested in democratic education, Reggio Emilia approach, and helping kids develop critical thinking skills.'
  },
  
  // Construction & Machinery
  construction1: {
    id: 'user-010',
    name: 'A Jack',
    profileText: 'Heavy equipment operator and mechanic. Love working on excavators, dozers, backhoes. Also into welding and metal fabrication.'
  },
  builder1: {
    id: 'user-011',
    name: 'A Kate',
    profileText: 'Natural building techniques'
  },
  carpenter1: {
    id: 'user-012',
    name: 'A Liam',
    profileText: 'Finish carpenter specializing in timber framing and traditional joinery. I build custom furniture using hand tools and teach workshops on woodworking skills. Looking to connect with other craftspeople who appreciate the old ways of building things that last.'
  },
  
  // Software & AI
  aiResearcher1: {
    id: 'user-013',
    name: 'A Maya',
    profileText: 'Machine learning engineer working on natural language processing and ethical AI. Fascinated by large language models, alignment problems, and how we can build AI systems that actually benefit humanity rather than just optimize for engagement metrics.'
  },
  developer1: {
    id: 'user-014',
    name: 'A Noah',
    profileText: 'Full-stack dev. React, Node, Python.'
  },
  dataScience1: {
    id: 'user-015',
    name: 'A Olivia',
    profileText: 'Data scientist and visualization specialist interested in making complex information accessible to everyone'
  },
  
  // Guns & Firearms
  firearms1: {
    id: 'user-016',
    name: 'A Paul',
    profileText: 'Competitive shooter and firearms instructor teaching safety and marksmanship. Focus on responsible gun ownership, hunting ethics, and Second Amendment rights. Also enjoy reloading ammunition and long-range precision shooting.'
  },
  gunsmith1: {
    id: 'user-017',
    name: 'A Quinn',
    profileText: 'Gunsmithing and custom builds'
  },
  
  // Outdoors & Nature
  hiking1: {
    id: 'user-018',
    name: 'A Rachel',
    profileText: 'Backpacking and wilderness survival'
  },
  climber1: {
    id: 'user-019',
    name: 'A Sam',
    profileText: 'Rock climbing, mountaineering, and alpine adventures. Love pushing my limits on technical routes and multi-day expeditions. Always planning the next big objective in the mountains and looking for climbing partners who are passionate about the vertical world.'
  },
  outdoors1: {
    id: 'user-020',
    name: 'A Tara',
    profileText: 'Fly fishing, hunting, wilderness camping. Spend as much time as possible in the backcountry away from screens and crowds.'
  },
  
  // Mushrooms & Foraging
  mycology1: {
    id: 'user-021',
    name: 'A Uma',
    profileText: 'Mushroom cultivation and mycology enthusiast. Growing gourmet and medicinal mushrooms at home, experimenting with different substrates and species. Fascinated by the fungal kingdom and its role in ecosystem health. Also into foraging wild mushrooms and teaching others about identification.'
  },
  forager1: {
    id: 'user-022',
    name: 'A Victor',
    profileText: 'Wild edibles and medicinal plants'
  },
  
  // Travel & Culture
  traveler1: {
    id: 'user-023',
    name: 'A Wendy',
    profileText: 'Digital nomad living in different countries every few months. Love immersing myself in local cultures, learning languages, and finding the best street food. Currently exploring Southeast Asia and always looking for off-the-beaten-path recommendations and travel buddies for the next adventure.'
  },
  backpacker1: {
    id: 'user-024',
    name: 'A Xavier',
    profileText: 'Budget travel and cultural exchange'
  },
  
  // Games & Sports
  basketball1: {
    id: 'user-025',
    name: 'A Yara',
    profileText: 'Basketball coach and player. Love pickup games, teaching kids, and watching college hoops.'
  },
  boardgames1: {
    id: 'user-026',
    name: 'A Zack',
    profileText: 'Board game designer and enthusiast with a collection of over 300 games. Host weekly game nights featuring everything from heavy euros to social deduction games. Also run a podcast reviewing new releases and interviewing designers. Looking to playtest prototypes and connect with other gamers in the area.'
  },

  // empty profiles
  empty1: {
    id: 'user-027',
    name: 'Bold Alice',
    profileText: ''
  },
  empty2: {
    id: 'user-028',
    name: 'Bold Bob',
    profileText: ''
  }
};

async function main() {
  const spec = activeEmbeddingSpec()
  const data = {}
  for (const [key, profile] of Object.entries(profileData)) {
    const input = engine.subjectText(spec, 'profile', { description: profile.profileText })
    // empty text has no vector, as in production
    const vector = input === '' ? null : engine.vectorToBase64((await engine.embedTexts(spec, [input]))[0])
    data[key] = { ...profile, vector }
  }
  const output = {
    meta: {
      embeddingSpecId: spec.embeddingSpecId,
      dimensions: spec.dimensions,
      generatedAt: new Date().toISOString(),
    },
    data,
  }
  const file = path.join(__dirname, 'test-vectors.json')
  fs.writeFileSync(file, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`Wrote ${path.relative(process.cwd(), file)}: ${Object.keys(data).length} profiles, spec ${spec.embeddingSpecId}`)
  console.log('Visualize: npm run embedding:visualize')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
