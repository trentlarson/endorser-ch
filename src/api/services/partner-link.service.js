import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
import { Relay, useWebSocketImplementation } from 'nostr-tools/relay'
import { decode } from 'nostr-tools/nip19'
import * as pluscodes from "pluscodes"
import WebSocket from 'ws'

import l from '../../common/logger'
import { dbService } from './endorser.db.service'
import { basicClaimDescription } from "./util"

const NOSTR_PRIVATE_KEY_NSEC = process.env.NOSTR_PRIVATE_KEY_NSEC

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://nostr.manasiwibi.com",
  "wss://nos.lol",
]
const DEFAULT_RELAY = DEFAULT_RELAYS[2] // most reliable of the four

useWebSocketImplementation(WebSocket)

export async function sendAndStoreLink(issuer, jwtId, linkCode, userNostrPubKeyHex, inputJson) {
  if (!userNostrPubKeyHex) {
      return { clientError: { message: "No Trustroots public key was provided." } }
  }
  const jwtLinkInfo = await dbService.jwtAndPartnerLinkForCode(jwtId)
  if (!jwtLinkInfo) {
    return { clientError: { message: "No JWT exists with ID " + jwtId } }
  } else if (jwtLinkInfo.issuer !== issuer) {
    return { clientError: { message: "You are not the issuer of JWT " + jwtId } }
  } else if (jwtLinkInfo.linkCode) {
    return { clientError: { message: "JWT " + jwtId + " already has '" + jwtLinkInfo.linkCode + "' link with data: " + jwtLinkInfo.data } }
  }
  const claim = JSON.parse(jwtLinkInfo.claim)
  if (linkCode === 'NOSTR-EVENT-TRUSTROOTS') {
    if (!NOSTR_PRIVATE_KEY_NSEC) {
      return { clientError: { message: "This server is not set up to relay to nostr." } }
    }
    if (!claim.location?.geo?.latitude || !claim.location?.geo?.longitude) {
      return { clientError: { message: "A nostr event for Trustroots requires a claim with location.geo.latitude and location.geo.longitude" } }
    }
    const input = JSON.parse(inputJson)
    const content = input || basicClaimDescription(claim)
    const createdSecs = Math.floor(new Date(jwtLinkInfo.issuedAt).getTime() / 1000)
    let expirationTime = ''
    if (claim.endTime || claim.validThrough) {
      expirationTime = Math.floor(new Date(claim.endTime || claim.validThrough).getTime() / 1000)
    }
    const plusCode = pluscodes.encode({
      latitude: claim.location.geo.latitude,
      longitude: claim.location.geo.longitude,
    })
    // see constants at https://github.com/Trustroots/nostroots-server/blob/48517a866994092e1112683ad1acea652b2b0f0a/common/constants.ts
    const event = {
      content,
      created_at: createdSecs,
      kind: 30398, // MAP_NOTE_REPOST_KIND
      tags: [
        [ "L", "open-location-code" ], // OPEN_LOCATION_CODE_NAMESPACE_TAG
        [ "l", plusCode, "open-location-code" ], // OPEN_LOCATION_CODE_NAMESPACE_TAG
        [ "p", userNostrPubKeyHex ],
      ],
    };
    if (claim.endTime || claim.validThrough) {
      const expirationTime = Math.floor(new Date(claim.endTime || claim.validThrough).getTime() / 1000)
      event.tags.push([ "expiration", `${expirationTime}` ])
    } else if (process.env.NODE_ENV !== 'prod') { // add expiration in non-prod environments
      event.tags.push([ "expiration", `${createdSecs + 60 * 60 * 24 * 2}` ])
    }
    try {
      const privateKeyBytes = decode(NOSTR_PRIVATE_KEY_NSEC).data
      // this adds: pubkey, id, sig
      const signedEvent = await finalizeEvent(event, privateKeyBytes)
      const relay = await Relay.connect(DEFAULT_RELAY)
      const serverPubKeyHex = getPublicKey(privateKeyBytes)
      relay.subscribe(
        [ { kinds: [30398], authors: [serverPubKeyHex] } ],
        { onevent(event) { l.info('Event recognized by relay:', event) } }
      )
      await relay.publish(signedEvent)
      const partnerLinkData = JSON.stringify({ id: signedEvent.id })
      await dbService.partnerLinkInsert(jwtId, linkCode, partnerLinkData)
      setTimeout(
        () => { relay.close(); l.info("Closed relay.") },
        3000
      ) // wait to see if we get an onevent from the subscription

      return { signedEvent }
    } catch (e) {
      return { error: "Error creating event: " + e }
    }
  } else {
    return { clientError: { message: "Unknown link code '" + linkCode + "'" } }
  }

}
