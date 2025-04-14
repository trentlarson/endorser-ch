# Endorser Search Server Context

## Project Overview

Endorser Search is an API for creating and querying claims in privacy-preserving ways. The system allows users to make cryptographically signed claims (attestations) and confirmations while maintaining control over their personal identifiers' visibility. Others can use a chain of data to verify content origination. Furthermore, it has facilities to enable people to selectively share information, for easy onboarding of individuals or groups, and for some discovery of the network to find originators of data.

Also currently included are some "partner" functions: these reveal more about the users and potentially expose information (like identifiers) with other systems (like nostr). Their use should be clearly segregated from direct access to a person's network information, and eventually this should be a totally separate system (so that there is no file system access).


## Core Principles

1. **Privacy-Preserving**: Store and retrieve textual data publicly while ensuring identifier visibility is fully controlled by each user.

2. **Accessibility**: Provide service without cost to users in selected communities, with rate-limiting to manage usage.

3. **Verification**: Support only cryptographically signed claims and confirmations, ensuring authenticity.

4. **Discovery**: Enable discovery of other users through visibility networks or users' preferred messaging networks.

5. **Utility**: Support specific use cases like counting confirmations or aggregating claim totals.


## Key Technical Concepts

### Decentralized Identifiers (DIDs)
- The system uses DIDs as the primary user identification mechanism
- Visibility of DIDs is controlled by the user
- Hidden DIDs are represented with `did:none:HIDDEN_TEXT` in responses

### Claims and Confirmations
- Claims are attestations made by users about events, actions, or tenures
- Confirmations are verification of claims by other users
- All claims and confirmations are cryptographically signed using JWTs

### Merkle-Chained Claims
- Claims are chained together using cryptographic merkle hashes
- The entire system maintains a most-recent merkle hash of all claims
- Each user has their own most-recent merkle hash available
- Observers with visibility permissions can verify they have the latest data
- This enables data integrity verification for both individual users and the entire system
- Supports efficient synchronization and verification of claim histories

### Visibility Control
- Users explicitly control who can see their identifiers
- Visibility can be granted or revoked between users
- Claims may be visible but with identifiers hidden

### Location-Based Features
- System supports geospatial data for claims and profiles
- Location data can be searched and retrieved in privacy-preserving ways
- Tile-based location indexing for efficient spatial queries

### User Profiles
- Users can create and update profiles with descriptions and locations
- Profiles are searchable by text and location
- Visibility rules apply to profile data

## Implementation Goals

1. Simple-to-deploy service with minimal dependencies
2. Fast response times for common operations
3. Well-defined rules for visibility and access control
4. Scalable architecture for growing user bases
5. Resistance to abuse through rate-limiting and verification requirements

## Intended Use Cases

1. Attendance verification for events
2. Community participation tracking
3. Location-based claim verification
4. Peer-to-peer endorsements with privacy controls
5. Building trust networks with controlled visibility 