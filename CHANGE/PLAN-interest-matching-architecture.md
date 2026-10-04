# Interest Matching Architecture Plan

Goal: every user profile and every project (plan) gets a semantic embedding;
anyone can find profiles and projects close to a profile, a project, or a
free-text query, optionally restricted to a bounding box; and the vectors are
usable on client devices (browser, Capacitor phone builds, Electron), so that
matching can run locally and, eventually, peer-to-peer without a server that
understands the underlying text.

The server implementation is the reference implementation of that future
protocol: the embedding format, the matching algorithm, and the wire format are
defined independently of the server, SQLite, and any vendor API.

---

## 1. Constraints

1. **One embedding space.** Vectors are comparable only when produced by the
   same model, artifact, input template, dimensionality, and normalization.
   Profiles, projects, and query text share one space so that profile↔profile,
   profile↔project, and project↔project comparisons are all meaningful.
2. **Reproducible off the server.** The model must be open-weight and runnable
   in the same runtime the clients use. A hosted API (e.g. OpenAI) fails this:
   no client can reproduce its vectors, and every profile is sent to a third
   party.
3. **Vectors are no more exposed than their source text.** Profile descriptions
   are readable by any registered user through `GET /api/partner/userProfile`
   (only the DID is hidden), and project descriptions are public claims. A
   vector is released to exactly those who can already read its source text,
   and never alongside a DID the requester cannot see.
4. **Partner segregation.** Per `README-context.md`, partner features are meant
   to split into a separate service. Embedding storage and generation live in
   the partner DB and partner code paths, and do not add work to the claim
   submission path in `claim.service.js`.

---

## 2. Baseline in the Codebase

What the code has at the start of this plan, and the defects this plan fixes.

### Schema (partner DB, `sql-for-partner/V6__user_profile_generate_embedding.sqlite3`)

```sql
CREATE TABLE user_profile_embedding (
  issuerDid TEXT PRIMARY KEY,
  embeddingVector TEXT NOT NULL,   -- comma-separated floats
  isForEmptyString INTEGER NOT NULL,
  updatedAt DATETIME NOT NULL,
  generateEmbedding BOOLEAN DEFAULT 1,
  FOREIGN KEY (issuerDid) REFERENCES user_profile(issuerDid)
);
```

- `user_profile` (V3) holds one free-form `description` per `issuerDid`, with
  two optional points (`locLat/locLon`, `locLat2/locLon2`), both indexed.
- Projects are in the **main** DB: `plan_claim` has `handleId`, `name`,
  `description`, and one point (`locLat/locLon`, indexed by V15).
  `project_claim` is a legacy table and out of scope.

### Flow

- `src/api/services/embeddings.service.js` calls OpenAI
  `text-embedding-3-small` (1536 dims). Blank text maps to a hard-coded vector in
  `embedding-empty-string.js`.
- `POST /api/partner/userProfile` re-embeds only when an embedding row already
  exists with `generateEmbedding` set; that row is created by an admin through
  `PUT /api/partner/userProfileGenerateEmbedding/:issuerDid`. On embedding
  failure the profile saves and the response carries a `userMessage`.
- `POST /api/partner/groupOnboardMatch` loads admitted members' vectors,
  substitutes the empty-string vector for missing ones, and greedily pairs by
  cosine similarity (`matching.service.js`).
- `test/embeddings-generator.js` produces `test/embeddings.json` (26 profiles,
  OpenAI vectors) used by the group-matching tests;
  `test/profile-similarity-visualizer.js` renders pairwise similarities.

### Defects and inconsistencies

| # | Finding | Consequence |
|---|---------|-------------|
| 1 | `generateEmbedding = 0` is never stored: the admin "off" path deletes the row (`partner-router.js`, `userProfileGenerateEmbedding`). | The column is dead weight; "flag" semantics live in row existence. |
| 2 | Only admin-flagged profiles get embeddings. | Contradicts the goal of embedding every profile. |
| 3 | A failed re-embed leaves the prior vector in place with no staleness marker. | Matching silently uses a vector for text the user has replaced. |
| 4 | `isForEmptyString` is set by `description === ''`, but generation trims first. | Whitespace-only descriptions get the empty vector yet `isForEmptyString = 0`. |
| 5 | The admin path embeds `''` for a DID with no `user_profile` row and inserts the embedding anyway; SQLite foreign keys are not enabled (no `PRAGMA foreign_keys` in `src`). | Orphan embedding rows are possible. |
| 6 | All members without text share one "empty" vector, so they score 1.0 against each other and pair first. | Accidental rather than specified behavior. |
| 7 | Vectors stored as comma-separated text: ~12 bytes per float, ~18 KB per profile. | 18× the size of a 256-dim float32 BLOB; parse cost on every read. |
| 8 | `CHANGELOG.md` (4.3.x) mentions an `empty_embedding_vector` table; no migration creates it and the dev partner DB lacks it. | A hand-made production table outside Flyway; V7 drops it. |
| 9 | Vectors come from OpenAI. | Fails constraint 2; incompatible with any on-device model, so all vectors are regenerated on switch. |

---

## 3. Embedding Spec

Embedding generation is a versioned protocol, identified by a short
`embeddingSpecId`. Application code refers to a spec ID, never to a bare model
name. Specs live in `src/api/services/embedding-specs.js`; the default:

```json
{
  "embeddingSpecId": "match-v1-granite311m-r2-q8-256",
  "modelRepo": "onnx-community/granite-embedding-311m-multilingual-r2-ONNX",
  "modelRevision": "8f039f21d4181327268271bea4b11ddcc7eef88d",
  "dtype": "q8",
  "fileSha256": {
    "onnx/model_quantized.onnx": "54d33d10…",
    "tokenizer.json": "0087c868…",
    "tokenizer_config.json": "7947bdf0…",
    "config.json": "f0a7f93b…"
  },
  "license": "Apache-2.0",
  "inputTemplate": "{text}",
  "subjectInputs": {
    "profile": "{description}",
    "plan": "{name}\n{description}",
    "query": "{text}"
  },
  "maxInputTokens": 512,
  "pooling": "cls",
  "outputDimensions": 768,
  "dimensions": 256,
  "normalize": "l2",
  "vectorEncoding": "float32-le",
  "similarity": "dot"
}
```

Rules that are part of every spec, implemented in
`src/api/services/embedding-engine.js`:

- **Preprocessing:** fill the subject template, collapse whitespace runs to one
  space, trim. Empty result → no vector.
- **Content hash:** sha256 of the preprocessed text (before `inputTemplate`).
- **Truncation:** tokens past `maxInputTokens` are dropped from the end.
- **One text per inference.** Quantized models compute activation scales over
  the whole input tensor, so batching changes vectors (see section 5).
- **Dimension reduction:** keep the first `dimensions` values (Matryoshka
  prefix), then L2-normalize.
- **File pinning:** model files are verified against `fileSha256` before use.

### Canonical artifact = the artifact clients run

The server generates vectors with the **same ONNX artifact and the same library
(transformers.js)** that a browser or Capacitor client would use, rather than a
full-precision "reference" the clients can't afford. The server is Node, so
`@huggingface/transformers` on `onnxruntime-node` runs the identical file that
`onnxruntime-web` runs in the PWA. Consistency between server and client vectors
matters more than the last fraction of benchmark quality.

Models load from `EMBEDDING_MODEL_DIR` (layout
`<modelRepo>/<modelRevision>/…`). Production mounts that directory as a host
volume filled by `npm run embedding:fetch-model` and sets
`EMBEDDING_ALLOW_REMOTE_MODELS=false`, so the server never downloads a model at
request time. With remote models disabled, the engine verifies the files and
then loads from that directory by path: transformers.js keys its cache
differently from its local-path lookup, so loading by repo ID with remote models
disabled never finds the cached files. The container needs a glibc base image:
`onnxruntime-node` has no musl (Alpine) binaries.

### Model selection

Requirements: multilingual (non-English users are expected), a license with no
use restrictions that pass through to users, an ONNX build that transformers.js
runs, and quality measured on this project's own corpus (section 7).

Results from `test/embedding-eval/results.md` (79 subjects in 12 languages, 171
judged pairs). "Anchored" is the fraction of within-subject orderings that match
human judgment, the closest proxy for "are X's top matches right":

| Spec | License | Download | Anchored | Cross-lingual | Hard negatives | Truncation | ms/text |
|---|---|---|---|---|---|---|---|
| **Granite-Embedding-311M-Multilingual-R2, q8 @256** (default) | Apache-2.0 | 313 MB | **0.900** | 0.873 | **0.982** | 1.000 | 12 |
| Granite 311M R2, q8 @768 | Apache-2.0 | 313 MB | 0.906 | 0.886 | 0.964 | 1.000 | 12 |
| EmbeddingGemma-300M, q8 @256 (reference only) | Gemma ToU | 309 MB | 0.886 | 0.895 | 0.893 | 0.857 | 62 |
| Granite 97M R2, fp32 @384 | Apache-2.0 | 390 MB | 0.874 | 0.868 | 0.839 | 0.857 | 8 |
| paraphrase-multilingual-MiniLM-L12-v2, q8 @384 | Apache-2.0 | 118 MB | 0.872 | 0.877 | 0.821 | 0.857 | 4 |
| snowflake-arctic-embed-m-v2.0, q8 @256 | Apache-2.0 | 311 MB | 0.858 | 0.846 | 0.929 | 0.857 | 10 |
| Granite 97M R2, q8 @384 | Apache-2.0 | 98 MB | 0.849 | 0.820 | 0.786 | 0.857 | 5 |
| multilingual-e5-small, q8 @384 | MIT | 118 MB | 0.781 | 0.759 | 0.875 | 0.857 | 4 |
| all-MiniLM-L6-v2, q8 @384 (English only) | Apache-2.0 | 23 MB | 0.742 | 0.605 | 0.893 | 0.857 | 2 |

Reading the table:

- **Granite 311M @256** is best or tied-best on every column but cross-lingual,
  where EmbeddingGemma leads by 0.02. It matches EmbeddingGemma's quality
  without its license, at one fifth the CPU time per text.
- **@256 vs @768** costs 0.006 anchored accuracy for one third the storage and
  bandwidth (1 KB vs 3 KB per vector). Granite 311M R2 is trained for
  Matryoshka truncation to 512/384/256/128.
- **Quantization matters for small models:** Granite 97M loses 0.025 from fp32
  to q8.
- **paraphrase-multilingual-MiniLM** is competitive for its size but truncates
  at 128 tokens; it fails the truncation test (the relevant sentence at the end
  of a long profile never reaches the model).
- **Similarity scales differ by model.** Granite's unrelated pairs average
  0.77 and strong pairs 0.87; the best strong/unrelated cut is 0.82. Thresholds
  belong to the spec, not the code.

The download size matters only for clients that embed text themselves
(section 6: clients that rank server-produced vectors never load a model). If
on-device embedding becomes a requirement for low-end phones, the fallback is a
separate spec on Granite 97M R2 (98 MB), with its vectors kept in their own
space.

### EmbeddingGemma license

EmbeddingGemma scored well but is excluded by its license, the Gemma Terms of
Use:

- §3.2 incorporates the Gemma Prohibited Use Policy by reference; Google edits
  that policy at its own URL, so the rules can change after shipping.
- §3.2 lets Google "restrict (remotely or otherwise) usage … that Google
  reasonably believes" violates the agreement, with Google as judge.
- §3.1 requires anyone distributing the weights (a PWA that downloads the model
  counts) to put the use restrictions into their own terms and pass on the
  agreement.
- §4.5 limits termination to breach; it is not revocable at will.

### Symmetric input

Every subject uses the same template, so profiles, projects, and queries share
one space and all comparison directions are meaningful. Granite R2 needs no
instruction prefix. Asymmetric query/document prompts (for models that use them)
would split projects into a second space and are out of scope.

### Granularity

One vector per subject: the whole profile description, or a project's name plus
description. Profiles are free-form paragraphs in a single field; splitting them
into atomic interests needs UI support and is future work. The schema carries a
`chunkIndex` so multi-vector subjects need no migration.

---

## 4. Data Model

Partner migration `sql-for-partner/V7__embedding.sqlite3`, with the matching
section of `sql-for-partner/README.md` updated in the same commit:

```sql
CREATE TABLE embedding (
  subjectType TEXT NOT NULL,         -- 'profile' | 'plan'
  subjectId TEXT NOT NULL,           -- profile: user_profile.rowid; plan: plan_claim.handleId
  embeddingSpecId TEXT NOT NULL,
  chunkIndex INTEGER NOT NULL DEFAULT 0,
  contentHash TEXT NOT NULL,         -- sha256 of the preprocessed input, before the template
  vector BLOB NOT NULL,              -- float32 little-endian, l2-normalized
  updatedAt DATETIME NOT NULL,
  PRIMARY KEY (subjectType, subjectId, embeddingSpecId, chunkIndex)
);
CREATE INDEX embedding_spec_type_updated ON embedding(embeddingSpecId, subjectType, updatedAt);
```

Design decisions:

- **Profile key is `user_profile.rowid`, not `issuerDid`.** The rowid survives
  upserts (`ON CONFLICT(issuerDid) DO UPDATE`) and is already the public profile
  identifier in `GET /userProfile/:rowId`; exporting vectors keyed by DID would
  leak identifiers.
- **Plan key is `handleId`**, which is stable across plan edits (`jwtId`
  changes on each edit).
- **`contentHash` replaces `isForEmptyString` and `generateEmbedding`.** A
  vector is current iff its hash equals the hash of the source's current
  preprocessed text. Empty text produces no row.
- **No location columns.** Location stays in `user_profile` and `plan_claim`;
  bounding-box filtering selects IDs there, then fetches vectors by ID.
- **Plan vectors in the partner DB** even though plans live in the main DB,
  because of constraint 4. Nothing joins across the two databases in SQL.

The same migration removes everything from the OpenAI design, since no deployment
depends on it:

```sql
DROP TABLE IF EXISTS user_profile_embedding;
DROP TABLE IF EXISTS empty_embedding_vector;   -- hand-made, outside Flyway
UPDATE group_onboard SET previousMatches = NULL; -- similarities from OpenAI vectors
```

Because `user_profile_embedding` disappears in V7, the group-matching cut-over
(phase 5) ships in the same release as the migration.

---

## 5. Generation Pipeline

### Engine

`embedTexts(spec, texts) → Float32Array[]` (`src/api/services/embedding-engine.js`)
loads the pinned artifact once, lazily, verifies file hashes, and runs **one text
per inference**. Batching is excluded: quantized models compute activation
scales over the whole input tensor, so padding and batch neighbors change each
vector (measured: similarity 0.98 between a text embedded alone and the same
text in a padded batch, which would break server/client reproducibility). The
ONNX session runs off the JS thread;
tokenization is on it. `embedding.service.js` queues inferences so only one runs
at a time. Measure event-loop delay under a backfill; move the engine into a
`worker_threads` worker if p99 API latency degrades.

### Triggers

- **Profiles:** `POST /api/partner/userProfile` embeds inline for **every**
  save (no admin gate) and upserts the row. On failure the profile
  saves anyway; the stale row is deleted so matching never uses a vector for
  replaced text; the sweep retries. `DELETE /api/partner/userProfile` deletes the rows.
- **Plans:** no inline work in `claim.service.js`. The sweep picks them up.
- **Sweep** (at startup and every `EMBEDDING_SWEEP_INTERVAL_MINUTES`, default
  60; 0 disables both): for each subject type, compute `contentHash` of current
  text for all rows, compare with stored hashes, embed the mismatches one at a
  time, delete rows whose subject disappeared or became empty. Before storing a
  vector it re-reads the subject's text, so a save made during the embedding is
  not overwritten with an older vector. This is also the backfill, the retry
  path, and the spec-upgrade path (run it for a second spec ID). A failure stops
  that sweep and is logged; the next interval retries. Full scans are fine at
  thousands of rows; switch plans to a `jwtId` cursor (ULIDs sort by time) if
  the scan becomes measurable.
- **Admin control:** `GET /api/partner/embeddingSweep` reports the last sweep
  (start, finish, per-type counts of current, embedded, and deleted vectors,
  error) and the vector counts per type; `POST` starts a sweep (`?wait=true`
  responds when it finishes). Sweeps that changed vectors log their counts at
  warn level, others at info.

### Retirement of the admin flag

`PUT /userProfileGenerateEmbedding/:issuerDid` and the `generateEmbedding` field
in `GET /userProfileForIssuer` are removed.
`GET /userProfileEmbeddingMetadata/:issuerDid` returns
`{ embeddingSpecId, hasCurrentEmbedding }`, where a vector is current when its
hash matches the profile's text, to the owner, to anyone who can see the owner's
DID, and to admins.

---

## 6. Matching and Client Availability

### Server matching endpoint

```text
GET /api/partner/similar
  from      = profile:<rowId> | plan:<handleId> | text:<query>
  to        = profile | plan | both
  minLocLat, minLocLon, maxLocLat, maxLocLon   (optional bounding box)
  minSimilarity   (optional, default from spec's matching config)
  limit           (default 25, max 50, the largest page the plan lookup returns)
```

1. Resolve the source vector: the stored row (404 when there is none), or embed
   `text:` on the fly, which costs CPU, so it requires registration
   (`ClaimService.getRateLimits`) and is limited to
   `EMBEDDING_QUERY_MAX_PER_MINUTE` (default 20) per user.
2. Select candidate IDs: bounding box via the indexed location queries
   (`profilesByLocation...` in the partner DB; plan location queries in
   `endorser.db.service.js`), or all subjects of the type when no box is given.
   Profiles match on either of their two points.
3. Fetch vectors for candidates with the active spec; compute dot products in
   memory. At 256 dims, 50,000 candidates is ~13 M multiply-adds — tens of
   milliseconds in JS. If the SQLite read becomes the cost, an in-process cache
   of `Float32Array`s keyed by `(type, id)`, invalidated on write, removes it.
4. Exclude the source itself; sort; cut at `minSimilarity` and `limit`.
5. Scrub DIDs exactly as the existing search endpoints do: profiles via
   `getAllDidsBetweenRequesterAndObjects` as in `GET /userProfile`; plans via
   the same hiding used by the plan search endpoints in `report-router.js`.
6. Return `{ data: [{ subjectType, subjectId, similarity, record }], embeddingSpecId, publicUrls? }`,
   where `record` is the scrubbed profile or plan and `publicUrls` comes from
   the plan DID hiding.

### Matching algorithm

`compare(vectorsA, vectorsB, matchingSpec) → { score, evidence }` and
`rank(sourceVectors, candidates, matchingSpec, { minSimilarity, limit })` in
`src/api/services/matching-engine.js` take no storage, model, or module
dependencies. With one vector per subject it reduces
to the dot product. With multiple chunks per subject it becomes:

1. All chunk-pair similarities.
2. Best match per chunk (one-to-one), dropping pairs under `minimumSimilarity`.
3. Score from strongest match, mean of top matches, and coverage.
4. Evidence = the matched chunk pairs and their similarities.

```json
{
  "algorithm": "match-v1",
  "minimumSimilarity": 0.78,
  "maxMatchesPerChunk": 1,
  "topMatchCount": 5,
  "weights": { "meanTopMatches": 0.5, "coverage": 0.3, "strongestMatch": 0.2 }
}
```

This object is the `matching` field of the embedding spec, because similarity
distributions differ by model. On the section 7 corpus, a 0.78 cut drops 64% of
unrelated pairs and keeps 96% of moderate and 99% of strong ones; the weights
are placeholders until multi-chunk subjects exist. Both need tuning against real
profiles (phase 0).

Group matching (`groupOnboardMatch`) calls the same engine. Members without a
vector are paired among themselves after all scored pairs are placed, which is
the explicit form of what the shared empty vector did by accident.

### Vector export for clients

```text
GET /api/partner/embeddingSpecs
  → { data: [{ ...spec, artifact: { baseUrl, fileSha256 } }], activeEmbeddingSpecId }
    baseUrl is huggingface.co at the pinned revision, or
    EMBEDDING_ARTIFACT_BASE_URL/<modelRepo>/<modelRevision>/ for a self-hosted copy

GET /api/partner/embeddings
  subjectType = profile | plan
  embeddingSpecId                               (default: the active spec)
  minLocLat, minLocLon, maxLocLat, maxLocLon   (optional)
  afterId                                       (paging: subjectIds sort as text, ascending)
  limit                                         (default and max 500)
  → { data: [{ subjectId, chunkIndex, contentHash, vector: <base64 float32-le> }], embeddingSpecId, hitLimit }
```

- Requires authentication, as the profile search does; carries no DIDs. The client joins vectors to the
  already-scrubbed records it gets from `/userProfile` or the plan endpoints.
- Size: 256 × 4 bytes = 1 KB per vector, ~1.37 KB base64. 5,000 profiles ≈ 7 MB.
  int8 quantization (÷4) is a later wire option once cross-runtime rank
  stability is measured.
- Clients store vectors in their SQLite (`@capacitor-community/sqlite` /
  `absurd-sql` in `crowd-funder-for-time-pwa`) keyed by
  `(subjectType, subjectId, embeddingSpecId)` with `contentHash`, and run the
  same `matching-engine.js` code (plain JS, shareable as a small package).
- A client never compares vectors whose `embeddingSpecId` differs.

This satisfies "embeddings on the device" with no model on the device. The
model is needed on-device only to embed text the server has not seen.

---

## 7. Evaluation Corpus

`test/embedding-eval/` (see its README) holds the corpus, the candidate specs,
and the evaluation runner (`npm run embedding:eval`).

- **Corpus** (`corpus.json`): the 26 test profiles (`generate-test-vectors.js`)
  plus profiles, projects, and short queries in 12 languages; 171 judged pairs
  across profile↔profile, profile↔project, project↔project, and query→subject,
  graded strong (2) / moderate (1) / unrelated (0).
- **Targeted tags:** hard negatives that share words but not meaning ("python
  programming" vs. a snake breeder, a family tree vs. tree planting), and a long
  profile whose key interest is in its last sentence, with a decoy that matches
  its opening.
- **Metrics:** anchored ordering accuracy (overall, cross-lingual,
  hard-negative, truncation), strong-vs-unrelated AUC, the best separating
  threshold, Spearman correlation, and per-grade mean similarity.
- **Runs through the production engine**, so the evaluation exercises the same
  preprocessing, pooling, and reduction code that ships.

The judgments are one person's; more raters, and profiles from real users (with
consent), would harden them before tuning thresholds for production.

---

## 8. Cross-Runtime Conformance

`test/embedding-eval/golden/<specId>.json` holds 27 fixed inputs (profiles,
plans with missing name or description, queries, 11 languages, emoji,
whitespace-collapse, single character, and an over-limit text) with their
content hashes and this server's vectors, generated by
`npm run embedding:golden`. The engine tests require cosine ≥ 0.9999 against it
on the server, which catches drift from dependency upgrades.

Any other runtime claiming the spec (onnxruntime-web in the PWA, native mobile
runtimes, a peer implementation) must reproduce:

- identical preprocessed inputs and content hashes,
- per-vector cosine to the golden vector ≥ 0.99 (initial tolerance, tighten
  after measuring onnxruntime-web), and
- identical top-5 ordering on the corpus in section 7.

A runtime that fails gets its own spec ID rather than a looser tolerance.

---

## 9. Implementation Checklist

### Phase 0 — Evaluate and pick the spec
- [x] Build the corpus and judgments (section 7).
- [x] Run candidates through transformers.js in Node; record metrics (section 3).
- [x] Choose model, variant, and dimensions; pin revision and file hashes.
- [x] Decide the fate of `empty_embedding_vector` (dropped in V7).
- [ ] Review the corpus judgments; revise any you disagree with and rerun.
- [ ] Before go-live: add real (consented) profiles and projects to the corpus; confirm the spec choice.

### Phase 1 — Engine
- [x] Add `@huggingface/transformers`; hash check of model files before use.
- [x] Spec registry (`embedding-specs.js`; `EMBEDDING_SPEC_ID` env with a default).
- [x] Engine (`embedding-engine.js`): preprocessing, template, one-text inference, pooling, Matryoshka reduction, normalization.
- [x] float32-LE BLOB ↔ `Float32Array` ↔ base64 helpers.
- [x] Golden file and unit tests (`test/controller-partner-8-embedding-engine.js`).
- [x] Model-fetch script (`npm run embedding:fetch-model`, `scripts/fetch-embedding-model.js`): fills `EMBEDDING_MODEL_DIR/<modelRepo>/<modelRevision>/`, verifies `fileSha256`, and embeds one text to prove the runtime works on the host.
- [x] Load by path when `EMBEDDING_ALLOW_REMOTE_MODELS=false` (section 3), verifying files before loading; tested with a read-only directory, a missing directory, and a tampered file.

### Phase 2 — Storage (ships with phase 5)
- [x] `V7__embedding.sqlite3` (create `embedding`; drop `user_profile_embedding` and `empty_embedding_vector`; clear `previousMatches`) + `sql-for-partner/README.md`.
- [x] `partner.db.service.js`: upsert, get-by-ids, delete-by-subject, list-hashes, paged export, counts; `endorser.db.service.js`: plan texts and plan IDs in a box (read-only).

### Phase 3 — Generation
- [x] Inline embed on every profile save; delete stale row on failure; delete on profile delete (`embedding.service.js`).
- [x] Sweep job for profiles and plans (backfill + retry), started from `src/index.ts`.
- [x] Log counts per sweep; expose sweep status to admins (`GET`/`POST /api/partner/embeddingSweep`).

### Phase 4 — Matching API
- [x] `matching-engine.js` (storage- and model-free `compare` and `rank`).
- [x] `GET /api/partner/similar` with bbox, visibility scrubbing, registration and a per-user limit on `text:`.
- [x] Tests covering all four directions plus text, bbox on both profile points, hidden DIDs (`test/controller-partner-9-similar.js`).

### Phase 5 — Cut over group matching and retire OpenAI (ships with phase 2)
- [x] `groupOnboardMatch` reads `embedding`; members without vectors paired last, with a null similarity.
- [x] Group-matching tests use engine vectors (`test/embedding-eval/test-vectors.json`), with bounds anchored to the spec's measured cuts.
- [x] Remove the `generateEmbedding` endpoint/field; rework the metadata endpoint.
- [x] Delete `embeddings.service.js`, `embedding-empty-string.js`, and `OPENAI_API_KEY` (nothing else used it).
- [x] Remove `test/embeddings.json` and `test/embedding-empty-string.json`; move the generator and visualizer to `test/embedding-eval/` (`npm run embedding:test-vectors`, `npm run embedding:visualize`, `--corpus` for the whole corpus).
- [x] CHANGELOG entries, including the manual deploy steps.

### Release — deploy the model with phases 2–5
- [x] `Dockerfile`: `node:22.4-bookworm-slim` (glibc) instead of `node:22.4-alpine3.19`, since `onnxruntime-node` ships only glibc Linux binaries.
- [ ] Build the image; confirm `npm ci` (native `sqlite3`, `sharp`), `npm run compile`, and `npm run embedding:fetch-model` succeed in it.
- [ ] Model volume on each host (`~/endorser-ch-models`, ~320 MB per spec), filled with the fetch script (command in README and CHANGELOG). A volume instead of baking into the image, because the image is built `--no-cache` from a git clone and would download 313 MB on every release.
- [x] README: model step, partner-DB backup and Flyway run, and `-v ~/endorser-ch-models:/mnt/models:ro -e EMBEDDING_MODEL_DIR=/mnt/models -e EMBEDDING_ALLOW_REMOTE_MODELS=false` in the run command.
- [x] Retire `scripts/deploy.sh` (unused).
- [x] Missing or hash-mismatched model files: the server starts and serves everything else, profile saves succeed without a vector, and the failure is logged at error level and shown in the admin sweep status.
- [ ] Test server first, with a copy of production data: RSS with the model loaded (confirm host RAM headroom), duration of the first sweep backfill, and p99 event-loop delay and API latency during the sweep (decides the `worker_threads` question in section 5).
- [x] Rollback plan, in the CHANGELOG: previous image **plus** restore of the pre-V7 partner DB backup, because the previous code reads `user_profile_embedding`, which V7 drops.
- [ ] Production deploy; confirm the startup sweep has finished (`GET /api/partner/embeddingSweep`) and the vector counts match the counts of non-empty profiles and plans.

### Phase 6 — Client availability
- [x] `GET /embeddingSpecs` advertises the artifact: Hugging Face at `modelRevision` by default, or `EMBEDDING_ARTIFACT_BASE_URL` for a self-hosted copy.
- [ ] Decide whether to self-host the artifact rather than depend on Hugging Face (steps in README, "Hosting the Embedding Model Yourself").
- [x] `GET /embeddingSpecs` and `GET /embeddings` with tests.
- [ ] In `crowd-funder-for-time-pwa`: vector cache in client SQLite, shared `matching-engine.js`, a "similar nearby" view.

### Phase 7 — On-device embedding (optional download)
- [ ] PWA: embed with onnxruntime-web from the pinned artifact; pass conformance.
- [ ] Native builds: evaluate native ONNX Runtime Mobile against conformance; separate spec IDs for any that fail.

---

## 10. Future Work

### Peer-to-peer matching

Each device computes its own vectors and sends them to trusted peers; a peer
compares them with its own subjects, and possibly with neighbors' subjects it is
authorized to represent, and returns scores or evidence.

```text
Alice ──(vectors + embeddingSpecId + preferred matchingSpec)──▶ Bob
Bob ──compare to own profile / authorized neighbors──▶ scores, evidence ──▶ Alice
```

- **Every vector message names its spec.** Peers never compare across specs; an
  unsupported spec gets `{ "status": "unsupported-embedding-spec", "supported": [...] }`.
- **Model must match; algorithm need not.** Bob may run the requested matching
  spec, run his own and name it, or return raw pair similarities so Alice
  aggregates with her own policy (the most interoperable option).
- **Ranks instead of vectors from neighbors.** A forwarding node returns
  "Carol: 0.82" without disclosing Carol's vectors, so disclosure rules evolve
  independently of the embedding protocol.
- **Authorization covers vectors like text:** who may receive them, forward
  them, cache them and for how long, and whether they may be retained or only
  used to answer one query. Embeddings are sensitive derived data, open to
  inversion and attribute-inference attacks; being numeric does not make them
  anonymous.
- **Payload:** ~1 KB per 256-dim float32 vector; float16 or int8 only after
  conformance shows unchanged rankings.
- **Incremental sync:** a change cursor and tombstones on `GET /embeddings`, so
  devices sync deltas instead of re-fetching a bounding box.

### Spec upgrades

Add a spec rather than replace one: vectors for spec A and B coexist per
subject (the primary key allows it), the sweep fills B, peers and clients
advertise both, B becomes preferred once most participants speak it, and A
retires. Offline peers stay usable throughout.

### Atomic interests

Split profiles into separate interest statements (UI-authored, or automatic
sentence splitting evaluated against whole-text vectors), each a chunk with its
own vector and optional importance weight. `MatchingEngine` already handles
multi-chunk subjects; the evidence list then explains *which* interests matched.

### Richer interest records and complementary matching

Structured fields next to the embedded text — activity level, "looking for"
(collaboration, learning, help), offers vs. needs. Similarity is not always the
wanted relation: surplus-vegetable grower ↔ community pantry, Android developer ↔
project needing an app. Modes (similarity, need↔offer, mentor↔learner,
project↔skill) use distinct prompts, structured fields, or rerankers, not a
single overloaded vector. Plans already carry offers and gives (`offer_claim`,
`give_claim`), a natural source for need/offer signals.

### Hybrid lexical + semantic scoring

Boost exact shared terms ("Kotlin" = "Kotlin") that embeddings blur: combine
vector similarity with phrase/tag overlap, category overlap, importance, and
breadth. The existing `claimContents` text search is the lexical half.

### Candidate generation + reranking

Vectors narrow a large population to a few hundred candidates; a reranker
(deterministic scoring, cross-encoder, larger embedder, or LLM) orders the top
10–30 using breadth, intent, location, and availability. The P2P-compatible
vectors stay the candidate layer.

### Approximate nearest-neighbor indexes

When in-memory scans become slow: a SQLite vector extension, pgvector, or a
dedicated store — as an accelerator only, never part of the protocol. Devices
holding many authorized subjects can keep the same local index, giving a
continuum of server ↔ community node ↔ personal device that all answer the same
vector query.

### Explanations

An LLM turns stored evidence ("growing vegetables" ↔ "urban gardening", 0.91)
into prose. It explains a match; it does not produce one, so rankings stay
deterministic and auditable.

### Personalized ranking

Users choose weights (breadth vs. strongest passion vs. recent activity) over
the same shared vectors, which works because the embedding protocol and the
matching policy are separate layers.

---

## Sources

- Granite-Embedding-311M-Multilingual-R2 (Apache-2.0, 768 dims with Matryoshka reduction, 200+ languages): https://huggingface.co/ibm-granite/granite-embedding-311m-multilingual-r2 ; ONNX: https://huggingface.co/onnx-community/granite-embedding-311m-multilingual-r2-ONNX
- Granite-Embedding-97M-Multilingual-R2: https://huggingface.co/ibm-granite/granite-embedding-97m-multilingual-r2 ; ONNX: https://huggingface.co/onnx-community/granite-embedding-97m-multilingual-r2-ONNX
- Transformers.js: https://huggingface.co/docs/transformers.js
- EmbeddingGemma-300M (license `gemma`, gated): https://huggingface.co/google/embeddinggemma-300m ; ONNX: https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX
- Gemma Terms of Use: https://ai.google.dev/gemma/terms
- Other evaluated models: https://huggingface.co/intfloat/multilingual-e5-small , https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 , https://huggingface.co/Snowflake/snowflake-arctic-embed-m-v2.0 , https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2

---

## Rejected

- **OpenAI (or any hosted API) as the network spec** — clients cannot reproduce
  the vectors and every profile goes to a third party (constraint 2).
- **Full-precision server "reference" vectors** — no client runs the fp32 model,
  so the reference would disagree with every client; see section 3.
- **Plan vectors in the main DB** — would put partner work into the claim path
  (constraint 4).
- **Vectors keyed by `issuerDid`** — exports would leak DIDs.
- **Comma-separated text storage** — 18× larger and needs parsing.
- **A SQLite vector extension's format as the storage format** — ties the
  protocol to an accelerator.
- **EmbeddingGemma-300M** — license terms Google can change and enforce
  unilaterally, and that pass through to redistributors; see section 3.
- **English-only models (all-MiniLM-L6-v2)** — non-English users are expected;
  cross-lingual ordering accuracy 0.605.
- **Batched inference** — changes quantized-model vectors; see section 5.
- **Several active network specs at once** — fragments the network; multiple
  specs exist only for evaluation and migration.

## History

- The first draft of this plan assumed atomic, ULID-keyed interest records and a
  Python server. The codebase stores one free-form description per profile and
  runs on Node, so the plan uses whole-text vectors with a `chunkIndex` for later
  splitting, and transformers.js so server and browser share one ONNX artifact.
  Its P2P and "other futures" sections are condensed into section 10.
- 2026-09-29: the first model recommendation (EmbeddingGemma-300M) was replaced
  after reading its license; the evaluation in section 3 selected Granite 311M R2.
  The OpenAI-era tables are dropped outright rather than migrated because no
  deployment uses them.
