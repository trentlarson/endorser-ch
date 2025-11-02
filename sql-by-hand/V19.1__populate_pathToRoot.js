/**
 * Populate pathToRoot for all existing registrations.
 * 
 * This script builds the path from each registered user back to the root (a user with no agent).
 * The pathToRoot is stored as a JSON array of DIDs, starting from the agent who registered this person,
 * going back through the chain to the original root user.
 * 
 * Example: If A registered B, and B registered C, then:
 * - A's pathToRoot: []
 * - B's pathToRoot: ["A"]
 * - C's pathToRoot: ["B", "A"]
 * 
 * Run thus:
 * 
 * cd endorser-ch/src
 * cp ../sql-by-hand/V19.1__populate_pathToRoot.js .
 * APP_DB_FILE=... node V19.1__populate_pathToRoot.js
 * 
 */

const sqlite3 = require('sqlite3').verbose()
const dbInfo = require('./conf/flyway.js')

const db = new sqlite3.Database(dbInfo.fileLoc)

/**
 * Build the path to root for a given DID
 * @param {string} did - The DID to build the path for
 * @param {Map} registrationMap - Map of did -> agent for all registrations
 * @param {Set} visited - Set of DIDs we've already visited (to detect cycles)
 * @returns {Array<string>} - Array of DIDs from agent to root
 */
function buildPathToRoot(did, registrationMap, visited = new Set()) {
  // Check for cycles
  if (visited.has(did)) {
    console.error(`Cycle detected at DID: ${did}`)
    return []
  }
  
  const agent = registrationMap.get(did)
  
  // If no agent, this is a root user
  if (!agent) {
    return []
  }
  
  // If agent is the same as did, this is a root user (self-registration)
  if (agent === did) {
    return []
  }
  
  visited.add(did)
  
  // Recursively build the path
  const agentPath = buildPathToRoot(agent, registrationMap, visited)
  
  // Return agent + agent's path
  return [agent, ...agentPath]
}

async function populatePathToRoot() {
  return new Promise((resolve, reject) => {
    // First, load all registrations into memory
    db.all('SELECT did, agent FROM registration', [], (err, rows) => {
      if (err) {
        reject(err)
        return
      }
      
      console.log(`Found ${rows.length} registrations to process`)
      
      // Build a map of did -> agent
      const registrationMap = new Map()
      for (const row of rows) {
        registrationMap.set(row.did, row.agent)
      }
      
      // Calculate pathToRoot for each registration
      const updates = []
      for (const row of rows) {
        const path = buildPathToRoot(row.did, registrationMap)
        const pathJson = JSON.stringify(path)
        updates.push({ did: row.did, pathToRoot: pathJson })
      }
      
      console.log(`Calculated paths for ${updates.length} registrations`)
      
      // Update the database
      const stmt = db.prepare('UPDATE registration SET pathToRoot = ? WHERE did = ?')
      
      let completed = 0
      let errors = 0
      
      for (const update of updates) {
        stmt.run([update.pathToRoot, update.did], (err) => {
          if (err) {
            console.error(`Error updating ${update.did}:`, err)
            errors++
          } else {
            completed++
          }
          
          if (completed + errors === updates.length) {
            stmt.finalize()
            if (errors > 0) {
              reject(new Error(`Completed with ${errors} errors out of ${updates.length} updates`))
            } else {
              console.log(`Successfully updated ${completed} registrations`)
              resolve()
            }
          }
        })
      }
      
      // Handle empty case
      if (updates.length === 0) {
        stmt.finalize()
        console.log('No registrations to update')
        resolve()
      }
    })
  })
}

// Run the migration
populatePathToRoot()
  .then(() => {
    console.log('Migration complete')
    db.close()
    process.exit(0)
  })
  .catch((err) => {
    console.error('Migration failed:', err)
    db.close()
    process.exit(1)
  })

