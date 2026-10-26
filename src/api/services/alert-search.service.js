/**
 * Alert search: fetches endorser data (claims, plan contributions, plans, etc.)
 * for the report router. Partner router adds profile data on top.
 * Parameter and cursor handling is in alert-search-params.js.
 */

import { cutListsAtLimit } from './alert-search-params'
import { dbService as endorserDbService } from './endorser.db.service'
import { hideDidsAndAddLinksToNetwork, takePublicUrls } from './util-higher'

const ALERT_SEARCH_TIMEOUT_MS = 2000

/**
 * Resolves with the promise result if it completes within ms, otherwise with fallback.
 * Returns { result, timedOut }. The original promise continues in the background.
 */
async function withTimeout(promise, fallback, functionName) {
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      console.error('Timeout: data fetch for', functionName, 'exceeded timeout of', ALERT_SEARCH_TIMEOUT_MS, 'ms')
      resolve({ result: fallback, timedOut: true })
    }, ALERT_SEARCH_TIMEOUT_MS)
  })
  return Promise.race([
    promise.then((r) => ({ result: r, timedOut: false })),
    timeout,
  ]).finally(() => clearTimeout(timer))
}

/**
 * Fetch endorser data for alert search: claims, plan contributions, tracked plan updates,
 * tracked plan claims, and plans by location.
 *
 * With a seqWindow, each list holds rows changed inside it, oldest change first
 * (newest first when descending), all cut to one cursor (see cutListsAtLimit).
 * Otherwise the lists are bounded by the JWT IDs, newest first.
 *
 * @param {string} did - requester DID
 * @param {object} params - { effectiveAfterId, effectiveBeforeId, seqWindow, location, planHandleIds },
 *   where seqWindow is from cursorWindow and replaces the IDs
 * @returns {Promise<{ claims, personalPlanContributions, trackedPlanUpdates, trackedPlanClaims, plansNearby,
 *   anyTruncated, hasMore, next }>} hasMore is whether a list hit its limit; with a seqWindow, next is the
 *   cursor to continue from in the window's direction
 */
export async function fetchAlertSearchEndorserData(did, params) {
  const { effectiveAfterId, effectiveBeforeId, seqWindow, location, planHandleIds } = params

  const basePromises = [
    endorserDbService.jwtsWithDidAfterId(did, effectiveAfterId, effectiveBeforeId, seqWindow),
    endorserDbService.jwtsForUserPlanContributions(did, effectiveAfterId, effectiveBeforeId, seqWindow),
  ]
  const trackedPlanPromises = planHandleIds?.length
    ? [
        endorserDbService.plansLastUpdatedBetween(planHandleIds, effectiveAfterId || undefined, effectiveBeforeId, seqWindow),
        endorserDbService.jwtsGiveActionOfferForPlanHandleIds(planHandleIds, effectiveAfterId, effectiveBeforeId, seqWindow),
      ]
    : []
  const [claimsResult, planContributionsResult, trackedPlanUpdatesResult, trackedPlanClaimsResult] = await Promise.all([
    ...basePromises,
    ...(trackedPlanPromises.length ? trackedPlanPromises : [
      Promise.resolve({ data: [], hitLimit: false }),
      Promise.resolve({ data: [], hitLimit: false }),
    ]),
  ])

  let plansNearbyResult = { data: [], hitLimit: false }
  if (location) {
    const { minLocLat, maxLocLat, minLocLon, maxLocLon } = location
    plansNearbyResult = await endorserDbService.plansByLocationAfterId(minLocLat, maxLocLat, minLocLon, maxLocLon, effectiveAfterId, effectiveBeforeId, seqWindow)
  }

  const results = {
    claims: claimsResult,
    personalPlanContributions: planContributionsResult,
    trackedPlanUpdates: trackedPlanUpdatesResult,
    trackedPlanClaims: trackedPlanClaimsResult,
    plansNearby: plansNearbyResult,
  }
  let lists, hasMore, next
  if (seqWindow) {
    ({ lists, hasMore, next } = cutListsAtLimit(results, seqWindow))
  } else {
    lists = Object.fromEntries(Object.entries(results).map(([key, result]) => [key, result.data]))
    hasMore = Object.values(results).some((result) => result.hitLimit)
  }

  const [claimsOut, planContributionsOut, trackedPlanUpdatesOut, trackedPlanClaimsOut, plansOut] = await Promise.all([
    withTimeout(hideDidsAndAddLinksToNetwork(did, lists.claims, []), [], 'claims'),
    withTimeout(hideDidsAndAddLinksToNetwork(did, lists.personalPlanContributions, []), [], 'personal plan contributions'),
    withTimeout(hideDidsAndAddLinksToNetwork(did, lists.trackedPlanUpdates, planHandleIds ?? []), [], 'tracked plan updates'),
    withTimeout(hideDidsAndAddLinksToNetwork(did, lists.trackedPlanClaims, planHandleIds ?? []), [], 'tracked plan claims'),
    withTimeout(hideDidsAndAddLinksToNetwork(did, lists.plansNearby, []), [], 'plans'),
  ])

  const anyTruncated = claimsOut.timedOut || planContributionsOut.timedOut || trackedPlanUpdatesOut.timedOut ||
    trackedPlanClaimsOut.timedOut || plansOut.timedOut

  return {
    claims: claimsOut.result,
    personalPlanContributions: planContributionsOut.result,
    trackedPlanUpdates: trackedPlanUpdatesOut.result,
    trackedPlanClaims: trackedPlanClaimsOut.result,
    plansNearby: plansOut.result,
    publicUrls: takePublicUrls([claimsOut.result, planContributionsOut.result, trackedPlanUpdatesOut.result,
      trackedPlanClaimsOut.result, plansOut.result]),
    anyTruncated,
    hasMore,
    next,
  }
}
