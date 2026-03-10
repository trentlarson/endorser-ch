/**
 * Alert search: fetches endorser data (claims, plan contributions, plans, etc.)
 * for the report router. Partner router adds profile data on top.
 */

import { dbService as endorserDbService } from './endorser.db.service'
import { hideDidsAndAddLinksToNetwork } from './util-higher'
import { globalId } from './util'

const ALERT_SEARCH_TIMEOUT_MS = 2000

/** Crockford base32: 0-9, A-Z excluding I, L, O, U. ULID is 26 chars. */
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/

/**
 * Normalize alertSearch params from either POST body or GET query.
 * Returns { afterId, beforeId, location, planHandleIds, paramErrors }.
 */
export function alertSearchParamsFromRequest(req) {
  const isGet = req.method === 'GET'
  const src = isGet ? (req.body || req.query) : req.body
  const afterId = src?.afterId
  const beforeId = src?.beforeId
  const paramErrors = []
  let location = null
  if (src?.location && typeof src.location === 'object') {
    const { minLocLat, maxLocLat, minLocLon, maxLocLon } = src.location
    if (minLocLat != null && maxLocLat != null && minLocLon != null && maxLocLon != null) {
      location = { minLocLat, maxLocLat, minLocLon, maxLocLon }
    }
  } else if (src) {
    const minLocLat = src.minLocLat != null ? parseFloat(src.minLocLat) : null
    const maxLocLat = src.maxLocLat != null ? parseFloat(src.maxLocLat) : null
    const minLocLon = src.minLocLon != null ? parseFloat(src.minLocLon) : null
    const maxLocLon = src.maxLocLon != null ? parseFloat(src.maxLocLon) : null
    if (minLocLat != null && maxLocLat != null && minLocLon != null && maxLocLon != null) {
      location = { minLocLat, maxLocLat, minLocLon, maxLocLon }
    }
  }
  let planHandleIds = []
  const planIdsParam = src?.planIds || src?.planHandleIds || src?.handleIds
  if (planIdsParam != null) {
    try {
      const planIdsParsed = typeof planIdsParam === 'string' ? JSON.parse(planIdsParam) : planIdsParam
      if (!Array.isArray(planIdsParsed)) {
        paramErrors.push("Parameter 'planIds' or 'planHandleIds' or 'handleIds' should be an array but got: " + String(planIdsParsed))
      } else {
        planHandleIds = planIdsParsed.map(globalId)
      }
    } catch (e) {
      paramErrors.push("Parameter 'planIds' or 'planHandleIds' or 'handleIds' must be valid JSON array: " + e.message)
    }
  }
  return { afterId, beforeId, location, planHandleIds, paramErrors }
}

/**
 * Compute effectiveBeforeId and merge beforeId validation errors into paramErrors.
 */
export function resolveAlertSearchBeforeId(beforeId, paramErrors = []) {
  if (paramErrors == null) paramErrors = []
  if (beforeId != null && typeof beforeId === 'string' && !ULID_REGEX.test(beforeId)) {
    paramErrors.push("beforeId must be a valid ULID if provided.")
    beforeId = undefined
  }
  const effectiveBeforeId = (beforeId && typeof beforeId === 'string') ? beforeId : undefined
  return { effectiveBeforeId, paramErrors }
}

/**
 * Compute effectiveAfterId and merge afterId validation errors into paramErrors.
 */
export function resolveAlertSearchAfterId(afterId, paramErrors = []) {
  if (paramErrors == null) paramErrors = []
  if (afterId != null && typeof afterId === 'string' && !ULID_REGEX.test(afterId)) {
    paramErrors.push("afterId must be a valid ULID if provided.")
    afterId = undefined
  }
  const effectiveAfterId = (afterId && typeof afterId === 'string') ? afterId : ''
  return { effectiveAfterId, paramErrors }
}

/**
 * Resolves with the promise result if it completes within ms, otherwise with fallback.
 * Returns { result, timedOut }. The original promise continues in the background.
 */
async function withTimeout(promise, fallback, functionName) {
  const timeout = new Promise((resolve) => {
    setTimeout(() => {
      console.error('SQL Timeout: data fetch for', functionName, 'exceeded timeout of', ALERT_SEARCH_TIMEOUT_MS, 'ms')
      resolve({ result: fallback, timedOut: true })
    }, ALERT_SEARCH_TIMEOUT_MS)
  })
  return Promise.race([
    promise.then((r) => ({ result: r, timedOut: false })),
    timeout,
  ])
}

/**
 * Fetch endorser data for alert search: claims, plan contributions, tracked plan updates,
 * tracked plan claims, and plans by location.
 *
 * @param {string} did - requester DID
 * @param {object} params - { effectiveAfterId, effectiveBeforeId, location, planHandleIds }
 * @returns {Promise<{ claims, personalPlanContributions, trackedPlanUpdates, trackedPlanClaims, plansNearby, anyTruncated }>}
 */
export async function fetchAlertSearchEndorserData(did, params) {
  const { effectiveAfterId, effectiveBeforeId, location, planHandleIds } = params

  const basePromises = [
    endorserDbService.jwtsWithDidAfterId(did, effectiveAfterId, effectiveBeforeId),
    endorserDbService.jwtsForUserPlanContributions(did, effectiveAfterId, effectiveBeforeId),
  ]
  const trackedPlanPromises = planHandleIds?.length
    ? [
        endorserDbService.plansLastUpdatedBetween(planHandleIds, effectiveAfterId || undefined, effectiveBeforeId),
        endorserDbService.jwtsGiveActionOfferForPlanHandleIds(planHandleIds, effectiveAfterId, effectiveBeforeId),
      ]
    : []
  const [claimsResult, planContributionsResult, trackedPlanUpdatesResult, trackedPlanClaimsResult] = await Promise.all([
    ...basePromises,
    ...(trackedPlanPromises.length ? trackedPlanPromises : [
      Promise.resolve({ data: [], hitLimit: false }),
      Promise.resolve({ data: [], hitLimit: false }),
    ]),
  ])

  let trackedPlanUpdates = trackedPlanUpdatesResult?.data ?? []
  let trackedPlanClaims = trackedPlanClaimsResult?.data ?? []
  let plansNearby = { data: [], hitLimit: false }
  if (location) {
    const { minLocLat, maxLocLat, minLocLon, maxLocLon } = location
    plansNearby = await endorserDbService.plansByLocationAfterId(minLocLat, maxLocLat, minLocLon, maxLocLon, effectiveAfterId, effectiveBeforeId)
  }

  const [claimsOut, planContributionsOut, trackedPlanUpdatesOut, trackedPlanClaimsOut, plansOut] = await Promise.all([
    withTimeout(hideDidsAndAddLinksToNetwork(did, claimsResult.data, []), [], 'claims'),
    withTimeout(hideDidsAndAddLinksToNetwork(did, planContributionsResult.data, []), [], 'personal plan contributions'),
    withTimeout(hideDidsAndAddLinksToNetwork(did, trackedPlanUpdates, planHandleIds ?? []), [], 'tracked plan updates'),
    withTimeout(hideDidsAndAddLinksToNetwork(did, trackedPlanClaims, planHandleIds ?? []), [], 'tracked plan claims'),
    withTimeout(hideDidsAndAddLinksToNetwork(did, plansNearby.data, []), [], 'plans'),
  ])

  const anyTruncated = claimsOut.timedOut || planContributionsOut.timedOut || trackedPlanUpdatesOut.timedOut ||
    trackedPlanClaimsOut.timedOut || plansOut.timedOut

  return {
    claims: claimsOut.result,
    personalPlanContributions: planContributionsOut.result,
    trackedPlanUpdates: trackedPlanUpdatesOut.result,
    trackedPlanClaims: trackedPlanClaimsOut.result,
    plansNearby: plansOut.result,
    anyTruncated,
  }
}
