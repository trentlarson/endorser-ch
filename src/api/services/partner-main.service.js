/**
 * Everything partner features read from the main service (registrations, the
 * network, claims, plans).
 *
 * Partner features are meant to become a separate service (README-context.md).
 * This is the one place where partner code reaches the main service, so that
 * split replaces these in-process calls with API calls and nothing else.
 * Partner code imports this instead of the main service's modules.
 *
 * The other service would call with its own credential, naming the user as a
 * parameter, the way membership.service.js answers other services today. It
 * would not forward the user's credential, which would act as the user
 * everywhere.
 *
 * Calls marked "sweep" serve the plan embedding sweep, which moves to the main
 * service with the split (CHANGES/PLAN-interest-matching-architecture.md);
 * they become no call at all rather than API calls.
 */

import { dbService as endorserDbService } from './endorser.db.service'
import { membershipForDid } from './membership.service'
import { nearestNeighborsTo } from './network-cache.service'
import { visibilityFromNetworkCache } from './util-higher'

const mainService = {

  /**
   * What the requester may see of some DIDs, for hideDidsAndAddLinksToNetwork.
   * @returns {Promise<DidVisibility>} see util-higher.js
   */
  visibility: (requesterDid, dids) => visibilityFromNetworkCache(requesterDid, dids),

  /**
   * Whether a DID is a member in good standing (registered and not revoked).
   * Rejects when that can't be determined, which is not the same as "no".
   * @returns {Promise<boolean>}
   */
  isMember: async (did) => (await membershipForDid(did)).member,

  /**
   * The registration-tree neighbor between two DIDs, from the requester's side.
   */
  nearestNeighborsTo: (requesterDid, targetDid) => nearestNeighborsTo(requesterDid, targetDid),

  /** The main DB's change counter, for the main part of partner cursors. */
  changeCounter: () => endorserDbService.changeCounter(),

  /** One claim JWT, for partner links to it. */
  jwtById: (jwtId) => endorserDbService.jwtById(jwtId),

  /** Plan records by handle ID, to be scrubbed of DIDs by the caller. */
  planInfoByHandleIds: (handleIds) => endorserDbService.planInfoByHandleIds(handleIds),

  /** Handle IDs of plans in a bounding box. */
  planHandleIdsByLocation: (minLat, maxLat, minLon, maxLon) =>
    endorserDbService.planHandleIdsByLocation(minLat, maxLat, minLon, maxLon),

  /**
   * The store of plan vectors (an EmbeddingStore). Partner code reads it; the
   * sweep also writes it.
   */
  planEmbeddings: () => endorserDbService.embeddings,

  /** sweep: every plan's name and description */
  plansAllNamesDescriptions: () => endorserDbService.plansAllNamesDescriptions(),

  /** sweep: one plan */
  planInfoByHandleId: (handleId) => endorserDbService.planInfoByHandleId(handleId),
}

module.exports = { mainService }
