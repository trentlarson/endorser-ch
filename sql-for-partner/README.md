DB Schema Documentation for Endorser

This file exists to explain data because sometimes the comments inside the
.sqlite3 files need subsequent clarification or get outdated (and they can't
be edited after flyway has run).

The tables follow the snake-case convention (with underscores) while the
columns follow camelCase (with capital letters after the first word).
(We apologize for the inconsistency! Maybe we'll fix it in the future.)

```sql

-- partners are other systems with whom this system collaborates
CREATE TABLE partner_link (
    handleId TEXT NOT NULL, -- currently handleId because we don't support updates to events
    linkCode VARCHAR(32) NOT NULL, -- eg. 'NOSTR-EVENT-TRUSTROOTS', 'ATTEST.SH'
    createdAt DATETIME NOT NULL,
    externalId VARCHAR(256),
    data TEXT -- JSON data, where format depends on linkCode
    pubKeyHex TEXT, -- public key, eg. used in relayed nostr event
    pubKeyImage TEXT, -- content that is signed
    pubKeySigHex TEXT, -- signature of pubKeyPayload
);

-- a profile is a user's free-form description of their interests
CREATE TABLE user_profile (
    rowid INTEGER PRIMARY KEY AUTOINCREMENT, -- works like the built-in rowid, explicitly
    issuerDid TEXT NOT NULL,
    updatedAt DATETIME NOT NULL,
    description TEXT NOT NULL,
    locLat DOUBLE NOT NULL,
    locLon DOUBLE NOT NULL,
    locLat2 DOUBLE NOT NULL,
    locLon2 DOUBLE NOT NULL
);
CREATE INDEX profile_issuerDid ON profile(issuerDid);
CREATE INDEX profile_lat_lon ON profile(locLat, locLon);
CREATE INDEX profile_lat2_lon2 ON profile(locLat2, locLon2);
```
