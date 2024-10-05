
DB Schema Documentation for Endorser

This file exists to explain data because sometimes the comments inside the
.sqlite3 files need subsequent clarification or get outdated (and they can't
be edited after flyway has run).

The tables follow the snake-case convention (with underscores) while the
columns follow camelCase (with capital letters after the first word).
(We apologize for the inconsistency! Maybe we'll fix it in the future.)

```sql
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
```
