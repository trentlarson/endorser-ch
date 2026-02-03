# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [4.3.1]
### Added
- Generation of vector embeddings for user profiles, with generateEmbedding flag to mark profiles that should generate them
- Generate 1-on-1 matches of people during meetings
### Changed in DB or environment
- Automated endorser partner SQL script 6
- ADMIN_DIDS & OPENAI_API_KEY

## [4.3.0]
### Added
- `/api/partner/userProfileNearestNeighbors/:rowId` endpoint to find nearest connection in registration tree to a user profile
- `nearestNeighborsTo` method in network-cache service to calculate nearest common ancestor in registration tree
- Registration tree path tracking: `pathToRoot` column in registration table stores JSON array of DIDs from agent to root
### Changed in DB or environment
- Automated endorser SQL scripts 17 & 18 & 19
- Run `node sql-by-hand/V19.1__populate_pathToRoot.js` to populate pathToRoot for existing registrations


## [4.2.11] - 2025.10.05
### Added
- "/plans" endpoint allows arrays of planHandleIds
- Visibility-setting endpoints into '/api/claims' prefix (because it makes more sense)
### Fixed
- Result for "between" endpoints should return a claim object (not string)
- Save the JWT for all calls that explicitly set visibility
### Changed
- Updated some libraries to avoid critical issues detected by Dependabot


## [4.2.10] - 2025.08.29
### Added
- /plansLastUpdatedBetween endpoints to see changes to plans
- Automated endorser SQL scripts 15 & 16


## [4.2.9] - 2025.05.12
### Added
- Can add a project link for an onboarding meeting


## [4.2.8] - 2025.04.24
### Fixed
- Invite generation failed due to bad date format


## [4.2.7] - 2025.04.14
### Added
- Ability to create invite without sending invite JWT to the server
### Changed
- Misc variable names for clarity


## [4.2.5] - 2025.02.21
### Changed
- /giftedTotals & /giveTotals endpoints now return amountConfirmed.


## [4.2.4] - 2025.02.06
### Added
- Group onboarding in a meeting (a partner function)
### Changed in DB or environment
- Automated partner SQL script 4


## [4.2.3] - 2025.01.26
### Changed
- "description" and "fulfills" fields in the Offer schema


## [4.2.1] - 2025.01.21
### Added
- User profile endpoints
### Changed in DB or environment
- Automated partner SQL script 3


## [4.1.4] - 2024.12.31 - 1452cd7adb724d67cb0b16c62a8ead9942b65b91
### Added
- planCountsByBBox endpoint for counts of plans in a region
### Changed
- Order by descending created-date when retrieving invites.
### Fixed
- Revealed too much when user's DID was in any of a list of results inside ".data"
- Bad check for previously-submitted partner links
### Changed in DB or environment
- Automated endorser SQL script 15


## [4.1.3] - 2024.11.05 - be51bc505650eaa5b1b43d47b609d5d880ac72d3
### Fixed
- Some swagger docs


## [4.1.2] - 2024.11.05 - 9aecfb2b0798ac5678ebf642211fa96e5a06b296
### Added
- Endpoint for the recent offers to a user's projects
- Limit on invites when created
### Changed
- Allow full registrations in first month.


## [4.1.1] - 2024.10.09 - 12a9c3c8129087f598caac0bafb539e482b96dd4
### Added
- Invite for a contact to join immediately
### Changed
- Nostr endpoints verify signature based on the public key.
### Changed in DB or environment
- Automated endorser SQL script 14
- Automated partner SQL script 2


## [4.1.0] - 2024.09.30 - c950b8723489afc78bbbf45ccc6fa4b5d6f60d9b
### Added
- Link to partner systems: Trustroots & TripHopping via nostr
- Providers added by lastClaimId, with lookup for confirmation flag, and test for plan as provider
### Changed
- Added a date to the network table.
- Added an Authorization header to the contact utilities functions
### Fixed
- In the give_claim table, fix the agentDid and the amounts that should be null
### Changed in DB or environment
- Automated endorser SQL script 13 & partner SQL script 1
- NOSTR_PRIVATE_KEY_NSEC into the .env file
- For "partner" domains: DNS, haproxy, certificate


## [4.0.2] - 2024.09.08 - 4a20c7c66ed974549ae16f0cb69b3b4d1ac188e0
### Changed
- Merkle tree is now recreated to include nonces.
### Fixed
- Hidden error on confirmations for action & orgRole & tenure
### Changed in DB or environment
- Automated SQL script 12
- Manual node script 12.1 - which will change our published merkle roots


## [3.6.4] - 2024.08.25 - f05a786c11ae4d76fecc914155514efe40db9a5f
### Changed
- Make handle ID parameters more consistent in the reports.


## [3.6.3] - 2024.08.02 - 18496f1bdf4faa0afa7f2e4a824c851e40b57f0f
### Added
- Update of Offer claims
- Checks for issuer & data in a did:peer JWANT
### Changed
- Consolidate DID crypto facilities into "vc" directory.
### Removed
- App dependency on Infura and the ethr-did-resolver (now only in tests)


## [3.6.2] - 2024.07.07 - 7fb49766ffd739886d7cc28871cfc3914870fd9d
### Added
- Acceptance of JWANT tokens for did:peer DIDs created with passkeys.
### Fixed
- Hidden DIDs in claims that the user issued
- Hidden DIDs in claims that include the user
### Changed in DB or environment
- Automated SQL script 11



## [3.5.4] - 2024.05.04 - d59075cc2b84ed2b2eb682152de4263528c1695f
### Fixed
- Vulnerability exposing search result to people without visibility of that DID
### Changed in DB or environment
- Nothing



## [3.5.3] - 2024.05.03 - e4ddcf7cc8340192413282ecc406f585efb4d1d8
### Fixed
- Problem updating project location
- Test timeouts when waiting longer for Infura
### Changed in DB
- Nothing



## [3.5.2] - 2024.02.15 - 5a541f2e7e1f48fea62f21ae96df3c8ad9300c78
### Changed
- Limits, from 10 registrations per month to 31 and from 100 claims per week to 140
### Fixed
- Problem updating with lastClaimId as agent
### Changed in DB
- Nothing



## [3.5.1] - 2024.01.09
### BEWARE
- You must run the DB migration.
- You must run the sql-by-hand 10.1 migration.
### Added
- giftNotTrade flag
- Allow arrays in GiveAction 'fulfills' and 'object' fields



## [3.4.4] - 2023.12.17

### Added
- Text search in names

### Fixed
- Search including locations



## [3.4.3] - 2023.11.19 - 0a1bc81598912961cbb35660ea658aa620487a80

### Added
- Better error if an ID field is used inappropriately



## [3.4.2] - 2023.10.26 - 0cd3cb0c5b57db188854c8fb69432002e262210c

### Added
- Ability to link a PlanAction that fulfills another PlanAction
- Field lastClaimId as preferred way to link claims (over handleId)



## [3.3.0] - 2023-07-09 - f9834e5c2fc396d6a712a0aef0be1322f7a2ea8b

### Added
- Endpoint for the 'give' records which have a particular provider





## [3.2.0] - 2023-07-02 - 7ea354c3e3f19fbfea0070d05ea53a57f3edf93e

### Added
- Storage and endpoint for physical location of a plan/project





## [3.1.0] - 2023-05-19 - a021cb9906f85a61f782d67b38ca321b4b4a25e3

### Changed
- Incompatible change: there is a hash for each entry is now based on a nonce. This requires a DB migration.
- There is a hash for each entry based on a nonce.

### Added
- Ability to register one person a day starting the day after registration.





## [2.1.0] - 2023-05-14 - b495e02bf97bcca95f78c847ff18ae9ad3fb3620

### Added
- Providers in GiveActions
- Plan & project URLs




## [2.0.0] - 2023-04-26 - d65ca268d16d437b622b1d527cd5f9bf7e8fed7a

### Added
- Search for contacts in common from a pool of confirmers of server-hosted claims.

### Removed
- The common-contact endpoints (introduced in 1.9.0) have radically changed.




## [1.9.0] - 2023-04-07 - a18f33307ac5e333f003a0bd6959388650f22b82

### Added
- Search for contacts in common from all contacts




## [1.6.0] - 2023-03-13 - f82be76be3e53df491dd9030351a30e42466f8ee

### Added
- Offer & Give storage, with endpoints for totals and queries
- Plan storage & endpoints
- Persistent references with `handleId`
- Docker setup




## [1.1.35] - 2022-12-30 - 486687d6d1aaea9aa5354291eaac5b8e17524783

### Added
- Authentication header with Bearer JWT




## [1.1.31] - 2022-11-03

### Added
- Limit on number of claims
- Limit on registration by DIDs

### Fixed
- Accurate JWT validation
- Swagger API docs page
