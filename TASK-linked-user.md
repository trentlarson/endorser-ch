# Finding Shortest Visibility Paths to Target DIDs

## Problem Statement
We need to implement an endpoint that accepts a claim ID and a DID property in that claim, then performs a breadth-first search through the visibility network to find the shortest paths from users visible to the requester to the target DID. This is essentially a graph traversal problem where:

1. Nodes are DIDs (users)
2. Edges are visibility permissions where the "subject" can see "object" DIDs (because the "object" has allowed it)
3. We start from DIDs visible to the requester
4. We want to find the originating DIDs that begin the paths to the target DID; in other words, find the immediate neighbors who are on a path to the target DID
5. Resulting list of DIDs should be ordered by length of their path to the target DID (shortest first)

The existing `getAllDidsBetweenRequesterAndObjects` method is insufficient as it only checks for direct visibility between a user and the target DID, not performing a complete graph traversal to find all possible paths.

This data structure is stored in the `network` SQL table, where each entry represents that a `subject` can see an `object`.

Repeated SQL calls could be expensive; we load the "sees" entries into an in-memory cache in the network-cache service.

## Implementation
- [x] Create new endpoint `/api/report/usersWhoCanSeeDid`
- [x] Accept required query parameters: `claimId` and `didProperty`
- [x] Validate input parameters
- [x] Retrieve claim from database
- [x] Extract target DID from claim property
- [x] Get all DIDs requester can see
- [ ] Implement breadth-first search algorithm for finding shortest paths:
  - [ ] Start from DIDs visible to requester
  - [ ] For each DID, check DIDs visible to them
  - [ ] Continue until target DID is found, or max depth (eg 10) is reached, or when multiple results (eg 5) are found
  - [ ] Track visited DIDs to avoid cycles
  - [ ] Leverage existing `SeesNetworkCache` and `WhoCanSeeNetworkCache`
- [ ] Sort results by path length, shortest first
- [ ] Return response array of nearest-neighbor DIDs who are on paths to the target

## Optimizations
- [ ] Caching strategy:
  - [ ] Cache the intermediate paths, where the originator & target are the key and the DID of the nearest neighbor & path length are the value
  - [ ] Use that cache in subsequent iterations, potentially bypassing the DB if the key already exists
  - [ ] Implement a time-based cache invalidation strategy
  - [ ] Consider LRU (Least Recently Used) caching for frequent path requests

- [ ] Batch retrieval strategy: Fetch multiple layers of visibility data at once
  - [ ] When retrieving data for a DID, pre-fetch all its direct connections
  - [ ] Use a single query to get all DIDs who can see multiple target DIDs
  - [ ] Consider prefetching the entire visibility graph for smaller networks
  
- [ ] Graph representation optimization:
  - [ ] Use an adjacency list representation for faster traversal
  - [ ] Build the graph incrementally, only expanding nodes as needed
  - [ ] Implement bidirectional search, including detection of the unreachable situation where source and target have no path between them (which can happen if the target removes visibility from all nodes between them)

- [ ] Database optimization:
  - [ ] Create indices on the network table for `subject` and `object` columns
  - [ ] Implement pagination when fetching large datasets
  - [ ] Use database transactions for batched operations
  - [ ] Consider denormalized tables for frequent access patterns

- [ ] Computation optimization:
  - [ ] Implement early termination when target is found
  - [ ] Use parallel processing for independent graph traversals
  - [ ] Implement maximum depth limit to prevent excessive computation
  - [ ] Consider using iterative deepening for very deep graphs

## Error Handling
- [x] Handle missing required parameters
- [x] Handle non-existent claim
- [x] Handle missing DID property in claim
- [x] Handle database errors
- [x] Handle network visibility errors
- [ ] Handle cycles in visibility graph
- [ ] Implement max depth limit to prevent excessive recursion

## Testing
- [ ] Unit Tests
  - [ ] Test with valid claim and DID property
  - [ ] Test with non-existent claim
  - [ ] Test with missing DID property
  - [ ] Test with missing parameters
  - [ ] Test with direct visibility path (depth 1)
  - [ ] Test with indirect visibility path (depth 2+)
  - [ ] Test with multiple paths of different lengths
  - [ ] Test with no valid paths
  - [ ] Test with globally visible DID
  - [ ] Test with requester's own DID
  - [ ] Test with cycles in visibility graph
  - [ ] Test with maximum depth limit

- [ ] Integration Tests
  - [ ] Test complete visibility chain
  - [ ] Test with multiple users in visibility network
  - [ ] Test with circular visibility paths
  - [ ] Test with maximum path length
  - [ ] Test with rate limiting
  - [ ] Test with concurrent requests
  - [ ] Test performance with large visibility networks

## Documentation
- [x] Add Swagger documentation
- [x] Document response format
- [x] Document error responses
- [ ] Add example requests and responses
- [ ] Document performance considerations
- [ ] Document security considerations
- [ ] Document algorithm complexity

## Performance
- [ ] Add caching for frequently accessed claims
- [ ] Optimize breadth-first search algorithm
- [ ] Implement early termination when shortest paths are found
- [ ] Add pagination for large result sets
- [ ] Add timeout handling for long-running queries
- [ ] Add request rate limiting
- [ ] Consider using a queue-based approach for large networks

## Security
- [x] Validate user authentication
- [x] Respect visibility permissions
- [ ] Add input sanitization
- [ ] Add request size limits
- [ ] Add response size limits
- [ ] Add audit logging
- [ ] Implement throttling for resource-intensive searches

## Monitoring
- [ ] Add performance metrics
- [ ] Add error rate monitoring
- [ ] Add usage statistics
- [ ] Add alerting for errors
- [ ] Add alerting for performance issues
- [ ] Track algorithm efficiency metrics
