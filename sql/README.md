
Update this file with any changes to the schema.

This file exists to explain data because sometimes the comments inside the
.sqlite3 files need subsequent clarification or get outdated (and I can't edit
them after flyway has run).

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
    origClaimCanonHashBase64 CHARACTER(44), -- base64 encoding of sha256 hash of the canonicalized claim

    -- This could be null if there was no explicit identifier or no claim found with matching data.
    -- This could happen in the case of a plan. It shouldn't, but we don't error in that case
    -- because we don't want to try and match on all that claim data at this point... that sees rare.
    origClaimJwtId TEXT,

    -- The following are cached entries of the data being confirmed.
    -- Note that some may be editable (eg. plans)... so beware that the
    -- confirmation is only for the JWT, at the time of the confirmation;
    -- these can be useful to help people see the latest values in an entity
    -- and detect changes, but they cannot be used as a definitive statement of
    -- who and how many confirmations are on particular data: that is only in
    -- origClaimJwtId.

    -- these are caches of the data in the origClaim, which may change to handle IDs in the future
    actionRowId BIGINT,
    orgRoleRowId INTEGER,
    tenureRowId INTEGER,

    -- this is obviously a handle ID already
    planHandleId TEXT
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

    -- whether both giver and recipient have confirmed the fulfill relationship (boolean, 1 = confirmed)
    --
    -- This does not mean that receipt of this give is confirmed,
    --  but that both sides of the child/parent relationship agree that this parentage is correct.)
    --
    -- Note that, as long as this resides in the give_claim table, it means that the owner of the
    -- parent 'fulfills' object has confirmed the relationship because the creator of this plan
    -- owns the data and claimed the relationship so they obviously implicitly confirmed it.
    --
    fulfillLinkConfirmed INTEGER DEFAULT 0,

    -- This is the ID of the plan claim JWT to which this Give directly links.
    -- It is typically an internal ID, eg. 01D25AVGQG1N8E9JNGK7C7DZRD, but
    -- also supports external, global IDs.
    --
    -- It's important because a handle ID points to content that can change
    -- over time, but when claiming that this fulfills a plan we want a
    -- reference to the exact claim that was seen at the time of the link,
    -- in case something substantial in the plan changed and no longer reflects
    -- the intent of the provider(s) of this Give.
    fulfillsPlanClaimId TEXT,

    -- This global, persistent plan ID is for the case where this is given to a
    -- broader plan that is nested inside the related data.
    fulfillsPlanHandleId TEXT,

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
CREATE INDEX give_agentDid ON give_claim(agentDid);
CREATE INDEX give_recipientDid ON give_claim(recipientDid);
CREATE INDEX give_fulfillsId ON give_claim(fulfillsId);
CREATE INDEX give_fulfillsPlanId ON give_claim(fulfillsPlanId);
CREATE INDEX confirmed_jwt ON confirmation(origClaimJwtId);

CREATE TABLE give_provider (
    giveHandleId TEXT, -- handleId of the GiveAction which has this as a provider
    providerHandleId TEXT, -- handleId of the provider claim

    -- whether both giver and provider have confirmed this relationship (boolean, 1 = confirmed)
    -- (This does not mean that receipt is confirmed, but that both sides of
    --  the give/provider relationship agree that this linkage is correct.)
    linkConfirmed INTEGER DEFAULT 0
);
CREATE INDEX give_provider_give ON give_provider(giveHandleId);
CREATE INDEX give_provider_provider ON give_provider(providerHandleId);

CREATE TABLE jwt (
    id CHARACTER(26) PRIMARY KEY,
    handleId TEXT, -- global IRI, used to update data via later claims
    issuedAt DATETIME,
    issuer CHARACTER(100), -- DID of the confirming entity; did:ethr are 52 chars
    subject VARCHAR(100),
    claimType VARCHAR(60),
    claimContext VARCHAR(60),
    claim TEXT, -- canonical text of the JSON for the claim (but was it directly from the JWT at first?)
    claimCanonBase64 TEXT, -- base64 encoding of the canonicalized claim
    claimCanonHashBase64 CHARACTER(44), -- base64 encoding of sha256 hash of the canonicalized claim
    hashChainB64 CHARACTER(64), -- merkle tree of claimCanonHashBase64 values
    hashNonce CHARACTER(24) -- randomized 18 bytes (currently base64-encoded), kept private, used for nonceHashHex
    jwtEncoded TEXT, -- the full original JWT
    nonceHashHex CHARACTER(64), -- hex of hash constructed with hashNonce to allow selective disclosure but to avoid correlation
);
CREATE INDEX jwt_entityId ON jwt(handleId);
CREATE INDEX jwt_claimHash on jwt (claimCanonHashBase64);

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
CREATE INDEX offer_offeredByDid ON offer_claim(offeredByDid);
CREATE INDEX offer_recipientDid ON offer_claim(recipientDid);
CREATE INDEX offer_recipientPlanId ON offer_claim(recipientPlanId);
CREATE INDEX offer_validThrough ON offer_claim(validThrough);

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
    handleId TEXT,
    jwtId text PRIMARY KEY, -- the latest JWT ID that updated this plan
    issuerDid TEXT, -- DID of the entity who recorded this; did:peer are 58 chars
    agentDid TEXT, -- DID of the plan owner/initiator; did:peer are 58 chars

    -- whether both giver and recipient have confirmed the fulfill relationship (boolean, 1 = confirmed)
    --
    -- This does not mean that receipt is confirmed, but that both sides of
    --  the child/parent relationship agree that this parentage is correct.)
    --
    -- Note that, as long as this resides in the plan_claim table, it means that the owner of the
    -- parent 'fulfills' object has confirmed the relationship because the creator of this plan
    -- owns the data and claimed the relationship so they obviously implicitly confirmed it.
    --
    fulfillsLinkConfirmed INTEGER DEFAULT 0,

    -- This is the ID of the plan claim JWT to which this Plan directly links.
    -- It is typically an internal ID, eg. 01D25AVGQG1N8E9JNGK7C7DZRD, but
    -- also supports external, global IDs.
    --
    -- It's important because a handle ID points to content that can change
    -- over time, but when claiming that this fulfills a plan we want a
    -- reference to the exact claim that was seen at the time of the link,
    -- in case something substantial in the plan changed and no longer reflects
    -- the intent of the provider(s) of this Plan.
    fulfillsPlanClaimId TEXT,

    -- current plan contributes to another plan with this global plan ID
    fulfillsPlanHandleId TEXT,

    -- internalId TEXT, -- unused
    name TEXT,
    description TEXT,
    image TEXT,
    endTime DATE, -- should be DATETIME, but luckily it stores times already
    startTime DATE, -- should be DATETIME, but luckily it stores times already
    locLat REAL, -- approximate WGS 84 latitude (we don't request precision)
    locLon REAL, -- approximate WGS 84 longitude (we don't request precision)
    resultDescription TEXT,
    resultIdentifier TEXT,
    url TEXT
);
CREATE INDEX plan_issuerDid ON plan_claim(issuerDid);
CREATE INDEX plan_fullIri ON plan_claim(handleId);
CREATE INDEX plan_internalId ON plan_claim(internalId);
CREATE INDEX plan_endTime ON plan_claim(endTime);
CREATE INDEX plan_resultIdentifier ON plan_claim(resultIdentifier);

CREATE TABLE project_claim (
    jwtId TEXT PRIMARY KEY,
    issuerDid TEXT, -- DID of the entity who recorded this; did:peer are 58 chars
    agentDid TEXT, -- DID of the plan owner/initiator; did:peer are 58 chars
    handleId TEXT,
    -- internalId TEXT, -- unused
    name TEXT,
    description TEXT,
    image TEXT,
    endTime DATE, -- should be DATETIME, but luckily it stores times already
    startTime DATE, -- should be DATETIME, but luckily it stores times already
    locLat REAL, -- approximate WGS 84 latitude (we don't request precision)
    locLon REAL, -- approximate WGS 84 longitude (we don't request precision)
    resultDescription TEXT,
    resultIdentifier TEXT,
    url TEXT
);
CREATE INDEX project_issuerDid ON project_claim(issuerDid);
CREATE INDEX project_fullIri ON project_claim(handleId);
CREATE INDEX project_internalId ON project_claim(internalId);
CREATE INDEX project_endTime ON project_claim(endTime);
CREATE INDEX project_resultIdentifier ON project_claim(resultIdentifier);

CREATE TABLE registration (
    did CHARACTER(100) PRIMARY KEY, -- DID of the registered entity; did:peer are 58 chars
    agent CHARACTER(100), -- DID of the registering entity; did:peer are 58 chars
    epoch INTEGER, -- unix epoch seconds
    jwtId CHARACTER(26),
    maxRegs INTEGER, -- allowed registrations per time period
    maxClaims INTEGER -- allowed claims per time period
);
CREATE INDEX registered_agent ON registration(agent);
CREATE INDEX registered_epoch ON registration(epoch);

CREATE TABLE tenure_claim (
    jwtId CHARACTER(26),
    issuerDid VARCHAR(100), -- DID of the issuer (first one to create this claim); did:ethr are 52 chars
    partyDid VARCHAR(100), -- DID of the owning agent; did:ethr are 52 chars
    -- see https://schema.org/GeoShape basically contents of a WKT Polygon
    polygon TEXT,
    -- all WGS 84 (lat/long)
    westLon REAL, -- westernmost longitude
    minLat REAL,
    eastLon REAL, -- easternmost longitude
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
