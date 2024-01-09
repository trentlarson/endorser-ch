# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).




## [Unreleased]



## [3.5.0] - 2024.01.09
### BEWARE
- You must run the DB migration.
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
