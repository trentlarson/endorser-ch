# Accurate Alert Cursors

How clients ask "what changed since I last looked" without missing or repeating
items, across endorser-ch, notification-wakeup-service, and
crowd-funder-for-time-pwa.

## 1. Problem

A cursor is safe only if nothing with a lower value can be saved after a client
has seen that value. Neither field the APIs filter on guarantees that:

- **ULIDs** (`jwt.id`, `plan_claim.jwtId`) are created in `claim.service.js`
  before several awaited lookups and the inserts, so one claim can take an
  earlier ULID and be saved after another. A client that advances its cursor
  between the two saves never sees the first.
- **Dates** (`user_profile.updatedAt`, `embedding.updatedAt`) have one-second
  resolution, so a client whose cursor is a second in which only some rows have
  been saved never sees the rest. The embedding sweep saves dozens per second.
- **Client-computed cursors**: the APIs return rows but no cursor, so each
  client takes the highest value it saw, which is exactly the unsafe value
  above.

## 2. Design

### Change sequence

Each DB has one counter (`change_counter`, a single row). Triggers stamp each
inserted or changed row of a tracked table with the next counter value, in the
column `changeSeq`. A trigger runs inside the statement that writes the row, so
the number is assigned and saved atomically, and every writer is covered (the
server, Flyway, `sql-by-hand` scripts, a person at the `sqlite3` prompt).

SQLite allows one write transaction at a time, so counter order is save order.
A reader that reads the counter first and then filters lists with
`changeSeq <= counter` sees exactly the rows saved up to that counter: rows
saved later carry higher numbers and fall into the next window.

Tracked tables and the changes that stamp them:

| DB | Table | Stamped on | Read by |
|---|---|---|---|
| main | `jwt` | insert | `claims`, `personalPlanContributions`, `trackedPlanClaims` |
| main | `plan_claim` | insert; update of `jwtId` (an edit) | `trackedPlanUpdates`, `plansNearby` |
| main | `embedding` | insert; update with a different `contentHash` | partner `plansSimilar` |
| partner | `user_profile` | insert; update of description or a location | `profilesNearby` |
| partner | `embedding` | insert; update with a different `contentHash` | `profilesSimilar` |

A list that joins tables uses the `changeSeq` of the row that is the event: the
`jwt` row for contributions, not the plan it points to. A change only to the
joined row does not bring earlier events back.

Saving a profile or a vector with unchanged content does not stamp it, so it
does not alert anyone again.

### Cursor

A cursor is a position between changes: the value `p` sits right after the
change numbered `p`. It is an opaque string; clients store it as text and
never parse it. The same value works in either direction: changes after it
(`changeSeq > p`) or before it (`changeSeq <= p`).

- Endorser: a position in the main DB's changes, eg. `"48213"`.
- Partner: `"<partner position>-<main position>"`, eg. `"912-48213"`, because
  `plansSimilar` reads plan vectors from the main DB. When the partner service
  is split off, it keeps both parts: it reads plan vectors from the main
  service's API, filtered by the main part.

A later format is told apart by a character that cannot appear in these (any
character other than digits and `-`).

### API

Both `GET`/`POST /api/v2/report/alertSearch` and `/api/partner/alertSearch`:

**Request**

- `afterCursor` (optional): rows changed after this cursor, oldest change
  first ("cursor path"). For "what changed since I last looked".
- `beforeCursor` (optional): rows changed before this cursor (and after
  `afterCursor`, if given), newest change first. For scrolling back through
  more than one page.
- With either cursor, `afterId`, `beforeId`, `afterDate`, and `beforeDate` are
  ignored (with a `userMessage`). A malformed cursor is a 400.
- With neither, `afterId`/`beforeId`/`afterDate`/`beforeDate` select rows as
  they always have ("ID path"). A request with none of them returns the most
  recent rows.

**Response** (both paths), beside `data`:

- `nextAfterCursor`: send as `afterCursor` to get what changed after this
  response.
- `nextBeforeCursor`: send as `beforeCursor` to scroll back past this
  response.
- `hasMore`: `true` when a list was cut at its limit; call again in the same
  direction (`afterCursor = nextAfterCursor`, or
  `beforeCursor = nextBeforeCursor`) until it is `false`.
- Each row of `claims`, `personalPlanContributions`, `trackedPlanUpdates`,
  `trackedPlanClaims`, `plansNearby`, and `profilesNearby` has `changeSeq`.

**Cursor path windows**

1. Read the counter(s).
2. The window is `after < changeSeq <= upTo`: `after` is `afterCursor` (or 0),
   and `upTo` is the counter, or `beforeCursor` when it is lower.
3. Each list: rows inside the window, at most 50; ascending by `changeSeq`, or
   descending with `beforeCursor`.
4. If any list returned 50, every list is trimmed to the one that reaches least
   far (the lowest last row ascending, the highest last row descending), and
   `hasMore` is `true`.
5. Forward: `nextAfterCursor` is the last change the page covers;
   `nextBeforeCursor` is `afterCursor`, so scrolling back from the page starts
   where it began. Backward: `nextBeforeCursor` sits just below the oldest
   change the page covers (`after` when nothing is left); `nextAfterCursor` is
   the page's `upTo`.

Each forward page is complete up to its `nextAfterCursor`, so a client may
store it after any page. Paging backward from the latest change returns
exactly the rows paging forward from 0 does, in reverse. Nothing is skipped and
nothing repeats.

`profilesSimilar` and `plansSimilar` are ranked by similarity, not paged: each
holds the best 50 matches among vectors stamped inside the page's window
(partner part for profiles, main part for plans). Matches past 50 in one window
are dropped. Plan matches are not tied to the profile pages, so a backward
scroll returns them on its first page only: its `nextBeforeCursor` moves the
main part to its lower bound. Without cursors, the similar lists hold the best
50 matches overall, so a client's first run (or its handoff run) gets its best
matches once.

If `afterCursor` is above the current counter (a DB restored from backup, or
a cursor from another server), the lists are empty, both returned cursors are
the current counter, and `userMessage` says the cursor was reset. A
`beforeCursor` above the counter is treated as the counter.

**ID path**: lists keep their filters and newest-first order. Both returned
cursors are the counter read before the lists, so a client can move to the
cursor path from any ID-path response (`afterCursor` for what comes next,
`beforeCursor` to scroll back by change); rows saved during the request may
come again on the next call. `hasMore` is `true` when a list hit its limit; the
client pages with `beforeId`/`beforeDate` as before, and takes
`nextAfterCursor` from the first page.

### Clients

- **notification-wakeup-service** stores one cursor per server per channel
  (`endorser_after_cursor`, `partner_after_cursor` in both cursor tables).
  When a cursor is empty, it makes one ID-path run from the stored
  `endorser_after_id` / `partner_after_at` (none on a first run) and stores
  that run's `nextAfterCursor`. Afterwards it sends `afterCursor`, looping while
  `hasMore` (up to its page limit; the rest comes on the next run), and stores
  the last `nextAfterCursor` after a run that succeeds or finds nothing. It
  keeps the cursor when a list timed out ("Some data was not available" in
  `userMessage`), and treats a response without `nextAfterCursor` to an
  `afterCursor` request as an error, since only a server that ignores
  `afterCursor` sends one. It does not scroll back.
- **crowd-funder-for-time-pwa**
  - Its `alertSearch` types carry `afterCursor`, `beforeCursor`,
    `nextAfterCursor`, `nextBeforeCursor`, `hasMore`, and `changeSeq`, all
    optional.
  - Its client for `alertSearch`, when built, stores one cursor per server in
    two nullable TEXT columns of `settings` (one migration adding them).
  - `lastAckedOfferToUserJwtId`, `lastAckedOfferToUserProjectsJwtId`, and
    `lastAckedStarredPlanChangesJwtId` are per-item bookmarks ("mark unread
    from here") for `/report/offers`, `/offersToPlansOwnedByMe`, and
    `/plansLastUpdatedBetween`, and stay ULIDs while those endpoints serve them.
  - The native fetchers (`TimeSafariNativeFetcher.java` / `.swift`) keep their
    own `plansLastUpdatedBetween` cursor outside the app DB.

## 3. Rollout

1. **endorser-ch**: main migration V22 and partner migration V9 (counter,
   columns, backfill in `jwtId` / `updatedAt` order, triggers, indexes); the
   cursor path (both directions) and the returned cursors on both endpoints. All additive:
   deployed clients keep working.
2. **notification-wakeup-service**: cursor columns (added on startup when
   missing), the one-time ID-path handoff, the cursor-path loop. Its max-ID
   cursors and before-ID paging remain only for the handoff and for a server
   without `nextAfterCursor`.
3. **crowd-funder-for-time-pwa**: types only.
4. **crowd-funder-for-time-pwa**, with its `alertSearch` client: the two
   `settings` columns.

Steps 1–3 need no coordination with app releases; step 4 ships with the app
feature that uses it.

V21 and V22 together took 7 seconds on a copy of a database inflated to 543,000
`jwt` rows (1 GB), numbering every row.

## 4. Next Improvements

Each is a session of one or two prompts with this plan as background. Some wait
on a condition in production first.

- **Native fetchers on the cursor path**: both fetchers make one
  `plansLastUpdatedBetween` request a day and store the newest `jwtId` it
  returns, which keeps the ULID race and drops changes past its 50-row limit.
  Sending `afterCursor` with `planHandleIds` to `alertSearch` and reading
  `trackedPlanUpdates` removes both. Ships with an app release.
- **Similar lists past 50**: page by similarity within a fixed window. Worth
  doing only when 50 per window proves too few.
- **Retire the ID path** on `alertSearch` (`afterId`, `beforeId`, `afterDate`,
  `beforeDate`). The deployed notification-wakeup-service pages profiles with
  `afterDate` / `beforeDate`, and its handoff to cursors sends its stored
  `partner_after_at` as `afterDate`, so this waits until its cursor-path
  version is deployed and every row of both cursor tables has
  `endorser_after_cursor` and `partner_after_cursor`.
- **Drop** notification-wakeup-service's `endorser_after_id` and
  `partner_after_at` columns, its max-ID cursors, and its before-ID paging. Same
  condition as retiring the ID path, plus every server it calls returning
  `nextAfterCursor`.
- **Offers and starred-plan changes on the cursor path**: move the app's "New
  Activity" screen to `alertSearch` with `changeSeq` bookmarks, then retire the
  ID-path endpoints and the `lastAcked*JwtId` settings. The largest of these:
  it spans the server, the app's screens and settings, and an app release; the
  endpoints and settings can go only once no app version in use calls them.
  Decide first which shape the screen reads:
  - **Offer summaries** (amounts, fulfilment), as `/report/offers` and
    `/offersToPlansOwnedByMe` return: `alertSearch` gains lists for them, and
    `offer_claim` is stamped with `changeSeq`.
  - **Claim rows**, as `claims` and `personalPlanContributions` already return
    offers and gives: no server change, and the screen derives what it shows
    from the claims.

  Starred-plan changes need the claim before each change (`wrappedClaimBefore`
  in `/plansLastUpdatedBetween`) for the screen's comparison; `alertSearch`'s
  `trackedPlanUpdates` holds only the current plan.

## 5. Future Improvements

- **Read transactions**: with more than one connection per DB (eg. WAL with a
  connection pool), read the counter and the lists in one read transaction.
- **Postgres**: a plain sequence is not save-ordered. Either port the counter
  row (writers queue on its lock) or stamp rows with `pg_current_xact_id()` and
  use `pg_snapshot_xmin(pg_current_snapshot())` as the cursor (no write
  bottleneck; a long transaction delays the cursor but never loses rows). The
  cursor's format change marks the switch.

## Rejected

- **Time cutoffs with a lag** (return only rows older than now minus a few
  seconds): exact for profiles and vectors on a single connection, but claims
  need a lag longer than the slowest gap between creating a ULID and saving the
  rows, and they depend on the clock never stepping back.
- **A counter per table**: each table would need its own cursor; one counter
  per DB puts all lists on one number line.
- **A `change_log` side table instead of columns**: every list query gains a
  join and paging pages the log.
- **A version prefix in the cursor (`v1:`)**: a later format is distinguishable
  without one.
- **Bare `after` / `nextAfter` names**: easy to confuse with the ULID
  `afterId` / `beforeId`; the `Cursor` suffix names the kind of value.
- **Inclusive date bounds with client de-duplication**: pushes bookkeeping into
  every client and misses rows saved later than the overlap.

## History

- 2026-10-13: written after `alertSearch` gained similarity matches, whose
  vectors are saved by the sweep at many per second.
- 2026-10-13: notification-wakeup-service labels a 400 as an authorization
  failure only when its error says so; the native fetchers store the newest
  `jwtId` of a response instead of the last item, which was the oldest.
