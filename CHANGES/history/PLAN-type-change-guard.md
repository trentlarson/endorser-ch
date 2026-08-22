# PLAN: Type/context changes on a handle chain, and external-handle consistency

Status: **applied** — Phase 1 and Phase 2 implemented; full suite green (645 passing).

## Problem

A claim whose top-level `identifier` is a DID (`@type: Person` or
`Organization`) gets that DID as its `handleId`. A later submission with the
same DID `identifier` but a different `@context` or `@type` is rejected:

- `src/api/services/claim.service.js:2035` — `"You cannot change the type of an existing entry."`
- `src/api/services/claim.service.js:1965` — same rule on the `lastClaimId` path
- `src/api/services/claim.service.js:1659-1668` (`gatherErrors`) — same rule a
  third time, applied to every clause carrying a `lastClaimId` or an Endorser
  `handleId`

Stored `Person` records with `@context: "http://schema.org"` therefore cannot
be corrected to `https://schema.org` by their issuer. A misspelled `@type`
would be stuck the same way.

## Root cause

Two separate inconsistencies combine.

**1. The guard compares `@context` as a raw string, while the rest of the
server treats the two schema.org spellings as equal.** `isContextSchemaOrg`
(`claim.service.js:37-39`) accepts both `http://schema.org` and
`https://schema.org`, and every type dispatch in `createEmbeddedClaimEntry`
goes through it. The guard alone uses `!=`. So the server stores, indexes, and
processes `http://` and `https://` as the same context but refuses to let one
replace the other.

**2. The type guard is broader than the invariant it protects.** Commit
`43483c1` added it because four types maintain a row per `handleId` and update
it in place on every edit:

| `@type`      | table           | chooses insert vs update by                          |
|--------------|-----------------|------------------------------------------------------|
| `GiveAction` | `give_claim`    | `isFirstClaimForHandleId` flag (`claim.service.js:942`)  |
| `Offer`      | `offer_claim`   | `isFirstClaimForHandleId` flag (`claim.service.js:1214`) |
| `PlanAction` | `plan_claim`    | row lookup `planInfoByHandleId` (`claim.service.js:1305`) |
| `Project`    | `project_claim` | row lookup `projectInfoByHandleId` (`claim.service.js:1365`) |

A type change away from one of these leaves a stale cache row. A type change
*into* `GiveAction` or `Offer` is also unsafe, but only because the flag is
false whenever any previous handle entry exists, so the writer issues an
`UPDATE` against a row that does not exist and zero rows change. `PlanAction`
and `Project` do not have that problem: they look for the row.

Types with no handle-keyed table (`Person`, `Organization`, `JoinAction`,
`Tenure`, `VoteAction`, `AgreeAction`, `Emoji`, `RegisterAction`, and any
unrecognized type) carry no stale-row risk at all.

Facts that constrain the fix:

- DID-as-handle is documented, deliberate design (`README.md:230-232`; the
  `claimPayload.iss == handleId` subject-edit branch at `claim.service.js:1983`
  and `:2049`; `GET /api/claim/byHandle/{did}` at `claim-v1-router.js:285`;
  `test/controller-endorser-3-skills.js:237` chains 25 `Person` claims on one
  DID handle).
- Cache tables for `Person` or `Organization` may be added later. A rule that
  hard-codes "these types are safe to change" would block the same fix again
  the day such a table lands.
- Correcting a misspelled `@type` is a change *from* an unrecognized type *to*
  a real one, possibly a cached one. The rule must allow that.

## Approach

**Rule:** a handle chain may change `@context` or `@type` unless the
*previous* entry's type holds handle-keyed cache rows. Context equality uses
the same equivalence as the dispatcher (`isContextSchemaOrg`), so
`http://schema.org` ↔ `https://schema.org` is not a change.

Why "previous" only: the stale-row hazard lives entirely on the old side. The
new side is made safe by having every cache writer decide insert-vs-update by
looking for its own row — which `PlanAction` and `Project` already do and
`GiveAction`/`Offer` will be changed to do. With that, `isFirstClaimForHandleId`
has no remaining consumer and is deleted. A chain can go
unknown-type → `Person` → `Person`-with-cache-table → anything-non-cached, and
each step leaves the cache tables consistent.

```js
// claim.service.js, beside isContextSchemaOrg (~line 37).
// Add a type here when adding a table keyed by handleId.
const TYPES_WITH_HANDLE_CACHE = ['GiveAction', 'Offer', 'PlanAction', 'Project']

const sameContext = (a, b) =>
  a === b || (isContextSchemaOrg(a) && isContextSchemaOrg(b))

// Return an error message if `claim` may not replace `prevJwt`, else null.
const typeChangeRejection = (prevJwt, claim) => {
  if (sameContext(prevJwt.claimContext, claim['@context'])
      && prevJwt.claimType === claim['@type']) {
    return null
  }
  if (isContextSchemaOrg(prevJwt.claimContext)
      && TYPES_WITH_HANDLE_CACHE.includes(prevJwt.claimType)) {
    return `You cannot change the type of an existing ${prevJwt.claimType}`
      + ` (from ${prevJwt.claimContext} & ${prevJwt.claimType}`
      + ` to ${claim['@context']} & ${claim['@type']}).`
  }
  return null
}
```

Issuer/agent authorization is untouched: the subject (issuer == DID handle),
the original issuer, or an assigned agent may edit; nobody else may.

## Phase 1 — the fix

- [x] 1. Add `TYPES_WITH_HANDLE_CACHE`, `sameContext`, `typeChangeRejection`
      to `src/api/services/claim.service.js` beside `isContextSchemaOrg`.
- [x] 2. `lastClaimId` path (`claim.service.js:1965-1975`): replace the inline
      comparison with `typeChangeRejection(lastClaimJwt, claimPayloadClaim)`.
- [x] 3. `identifier` path (`claim.service.js:2035-2043`): replace with
      `typeChangeRejection(prevEntry, claimPayloadClaim)`.
- [x] 4. `gatherErrors` (`claim.service.js:1659-1668`): skip the
      `suppliedType` comparison when `claimInfo.clause === claim` (top level;
      steps 2–3 decide it). Nested references keep the strict match — a type
      mismatch on `fulfills: { '@type': 'PlanAction', lastClaimId }` means the
      reference is wrong, unrelated to cache tables.
- [x] 5. `createGive` (`claim.service.js:942`): replace the flag test with
      `await dbService.giveInfoByHandleId(handleId)` → insert if absent, else
      update. Same for `createOffer` (`:1214`) with `offerInfoByHandleId`.
- [x] 6. Delete `isFirstClaimForHandleId` end to end: the local at `:1950`,
      the assignments at `:2093` and in the external-handle branch, and the
      parameter threaded through `createEmbeddedClaimEntries` (`:1550`),
      `createEmbeddedClaimEntry` (`:995`), `createGive` (`:778`), and the
      call sites at `:1092`, `:1587`, `:2135`.
- [x] 7. Tests.
      In `test/controller-endorser-3-skills.js` (the existing `Person` handle chain):
      - [x] a. `Person`, `@context: "http://schema.org"`, `identifier: <did>`
            → 201. Resubmit by the same issuer with `https://schema.org` →
            201. `GET /api/claim/byHandle/<did>` returns `claimContext`
            `https://schema.org`. **This is the production case.**
      - [x] b. `@type: "Persn"` on a DID handle → 201; resubmit as `Person`
            → 201 (misspelling fix; unrecognized → non-cached).
      - [x] c. `Person` resubmitted as `Offer` on the same DID handle → 201,
            and `offer_claim` has a row for that handle (proves step 5; this
            is the path that silently no-ops before the change).
      - [x] d. That `Offer` resubmitted as `Person` → 400 with the
            `typeChangeRejection` message (cached → anything is blocked).
      - [x] e. Fix attempt by a DID that is neither the subject nor the
            original issuer → 400 (issuer rule, unchanged).
      In `test/controller-endorser-6-plans-totals.js` beside `'v2 fail to update a plan with wrong type'` (`:552`):
      - [x] f. `PlanAction` edited via `lastClaimId` with only `@context`
            flipped `https` → `http` → 201 (context equivalence on a cached
            type).
      - [x] g. `PlanAction` edited via bare `identifier` (no `lastClaimId`)
            with `@type: Offer` → 400. Covers the `:2035` path, untested
            today.
      - [x] h. Assert the message text in d and g and in the existing `:552`
            test, not only the status.
- [x] 8. `README.md:230-235`: after "It may be a DID", one sentence: the
      `@context`/`@type` of a handle chain may change unless the previous
      entry is a `GiveAction`, `Offer`, `PlanAction`, or `Project`;
      `http://schema.org` and `https://schema.org` are equivalent.
- [x] 9. `CHANGELOG.md` entry.
- [x] 10. `test/test.sh` green.

## Phase 2 — consistency for future data

Independent of Phase 1; can ship together or later.

- [x] 11. **Warn on `http://schema.org`.** In `createWithClaimRecord`, when
      `claimPayloadClaim['@context'] === 'http://schema.org'`, append to the
      existing `embeddedRecordWarning` channel: "Use https://schema.org; the
      http form is deprecated." Document `https://schema.org` as canonical in
      `README.md`. Rejecting the `http` form is a client-breaking change and is
      **not** in this plan; it belongs to a future major version once clients
      have been observed to stop sending it.
- [x] 12. **Restrict external handles to entity types.** A top-level
      `identifier` that is a non-Endorser global URI (including a DID) with
      no existing handle entry currently creates a new handle for *any* type
      (`claim.service.js:2089-2092`). Limit that to
      `PlanAction`, `Project`, `Person`, `Organization`:
      - [x] a. Audit production first (per deployment; adjust the prefix to
            that deployment's `GLOBAL_ID_IRI_PREFIX`):
            ```sql
            SELECT claimType, claimContext, COUNT(*) FROM jwt
            WHERE handleId NOT LIKE 'https://endorser.ch/entity/%'
            GROUP BY claimType, claimContext ORDER BY 3 DESC;
            ```
            Any type outside the four needs a decision before step 12b ships:
            leave historical rows as they are (the check applies only to new
            handles) or migrate them.
      - [x] b. In the `isFirstClaimForHandleId = true` branch that step 6
            rewrites (`:2089-2092`), reject with
            `"An external identifier can only introduce a PlanAction, Project, Person, or Organization."`
            for other types. Existing handles (any type) continue to accept
            edits, so no stored data is orphaned.
      - [x] c. Tests: `Offer` with `identifier: 'scheme://elsewhere/1'` →
            400; `Organization` with a `did:` identifier → 201; existing
            tests at `controller-endorser-6-plans-totals.js:65` and `:100`
            (`PlanAction`/`Project` with external IDs) still pass.
      - [x] d. README: state the four types.
      This also resolves the asymmetry between the nested scanner, which
      ignores DIDs (`util.js:324`), and the top level, which does not: a DID
      nested inside a claim is a reference to a person; a DID at the top of a
      `Person`/`Organization` claim is that entity's handle; a DID at the top
      of anything else is an error.

## Magnitude

Phase 1: one helper block, three guard sites, two writer changes, one
parameter removed from ~8 signatures, eight tests, two doc edits. About one
day including a full test run. No wire-format, schema, or client change.

Phase 2: one warning, one rejection branch, three tests, doc — half a day —
plus whatever the production audit (12a) turns up.

For comparison, the `identifier` → `claimId` rename (Rejected A) touches
~15 read sites in `claim.service.js`, the scanner in `util.js:319-345`,
swagger annotations in `src/api/controllers/*.js`, `README.md`, 8 top-level
and several dozen nested test references, and every client (TimeSafari,
endorser-mobile, partner integrations), with a dual-name deprecation window.
Several days server-side plus open-ended client work.

## Decisions taken

1. `Offer` and `GiveAction` do not carry external handles; the four types
   stand.
2. The `http://schema.org` context produces a warning in the response, not a
   rejection.

## Findings during implementation

- **Production audit (step 12a) result:** the only handles not created by this
  server are `Person` records on DIDs — 11 with `http://schema.org`, 4 with
  `https://schema.org`. No `Offer`/`GiveAction`/other type carries an external
  handle, so the type restriction strands nothing. The 11 `http` rows are the
  records this change lets their issuers correct.
- **Type changes could smuggle a forbidden type onto an external handle.** The
  first cut enforced `TYPES_WITH_EXTERNAL_HANDLE` only when a handle was
  introduced, so a `Person` on a DID could be edited into an `Offer`, leaving
  `offer_claim.handleId = did:…` and making `toEntity`/`fromEntity` DIDs
  ambiguous. `typeChangeRejection` now also rejects a type change on a
  non-Endorser handle when the new type is outside the four. Same-type edits of
  any historical row are unaffected. The non-cached → cached insert proof moved
  to an Endorser-handled chain (no identifier, edits via `lastClaimId`).

- **A bare Endorser `identifier` without `lastClaimId` always rejects.**
  `claim.service.js` computes `lastClaimInfo = lastClaimId ? R.find(...) : null`,
  so on the `identifier`-only path it is always `null`, and the pre-check
  `isGlobalEndorserHandleId(identifier) && !lastClaimInfo?.handleJwt` rejects
  every Endorser-created handle with "If you supply an Endorser identifier then
  it must have been sent earlier." The `identifier`-only edit path therefore
  runs only for external URIs and DIDs. This is consistent with
  `README.md` calling that usage deprecated, and nothing in the suite exercised
  it. Left as is; test 7g uses an external-identifier plan instead. Decide
  separately whether to delete the dead pre-check or restore the path.
- The Phase 2 type restriction means a *new* DID handle with a misspelled
  `@type` is refused (the misspelling can no longer create a handle). Test 7b
  therefore creates a correct `Person`, edits it to `Persn`, and corrects it
  back — and a separate test asserts the fresh-`Persn` refusal.
- `test/controller-endorser-4-load-many.js` pages through every claim stored
  by earlier suites with hard-coded totals; the six claims added to suite 3
  moved `TOTAL_CLAIMS` 159 → 165 and the second-page count 9 → 15.
- The working tree carried an uncommitted rename
  `jwtUnrevokedClaimExists` → `jwtClaimExists` (with a comment about not
  checking revoked status) in both `claim.service.js` and
  `endorser.db.service.js` before this work began. It is not part of this
  change and was left untouched.

## Rejected

**A. Rename the handle reference from `identifier` to `claimId`.**
Top-level `identifier` is not a claim ID. It is the entity handle: for
Endorser-created entities a global URI built from the *first* claim's ULID,
for imported entities an external URI, and for people a DID. Claim IDs
already have their own names — `claimId` in responses, `lastClaimId` in
requests, `jwtId` in tables — and `README.md:234` marks
`identifier`-as-reference deprecated in favor of `lastClaimId`. Renaming would
mislabel external handles, break every client, and still leave the question
"does a DID `identifier` become the handle?" unanswered.

**B. Rename DID identifiers to `did`.**
Commits `afd4bd0` and `c905b84` moved the payloads *from* `did` *to*
`identifier` to match schema.org. Reversing that breaks every client and the
documented schema for no gain in the guard logic.

**C. Exempt DIDs from the type guard by inspecting the identifier string.**
Ties the rule to identifier syntax instead of to the invariant (cache rows).
A future cache table for `Person` would get the wrong answer.

**D. Block when either the previous *or* the new type is cached.**
Simpler, but it forbids correcting a misspelled `@type` into any cached type,
and would forbid correcting `Person` records once `Person` gets a cache
table — exactly the future case raised during review. Blocking on the previous
type only, plus row-lookup writers, covers both.

**E. Drop the guard entirely.**
Leaves stale `give_claim`/`offer_claim`/`plan_claim`/`project_claim` rows when
a cached type changes. That is the failure `43483c1` fixed.

**F. Make the top-level branch exempt DIDs the way `util.js:324` does.**
Stops DIDs from becoming handles on new submissions: `byHandle/{did}` would not
resolve new `Person` records and the subject-edits-own-record rule would go
dead. A design reversal with unknown client impact. Phase 2 step 12 gets the
consistency benefit without the reversal.

**G. Reject `http://schema.org` on input.**
Client-breaking; deferred to a future major version (see step 11).
