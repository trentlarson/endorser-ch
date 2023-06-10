
I'm using this file to explain data because sometimes the comments inside the
.sqlite3 files need clarification or get outdated (and I can't edit them after
flyway has run).

```
CREATE TABLE action_claim (
    jwtId CHARACTER(26),
    issuerDid VARCHAR(100),
    agentDid VARCHAR(100), -- DID of the acting entity (in subject & claim); did:ethr are 52 chars
    eventRowId BIGINT,
    eventOrgName VARCHAR(120),
    eventName VARCHAR(250),
    eventStartTime DATETIME
);

CREATE TABLE confirmation (
    jwtId CHARACTER(26),
    issuer CHARACTER(100), -- DID of the confirming entity; did:ethr are 52 chars
    origClaim TEXT,
    origClaimCanonHashBase64 VARCHAR(44), -- base64 sha256 hash of the canonicalized claim
    origClaimJwtId TEXT,
    actionRowId BIGINT,
    tenureRowId INTEGER,
    orgRoleRowId INTEGER
);

CREATE TABLE event (
    orgName VARCHAR(120),
    name VARCHAR(250),
    startTime DATETIME
);

CREATE TABLE give_claim (
    handleId TEXT PRIMARY KEY,
    jwtId TEXT,
    issuedAt DATETIME,
    updatedAt DATETIME,

    -- note that did:peer are 58 chars
    agentDid TEXT, -- global ID of the entity who gave the item

    recipientDid TEXT, -- global ID of recipient
    fulfillsId TEXT, -- global ID to the offer to which this Give applies
    fulfillsType TEXT, -- type of that ID (assuming context of schema.org)

    -- This global plan ID is for the case where this is given to a broader
    -- plan that is nested inside the related data.
    fulfillsPlanId TEXT,

    unit TEXT,
    amount REAL DEFAULT 0,

    -- If giving an object with an amount, the amount of this Give with the
    -- same unit that has been confirmed.
    -- If giving without an "amount" object, just a 1 for confirmed.
    -- Only if confirmed by the Give recipient or by plan issuer or agent.
    amountConfirmed REAL DEFAULT 0,

    description TEXT,
    fullClaim TEXT -- full claim JSON
);

CREATE TABLE give_provider (
    giveHandleId TEXT, -- handleId of the GiveAction which has this as a provider
    providerHandleId TEXT, -- handleId of the provider claim
);

CREATE TABLE jwt (
    id CHARACTER(26) PRIMARY KEY,
    handleId TEXT, -- global IRI, used to update data via later claims
    issuedAt DATETIME,
    issuer CHARACTER(100), -- DID of the confirming entity; did:ethr are 52 chars
    subject VARCHAR(100),
    claimType VARCHAR(60),
    claimContext VARCHAR(60),
    claim TEXT, -- text of the JSON for the claim
    claimCanonHashBase64 VARCHAR(64), -- base64 sha256 hash of the canonicalized claim
    claimEncoded TEXT, -- base64 encoding of the canonicalized claim
    jwtEncoded TEXT, -- the full original JWT
    hashHex VARCHAR(64), -- a hash constructed to allow selective disclosure but to avoid correlation (using hashNonce)
    hashChainHex VARCHAR(64), -- merkle tree of hashHex values
    hashNonce VARCHAR(24) -- randomized 18 bytes, base64-encoded
);

CREATE TABLE network (
    subject VARCHAR(100), -- DID of the entity who can see/reach the object
    object VARCHAR(100), -- DID of the entity who can be seen/reached by the subject
    url TEXT,
    CONSTRAINT both_unique UNIQUE (subject, object)
);

CREATE TABLE offer_claim (
    handleId TEXT PRIMARY KEY,
    jwtId TEXT,
    issuedAt DATETIME,
    updatedAt DATETIME,

    -- note that did:peer are 58 chars
    offeredByDid TEXT, -- global ID of the offering entity (issuer if empty)
    recipientDid TEXT, -- global ID of recipient (if any)
    recipientPlanId TEXT, -- full ID of PlanAction (if any)

    unit TEXT,
    amount REAL DEFAULT 0,

    -- amount of Gives with same unit
    --
    -- does not count any that have no amounts
    amountGiven REAL DEFAULT 0,

    -- amount of Gives that have been confirmed for this offer with the same
    -- unit (see 'amountConfirmed' in give_claim)
    amountGivenConfirmed REAL DEFAULT 0,

    -- number of Gives with descriptions (ie. no object amount) that have
    -- been confirmed by the recipient
    nonAmountGivenConfirmed INTEGER DEFAULT 0,

    validThrough DATETIME,

    -- whether all requirements are satisfied (boolean, 1 = satisfied)
    requirementsMet INTEGER DEFAULT 1,

    objectDescription TEXT,
    fullClaim TEXT -- full claim JSON
);

CREATE TABLE org_role_claim (
    jwtId CHARACTER(26),
    issuerDid VARCHAR(100), -- DID of the issuer (first one to create this claim); did:ethr are 52 chars
    orgName TEXT,
    roleName TEXT,
    startDate DATE,
    endDate DATE,
    memberDid TEXT -- DID of the member with the role; did:ethr are 52 chars
);

CREATE TABLE plan_claim (
    jwtId text PRIMARY KEY,
    issuerDid TEXT, -- DID of the entity who recorded this; did:peer are 58 chars
    agentDid TEXT, -- DID of the plan owner/initiator; did:peer are 58 chars
    handleId TEXT,
    internalId TEXT, -- unused
    name TEXT,
    description TEXT,
    image TEXT,
    endTime DATE, -- should be DATETIME, but luckily it stores times already
    startTime DATE, -- should be DATETIME, but luckily it stores times already
    resultDescription TEXT,
    resultIdentifier TEXT,
    url TEXT
);

CREATE TABLE project_claim (
    jwtId TEXT PRIMARY KEY,
    issuerDid TEXT, -- DID of the entity who recorded this; did:peer are 58 chars
    agentDid TEXT, -- DID of the plan owner/initiator; did:peer are 58 chars
    handleId TEXT,
    internalId TEXT, -- unused
    name TEXT,
    description TEXT,
    image TEXT,
    endTime DATE, -- should be DATETIME, but luckily it stores times already
    startTime DATE, -- should be DATETIME, but luckily it stores times already
    resultDescription TEXT,
    resultIdentifier TEXT
);

CREATE TABLE registration (
    did CHARACTER(100) PRIMARY KEY, -- DID of the confirming entity; did:peer are 58 chars
    agent CHARACTER(100), -- DID of the confirming entity; did:peer are 58 chars
    epoch INTEGER, -- unix epoch seconds
    jwtId CHARACTER(26),
    maxRegs INTEGER, -- allowed registrations per time period
    maxClaims INTEGER -- allowed claims per time period
);

CREATE TABLE tenure_claim (
    jwtId CHARACTER(26),
    issuerDid VARCHAR(100), -- DID of the issuer (first one to create this claim); did:ethr are 52 chars
    partyDid VARCHAR(100), -- DID of the owning agent; did:ethr are 52 chars
    -- see https://schema.org/GeoShape basically contents of a WKT Polygon
    polygon TEXT,
    -- all WGS 84 (lat/long)
    westLon REAL,
    minLat REAL,
    eastLon REAL,
    maxLat REAL
);

CREATE TABLE vote_claim (
    jwtId CHARACTER(26),
    issuerDid VARCHAR(100), -- DID of the issuer (first one to create this claim); did:ethr are 52 chars
    actionOption TEXT,
    candidate TEXT,
    eventName TEXT,
    eventStartTime DATETIME
);
```
