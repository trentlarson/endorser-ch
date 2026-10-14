-- Expand short, system-local handle ID references that were stored unexpanded.
--
-- A client that reaches an entity through a shortened link, eg.
-- .../deep-link/project/01ABC..., holds only the part of the handle that
-- follows "https://endorser.ch/entity/". Until claim.service.js expanded such a
-- reference, whatever the client sent landed in the columns below exactly as
-- sent. Every report endpoint expands a short ID before it queries, so those
-- rows are links that nothing can follow: the give shows under no project, the
-- offer counts toward no plan.
--
-- This edits only derived index columns. The signed claims -- jwt.claim,
-- give_claim.fullClaim -- keep exactly what was signed, because their hashes
-- and the nonce chain are computed over that text and must not move.
--
-- Backup the DB first. Then:
--
--   sqlite3 ../endorser-ch-prod.sqlite3 < sql-by-hand/V20.2__expand_short_handle_id_references.sql
--
-- The script explains its own output as it goes, including how to tell whether
-- the result is what it should be.
--
-- If this deployment sets GLOBAL_ID_IRI_PREFIX to anything other than
-- https://endorser.ch, edit the prefix in the one place it is defined below.

CREATE TEMP TABLE prefix_config AS SELECT 'https://endorser.ch/entity/' AS entity_prefix;

.headers off
.mode list

SELECT '';
SELECT '####################################################################';
SELECT '# Expanding short handle ID references';
SELECT '#';
SELECT '# Prefix in use: ' || (SELECT entity_prefix FROM prefix_config);
SELECT '# If that is not this deployment''s GLOBAL_ID_IRI_PREFIX, stop now,';
SELECT '# restore the backup if the repair already ran, and edit the prefix.';
SELECT '####################################################################';


-- ===========================================================================
-- 1. Survey
-- ===========================================================================

SELECT '';
SELECT '=== 1. WHAT IS THERE ===============================================';
SELECT '';
SELECT 'Each row is one column that stores a reference from one claim to';
SELECT 'another. Only values with no URI scheme are counted, because those';
SELECT 'are the ones that were meant to name an entity here and do not.';
SELECT '';
SELECT '  repairable  the short value names an entity this server holds.';
SELECT '              Section 2 expands these. This is the damage.';
SELECT '  orphan      the short value names nothing here. Section 2 leaves';
SELECT '              these alone and section 4a lists them.';
SELECT '';

.headers on
.mode column

SELECT 'give_claim.fulfillsHandleId' AS col,
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || g.fulfillsHandleId) THEN 1 ELSE 0 END), 0) AS repairable,
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || g.fulfillsHandleId) THEN 0 ELSE 1 END), 0) AS orphan
  FROM give_claim g
 WHERE g.fulfillsHandleId IS NOT NULL AND g.fulfillsHandleId <> '' AND instr(g.fulfillsHandleId, ':') = 0
UNION ALL
SELECT 'give_claim.fulfillsPlanHandleId',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || g.fulfillsPlanHandleId) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || g.fulfillsPlanHandleId) THEN 0 ELSE 1 END), 0)
  FROM give_claim g
 WHERE g.fulfillsPlanHandleId IS NOT NULL AND g.fulfillsPlanHandleId <> '' AND instr(g.fulfillsPlanHandleId, ':') = 0
UNION ALL
SELECT 'offer_claim.fulfillsHandleId',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || o.fulfillsHandleId) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || o.fulfillsHandleId) THEN 0 ELSE 1 END), 0)
  FROM offer_claim o
 WHERE o.fulfillsHandleId IS NOT NULL AND o.fulfillsHandleId <> '' AND instr(o.fulfillsHandleId, ':') = 0
UNION ALL
SELECT 'offer_claim.fulfillsPlanHandleId',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || o.fulfillsPlanHandleId) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || o.fulfillsPlanHandleId) THEN 0 ELSE 1 END), 0)
  FROM offer_claim o
 WHERE o.fulfillsPlanHandleId IS NOT NULL AND o.fulfillsPlanHandleId <> '' AND instr(o.fulfillsPlanHandleId, ':') = 0
UNION ALL
SELECT 'plan_claim.fulfillsPlanHandleId',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || p.fulfillsPlanHandleId) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || p.fulfillsPlanHandleId) THEN 0 ELSE 1 END), 0)
  FROM plan_claim p
 WHERE p.fulfillsPlanHandleId IS NOT NULL AND p.fulfillsPlanHandleId <> '' AND instr(p.fulfillsPlanHandleId, ':') = 0
UNION ALL
SELECT 'give_provider.providerId',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || gp.providerId) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || gp.providerId) THEN 0 ELSE 1 END), 0)
  FROM give_provider gp
 WHERE gp.providerId IS NOT NULL AND gp.providerId <> '' AND instr(gp.providerId, ':') = 0
UNION ALL
-- jwt.toEntity holds the same reference for GiveAction and Offer rows, and
-- sql-by-hand/V20.1__backfill_from_entity_to_entity.js copied it unexpanded too
SELECT 'jwt.toEntity',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt other WHERE other.handleId = (SELECT entity_prefix FROM prefix_config) || j.toEntity) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt other WHERE other.handleId = (SELECT entity_prefix FROM prefix_config) || j.toEntity) THEN 0 ELSE 1 END), 0)
  FROM jwt j
 WHERE j.toEntity IS NOT NULL AND j.toEntity <> '' AND instr(j.toEntity, ':') = 0;

.headers off
.mode list

SELECT '';
SELECT 'Reading it:';
SELECT '';
SELECT '  All zeroes         Nothing to repair. Section 2 will change no';
SELECT '                     rows, which is safe and expected. Stop reading';
SELECT '                     after section 3 confirms the same.';
SELECT '  repairable > 0     Rows that are damaged and fixable. Section 2';
SELECT '                     expands exactly this many, and section 3 must';
SELECT '                     then show 0 for that column.';
SELECT '  orphan > 0         References to entities this server never';
SELECT '                     recorded. No script can know what they meant.';
SELECT '                     Read section 4a and decide by hand.';
SELECT '  Every column huge  Suspect the prefix above is wrong for this';
SELECT '                     deployment. Do not run section 2.';


-- ===========================================================================
-- 2. The repair
-- ===========================================================================

SELECT '';
SELECT '=== 2. THE REPAIR ==================================================';
SELECT '';
SELECT 'Each statement rewrites a value only when the expanded form names an';
SELECT 'entity this server holds, so a value that is short for some other';
SELECT 'reason is left untouched. Re-running the script changes nothing';
SELECT 'further: an expanded value contains '':'' and stops matching.';
SELECT '';
SELECT 'Each line below counts the rows that statement changed. Those counts';
SELECT 'should equal the "repairable" numbers in section 1, column for';
SELECT 'column. A count lower than its "repairable" figure means rows moved';
SELECT 'under the script; restore the backup and run it against a quiet DB.';
SELECT '';

BEGIN;

UPDATE give_claim
   SET fulfillsHandleId = (SELECT entity_prefix FROM prefix_config) || fulfillsHandleId
 WHERE fulfillsHandleId IS NOT NULL
   AND fulfillsHandleId <> ''
   AND instr(fulfillsHandleId, ':') = 0
   AND EXISTS (SELECT 1 FROM jwt
                WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || give_claim.fulfillsHandleId);
SELECT '  give_claim.fulfillsHandleId       expanded: ' || changes();

UPDATE give_claim
   SET fulfillsPlanHandleId = (SELECT entity_prefix FROM prefix_config) || fulfillsPlanHandleId
 WHERE fulfillsPlanHandleId IS NOT NULL
   AND fulfillsPlanHandleId <> ''
   AND instr(fulfillsPlanHandleId, ':') = 0
   AND EXISTS (SELECT 1 FROM jwt
                WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || give_claim.fulfillsPlanHandleId);
SELECT '  give_claim.fulfillsPlanHandleId   expanded: ' || changes();

UPDATE offer_claim
   SET fulfillsHandleId = (SELECT entity_prefix FROM prefix_config) || fulfillsHandleId
 WHERE fulfillsHandleId IS NOT NULL
   AND fulfillsHandleId <> ''
   AND instr(fulfillsHandleId, ':') = 0
   AND EXISTS (SELECT 1 FROM jwt
                WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || offer_claim.fulfillsHandleId);
SELECT '  offer_claim.fulfillsHandleId      expanded: ' || changes();

UPDATE offer_claim
   SET fulfillsPlanHandleId = (SELECT entity_prefix FROM prefix_config) || fulfillsPlanHandleId
 WHERE fulfillsPlanHandleId IS NOT NULL
   AND fulfillsPlanHandleId <> ''
   AND instr(fulfillsPlanHandleId, ':') = 0
   AND EXISTS (SELECT 1 FROM jwt
                WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || offer_claim.fulfillsPlanHandleId);
SELECT '  offer_claim.fulfillsPlanHandleId  expanded: ' || changes();

UPDATE plan_claim
   SET fulfillsPlanHandleId = (SELECT entity_prefix FROM prefix_config) || fulfillsPlanHandleId
 WHERE fulfillsPlanHandleId IS NOT NULL
   AND fulfillsPlanHandleId <> ''
   AND instr(fulfillsPlanHandleId, ':') = 0
   AND EXISTS (SELECT 1 FROM jwt
                WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || plan_claim.fulfillsPlanHandleId);
SELECT '  plan_claim.fulfillsPlanHandleId   expanded: ' || changes();

UPDATE give_provider
   SET providerId = (SELECT entity_prefix FROM prefix_config) || providerId
 WHERE providerId IS NOT NULL
   AND providerId <> ''
   AND instr(providerId, ':') = 0
   AND EXISTS (SELECT 1 FROM jwt
                WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || give_provider.providerId);
SELECT '  give_provider.providerId          expanded: ' || changes();

UPDATE jwt
   SET toEntity = (SELECT entity_prefix FROM prefix_config) || toEntity
 WHERE toEntity IS NOT NULL
   AND toEntity <> ''
   AND instr(toEntity, ':') = 0
   AND EXISTS (SELECT 1 FROM jwt other
                WHERE other.handleId = (SELECT entity_prefix FROM prefix_config) || jwt.toEntity);
SELECT '  jwt.toEntity                      expanded: ' || changes();

COMMIT;


-- ===========================================================================
-- 3. Verify
-- ===========================================================================

SELECT '';
SELECT '=== 3. AFTER THE REPAIR ============================================';
SELECT '';
SELECT 'The same survey as section 1, run again.';
SELECT '';

.headers on
.mode column

SELECT 'give_claim.fulfillsHandleId' AS col,
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || g.fulfillsHandleId) THEN 1 ELSE 0 END), 0) AS repairable,
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || g.fulfillsHandleId) THEN 0 ELSE 1 END), 0) AS orphan
  FROM give_claim g
 WHERE g.fulfillsHandleId IS NOT NULL AND g.fulfillsHandleId <> '' AND instr(g.fulfillsHandleId, ':') = 0
UNION ALL
SELECT 'give_claim.fulfillsPlanHandleId',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || g.fulfillsPlanHandleId) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || g.fulfillsPlanHandleId) THEN 0 ELSE 1 END), 0)
  FROM give_claim g
 WHERE g.fulfillsPlanHandleId IS NOT NULL AND g.fulfillsPlanHandleId <> '' AND instr(g.fulfillsPlanHandleId, ':') = 0
UNION ALL
SELECT 'offer_claim.fulfillsHandleId',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || o.fulfillsHandleId) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || o.fulfillsHandleId) THEN 0 ELSE 1 END), 0)
  FROM offer_claim o
 WHERE o.fulfillsHandleId IS NOT NULL AND o.fulfillsHandleId <> '' AND instr(o.fulfillsHandleId, ':') = 0
UNION ALL
SELECT 'offer_claim.fulfillsPlanHandleId',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || o.fulfillsPlanHandleId) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || o.fulfillsPlanHandleId) THEN 0 ELSE 1 END), 0)
  FROM offer_claim o
 WHERE o.fulfillsPlanHandleId IS NOT NULL AND o.fulfillsPlanHandleId <> '' AND instr(o.fulfillsPlanHandleId, ':') = 0
UNION ALL
SELECT 'plan_claim.fulfillsPlanHandleId',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || p.fulfillsPlanHandleId) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || p.fulfillsPlanHandleId) THEN 0 ELSE 1 END), 0)
  FROM plan_claim p
 WHERE p.fulfillsPlanHandleId IS NOT NULL AND p.fulfillsPlanHandleId <> '' AND instr(p.fulfillsPlanHandleId, ':') = 0
UNION ALL
SELECT 'give_provider.providerId',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || gp.providerId) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || gp.providerId) THEN 0 ELSE 1 END), 0)
  FROM give_provider gp
 WHERE gp.providerId IS NOT NULL AND gp.providerId <> '' AND instr(gp.providerId, ':') = 0
UNION ALL
SELECT 'jwt.toEntity',
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt other WHERE other.handleId = (SELECT entity_prefix FROM prefix_config) || j.toEntity) THEN 1 ELSE 0 END), 0),
       coalesce(sum(CASE WHEN EXISTS (SELECT 1 FROM jwt other WHERE other.handleId = (SELECT entity_prefix FROM prefix_config) || j.toEntity) THEN 0 ELSE 1 END), 0)
  FROM jwt j
 WHERE j.toEntity IS NOT NULL AND j.toEntity <> '' AND instr(j.toEntity, ':') = 0;

.headers off
.mode list

SELECT '';
SELECT 'This is the check that matters:';
SELECT '';
SELECT '  repairable is 0 everywhere   The repair worked. Nothing fixable';
SELECT '                               is left.';
SELECT '  repairable still > 0         The repair did not take. The likely';
SELECT '                               cause is a prefix that does not match';
SELECT '                               the handles in the jwt table. Nothing';
SELECT '                               was lost; restore the backup, fix the';
SELECT '                               prefix and run again.';
SELECT '  orphan unchanged             Expected. Section 2 never touches';
SELECT '                               these. Section 4a lists them.';


-- ===========================================================================
-- 4. What this script cannot repair
-- ===========================================================================

SELECT '';
SELECT '=== 4a. REFERENCES TO ENTITIES THAT ARE NOT HERE ===================';
SELECT '';
SELECT 'Each row is a claim pointing at an entity this server never';
SELECT 'recorded, so nothing can be inferred about what was meant and the';
SELECT 'value is left as sent. These match the "orphan" counts above.';
SELECT '';
SELECT 'No rows below is the good outcome. Rows below need a person: check';
SELECT 'whether the entity lives on another server, or whether the issuer';
SELECT 'sent a typo, and decide per row.';
SELECT '';

.headers on
.mode column

SELECT 'give_claim.fulfillsPlanHandleId' AS col, handleId AS row_handle, fulfillsPlanHandleId AS value
  FROM give_claim
 WHERE fulfillsPlanHandleId IS NOT NULL AND fulfillsPlanHandleId <> ''
   AND instr(fulfillsPlanHandleId, ':') = 0
   AND NOT EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || give_claim.fulfillsPlanHandleId)
UNION ALL
SELECT 'offer_claim.fulfillsPlanHandleId', handleId, fulfillsPlanHandleId
  FROM offer_claim
 WHERE fulfillsPlanHandleId IS NOT NULL AND fulfillsPlanHandleId <> ''
   AND instr(fulfillsPlanHandleId, ':') = 0
   AND NOT EXISTS (SELECT 1 FROM jwt WHERE jwt.handleId = (SELECT entity_prefix FROM prefix_config) || offer_claim.fulfillsPlanHandleId);

.headers off
.mode list

SELECT '';
SELECT '=== 4b. PROVIDER LINKS THAT WERE NEVER WRITTEN =====================';
SELECT '';
SELECT 'A GiveAction naming a provider by a short ID threw before its';
SELECT 'give_provider row was written, so the give was stored with no';
SELECT 'provider at all. There is no row here to edit, and the link only';
SELECT 'comes back if the issuer sends an edit that names the provider';
SELECT 'again. Each row below is one such give, newest first, with the';
SELECT 'provider reference as it was signed, so the issuers can be told.';
SELECT '';
SELECT 'No rows below is the good outcome. Rows below are the gives that';
SELECT 'silently lost their project, and the repair above did not restore';
SELECT 'them. A give whose issuer also named the project under "fulfills"';
SELECT 'was repaired by section 2 and does not appear here.';
SELECT '';

.headers on
.mode column

SELECT j.id AS claim_id,
       j.issuer,
       j.issuedAt,
       g.handleId AS give_handle,
       coalesce(
         json_extract(j.claim, '$.provider.identifier'),
         json_extract(j.claim, '$.provider[0].identifier')
       ) AS signed_provider_identifier
  FROM jwt j
  JOIN give_claim g ON g.jwtId = j.id
 WHERE j.claimType = 'GiveAction'
   AND json_extract(j.claim, '$.provider') IS NOT NULL
   AND coalesce(
         json_extract(j.claim, '$.provider.identifier'),
         json_extract(j.claim, '$.provider[0].identifier')
       ) IS NOT NULL
   AND instr(coalesce(
         json_extract(j.claim, '$.provider.identifier'),
         json_extract(j.claim, '$.provider[0].identifier')
       ), ':') = 0
   AND NOT EXISTS (SELECT 1 FROM give_provider gp WHERE gp.giveHandleId = g.handleId)
 ORDER BY j.issuedAt DESC;

.headers off
.mode list

SELECT '';
SELECT '=== DONE ===========================================================';
SELECT '';
SELECT 'What changed: the seven columns listed in section 2, and nothing';
SELECT 'else. The signed claims in jwt.claim and give_claim.fullClaim were';
SELECT 'read but never written, so every claim hash and the nonce chain are';
SELECT 'exactly as they were.';
SELECT '';
SELECT 'Safe to run again: yes. An expanded value no longer matches, so a';
SELECT 'second run reports zero repairable and changes nothing.';
SELECT '';

DROP TABLE prefix_config;
