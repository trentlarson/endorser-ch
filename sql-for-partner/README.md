
Update this file with any changes to the schema.

This file exists to explain data because sometimes the comments inside the
.sqlite3 files need subsequent clarification or get outdated (and they can't
be edited after flyway has run).

```sql
CREATE TABLE partner_link (
    handleId TEXT NOT NULL, -- currently handleId because we don't support updates to events
    linkCode VARCHAR(32) NOT NULL, -- eg. 'NOSTR-EVENT-TRUSTROOTS', 'ATTEST.SH'
    createdAt DATETIME NOT NULL,
    externalId VARCHAR(256),
    data TEXT -- JSON data, where format depends on linkCode
);
```
