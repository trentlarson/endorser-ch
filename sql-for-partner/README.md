DB Schema Documentation for Endorser

This file exists to explain data because sometimes the comments inside the
.sqlite3 files need subsequent clarification or get outdated (and they can't
be edited after flyway has run).

The tables follow the snake-case convention (with underscores) while the
columns follow camelCase (with capital letters after the first word).
(We apologize for the inconsistency! Maybe we'll fix it in the future.)

```sql

CREATE TABLE group_onboard (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  issuerDid TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  projectLink TEXT,
  previousMatches TEXT, -- JSON of most recent matching results, null if none yet
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiresAt DATETIME NOT NULL
); 
CREATE INDEX group_onboard_issuerDid ON group_onboard(issuerDid);

CREATE TABLE group_onboard_member (
  issuerDid TEXT NOT NULL,
  groupId INTEGER NOT NULL,
  admitted BOOLEAN DEFAULT FALSE,
  content TEXT NOT NULL, -- encrypted data about the person
  FOREIGN KEY (groupId) REFERENCES group_onboard(rowid)
); 
CREATE INDEX group_onboard_member_issuerDid ON group_onboard_member(issuerDid);
CREATE INDEX group_onboard_member_groupId ON group_onboard_member(groupId);

-- partners are other systems with whom this system collaborates
CREATE TABLE partner_link (
    handleId TEXT NOT NULL, -- currently handleId because we don't support updates to events
    linkCode VARCHAR(32) NOT NULL, -- eg. 'NOSTR-EVENT-TRUSTROOTS', 'ATTEST.SH'
    createdAt DATETIME NOT NULL,
    externalId VARCHAR(256),
    data TEXT -- JSON data, where format depends on linkCode
    pubKeyHex TEXT, -- public key, eg. used in relayed nostr event
    pubKeyImage TEXT, -- content that is signed
    pubKeySigHex TEXT -- signature of pubKeyPayload
);

-- a profile is a user's free-form description of their interests
CREATE TABLE user_profile (
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    issuerDid TEXT UNIQUE NOT NULL,
    updatedAt DATETIME NOT NULL,

    -- may be '', ie. if admin triggered creation via generateEmbedding
    description TEXT NOT NULL,

    locLat DOUBLE,
    locLon DOUBLE,
    locLat2 DOUBLE,
    locLon2 DOUBLE
);
CREATE INDEX profile_issuerDid ON user_profile(issuerDid);
CREATE INDEX profile_lat_lon ON user_profile(locLat, locLon);
CREATE INDEX profile_lat2_lon2 ON user_profile(locLat2, locLon2);

-- embeddings for semantic profile matching (OpenAI text-embedding-3-small).
-- generateEmbedding: admin flag to always generate embedding when profile is edited.
CREATE TABLE user_profile_embedding (
    issuerDid TEXT PRIMARY KEY,
    embeddingVector TEXT NOT NULL,  -- comma-separated vector values
    isForEmptyString INTEGER NOT NULL,
    updatedAt DATETIME NOT NULL,
    generateEmbedding BOOLEAN DEFAULT 1,
    FOREIGN KEY (issuerDid) REFERENCES user_profile(issuerDid)
);
```
