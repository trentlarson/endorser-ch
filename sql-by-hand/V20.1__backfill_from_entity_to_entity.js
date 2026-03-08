/**
 * Backfill fromEntity and toEntity for existing GiveAction and Offer jwt rows.
 * Run after V20 migration has been applied.
 *
 * Backup DB first.
 *
 * Run thus:
 *
 * cd endorser-ch/src
 * cp ../sql-by-hand/V20.1__backfill_from_entity_to_entity.js .
 * APP_DB_FILE=... node V20.1__backfill_from_entity_to_entity.js
 *
 */

const sqlite3 = require('sqlite3').verbose()
const dbInfo = require('./conf/flyway.js')

const db = new sqlite3.Database(dbInfo.fileLoc)

/**
 * Extract toEntity from claim: recipient identifier, or first fulfills element of type PlanAction.
 * PlanAction may have identifier directly, or lastClaimId (resolved to handleId via DB lookup).
 */
function toEntityFromClaim(claim, db) {
  return new Promise((resolve, reject) => {
    if (claim.recipient?.identifier) {
      resolve(claim.recipient.identifier)
      return
    }
    const fulfillsArr = Array.isArray(claim.fulfills) ? claim.fulfills : (claim.fulfills ? [claim.fulfills] : [])
    const planActionFulfills = fulfillsArr.find(f => f?.['@type'] === 'PlanAction')
    if (!planActionFulfills) {
      resolve(undefined)
      return
    }
    if (planActionFulfills.identifier) {
      resolve(planActionFulfills.identifier)
      return
    }
    if (planActionFulfills.lastClaimId) {
      db.get('SELECT handleId FROM jwt WHERE id = ?', [planActionFulfills.lastClaimId], (err, row) => {
        if (err) {
          reject(err)
          return
        }
        resolve(row?.handleId)
      })
      return
    }
    resolve(undefined)
  })
}

async function fromEntityToEntityForClaim(claim, issuerDid, db) {
  let fromEntity, toEntity
  if (claim['@type'] === 'GiveAction') {
    fromEntity = claim.agent?.identifier
    toEntity = await toEntityFromClaim(claim, db)
  } else if (claim['@type'] === 'Offer') {
    fromEntity = claim.offeredBy?.identifier ?? issuerDid
    toEntity = await toEntityFromClaim(claim, db)
  }
  return { fromEntity, toEntity }
}

async function backfill() {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT id, claim, issuer, claimType FROM jwt WHERE claimType IN ('GiveAction', 'Offer') AND (fromEntity IS NULL OR toEntity IS NULL)",
      [],
      (err, rows) => {
        if (err) {
          reject(err)
          return
        }

        console.log(`Found ${rows.length} rows to backfill`)

        if (rows.length === 0) {
          resolve()
          return
        }

        const stmt = db.prepare('UPDATE jwt SET fromEntity = ?, toEntity = ? WHERE id = ?')
        let completed = 0
        let errors = 0

        const checkDone = () => {
          completed++
          if (completed === rows.length) {
            stmt.finalize()
            console.log(`Backfill complete. Updated ${rows.length - errors} rows, ${errors} errors.`)
            resolve()
          }
        }

        const processRow = async (row) => {
          let claim
          try {
            claim = typeof row.claim === 'string' ? JSON.parse(row.claim) : row.claim
          } catch (parseErr) {
            console.error(`Failed to parse claim for ${row.id}:`, parseErr.message)
            errors++
            checkDone()
            return
          }

          let fromEntity, toEntity
          try {
            const result = await fromEntityToEntityForClaim(claim, row.issuer, db)
            fromEntity = result.fromEntity
            toEntity = result.toEntity
          } catch (lookupErr) {
            console.error(`Failed to resolve toEntity for ${row.id}:`, lookupErr.message)
            errors++
            checkDone()
            return
          }

          stmt.run(fromEntity ?? null, toEntity ?? null, row.id, (runErr) => {
            if (runErr) {
              console.error(`Error updating ${row.id}:`, runErr.message)
              errors++
            }
            checkDone()
          })
        }

        const runAll = async () => {
          for (const row of rows) {
            await processRow(row)
          }
        }
        runAll().catch(reject)
      }
    )
  })
}

backfill()
  .then(() => {
    db.close()
    process.exit(0)
  })
  .catch((err) => {
    console.error('Backfill failed:', err)
    db.close()
    process.exit(1)
  })
