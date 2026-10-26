/**
 * Alert search parameters and change-sequence cursors, for both the main and
 * the partner alertSearch endpoints. Nothing here reads a DB, so partner code
 * can use these without reaching the main service.
 */

import { decodeTime } from 'ulidx'
import { globalId } from './util'

/** Crockford base32: 0-9, A-Z excluding I, L, O, U. ULID is 26 chars. */
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/

/**
 * Normalize alertSearch params from either POST body or GET query.
 * Returns { afterCursor, beforeCursor, afterId, beforeId, afterDate, beforeDate, location, similarLocation, planHandleIds, paramErrors }.
 * The cursors and similarLocation are passed through as given, for the routers to validate.
 */
export function alertSearchParamsFromRequest(req) {
  const isGet = req.method === 'GET'
  // GET: query only. An empty JSON body `{}` must not hide req.query.beforeId.
  const src = isGet ? req.query : req.body
  const afterCursor = src?.afterCursor
  const beforeCursor = src?.beforeCursor
  const afterId = src?.afterId
  const beforeId = src?.beforeId
  const afterDate = src?.afterDate
  const beforeDate = src?.beforeDate
  const similarLocation = src?.similarLocation
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
  return { afterCursor, beforeCursor, afterId, beforeId, afterDate, beforeDate, location, similarLocation, planHandleIds, paramErrors }
}

/****************************************************************
 * Change-sequence cursors. See CHANGE/PLAN-accurate-cursors.md
 *
 * A cursor is a position between changes: the value p sits right after the
 * change numbered p. afterCursor selects changes after it (changeSeq > p),
 * beforeCursor selects changes before it (changeSeq <= p).
 **/

const ENDORSER_CURSOR_REGEX = /^\d{1,15}$/
const PARTNER_CURSOR_REGEX = /^(\d{1,15})-(\d{1,15})$/

function badCursorMessage(paramName) {
  return `Parameter '${paramName}' must be the 'nextAfterCursor' or 'nextBeforeCursor' value of an earlier response.`
}

/**
 * Read an endorser cursor: a position in the main DB's changes.
 * @param {string|number|undefined} value
 * @param {string} paramName - for the error message
 * @returns {{ cursor: number|null, error?: string }} cursor is null when none was given
 */
export function parseEndorserCursor(value, paramName) {
  if (value == null || value === '') {
    return { cursor: null }
  }
  if (!ENDORSER_CURSOR_REGEX.test(String(value))) {
    return { cursor: null, error: badCursorMessage(paramName) }
  }
  return { cursor: Number(value) }
}

/**
 * Read a partner cursor: a position in the partner DB's changes, then in the main DB's.
 * @param {string|undefined} value
 * @param {string} paramName - for the error message
 * @returns {{ cursor: {partner: number, main: number}|null, error?: string }} cursor is null when none was given
 */
export function parsePartnerCursor(value, paramName) {
  if (value == null || value === '') {
    return { cursor: null }
  }
  const match = String(value).match(PARTNER_CURSOR_REGEX)
  if (!match) {
    return { cursor: null, error: badCursorMessage(paramName) }
  }
  return { cursor: { partner: Number(match[1]), main: Number(match[2]) } }
}

/**
 * @returns {string} the cursor for the given positions, as a client sends it back
 */
export function partnerCursor(partnerSeq, mainSeq) {
  return partnerSeq + '-' + mainSeq
}

/** @returns {string|undefined} a message when ID or date bounds are sent along with a cursor */
export function ignoredWithCursorMessage(params) {
  const ignored = ['afterId', 'beforeId', 'afterDate', 'beforeDate'].filter((key) => params[key] != null && params[key] !== '')
  return ignored.length === 0
    ? undefined
    : "With 'afterCursor' or 'beforeCursor', these parameters are ignored: " + ignored.join(', ') + "."
}

export const CURSOR_RESET_MESSAGE = "The 'afterCursor' is beyond this server's latest change (perhaps it came from another server, or the data was restored), so it was reset to the latest change."

/**
 * The change-sequence window for a request with cursors, clamped to the counter.
 * @param {number|null} after - afterCursor position, or null
 * @param {number|null} before - beforeCursor position, or null
 * @param {number} counter - the latest change
 * @returns {{ after: number, upTo: number, descending: boolean }} changes after < changeSeq <= upTo;
 *   descending (newest first) when paging back with beforeCursor
 */
export function cursorWindow(after, before, counter) {
  const lower = after ?? 0
  return before == null
    ? { after: lower, upTo: counter, descending: false }
    : { after: lower, upTo: Math.max(lower, Math.min(before, counter)), descending: true }
}

/**
 * Cut lists that were each read inside one change-sequence window, so that
 * together they cover one contiguous range of changes. A list that hit its
 * limit may have more rows; every list is trimmed to match the one that
 * reaches least far.
 *
 * @param {Object<string, {data: Array<{changeSeq: number}>, hitLimit: boolean}>} lists - each ordered by
 *   changeSeq, ascending or (when window.descending) descending
 * @param {{after: number, upTo: number, descending: boolean}} window - the window the lists were read in
 * @returns {{ lists: Object<string, Array>, next: number, hasMore: boolean }} lists hold the trimmed rows;
 *   next is the cursor to continue from in the same direction: the next afterCursor when ascending,
 *   the next beforeCursor when descending
 */
export function cutListsAtLimit(lists, window) {
  let reach = window.descending ? window.after : window.upTo
  let hasMore = false
  for (const { data, hitLimit } of Object.values(lists)) {
    if (hitLimit && data.length > 0) {
      hasMore = true
      const last = data[data.length - 1].changeSeq
      // descending: keep only down to the highest of the lowest rows; ascending, up to the lowest of the highest
      reach = window.descending ? Math.max(reach, last - 1) : Math.min(reach, last)
    }
  }
  const trimmed = {}
  for (const [key, { data }] of Object.entries(lists)) {
    trimmed[key] = data.filter((row) => (window.descending ? row.changeSeq > reach : row.changeSeq <= reach))
  }
  return { lists: trimmed, next: reach, hasMore }
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

function parseDateToIso(dateStr, paramName, paramErrors) {
  if (dateStr == null || typeof dateStr !== 'string') return undefined
  const ms = new Date(dateStr).getTime()
  if (Number.isNaN(ms)) {
    paramErrors.push(`${paramName} must be a valid ISO date string if provided.`)
    return undefined
  }
  return new Date(ms).toISOString()
}

/**
 * Compute effective after/before date bounds for partner alert search (profiles).
 * Prioritizes afterDate/beforeDate when supplied; otherwise derives from afterId/beforeId.
 * Returns { afterDateIso, beforeDateIso, paramErrors }.
 */
export function resolveAlertSearchDateBoundsForPartner(afterId, beforeId, afterDate, beforeDate, paramErrors = []) {
  if (paramErrors == null) paramErrors = []
  let afterDateIso = parseDateToIso(afterDate, 'afterDate', paramErrors)
  if (afterDateIso == null && afterId != null && typeof afterId === 'string') {
    if (ULID_REGEX.test(afterId)) {
      afterDateIso = new Date(decodeTime(afterId)).toISOString()
    } else {
      paramErrors.push("afterId must be a valid ULID if provided.")
    }
  }
  if (afterDateIso == null) {
    afterDateIso = new Date(0).toISOString()
  }

  let beforeDateIso = parseDateToIso(beforeDate, 'beforeDate', paramErrors)
  if (beforeDateIso == null && beforeId != null && typeof beforeId === 'string') {
    if (ULID_REGEX.test(beforeId)) {
      beforeDateIso = new Date(decodeTime(beforeId)).toISOString()
    } else {
      paramErrors.push("beforeId must be a valid ULID if provided.")
    }
  }

  return { afterDateIso, beforeDateIso: beforeDateIso ?? undefined, paramErrors }
}
