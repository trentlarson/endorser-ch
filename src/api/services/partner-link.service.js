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
const DEFAULT_RELAY = DEFAULT_RELAYS[2] // manasiwibi seems to be the most reliable of the four

useWebSocketImplementation(WebSocket)

export async function sendAndStoreLink(issuer, jwtId, linkCode, inputJson, userNostrPubKeyHex) {
  const jwtLinkInfo = await dbService.jwtAndPartnerLinkForCode(jwtId, linkCode)
  if (!jwtLinkInfo) {
    return { clientError: { message: "No JWT exists for " + linkCode + " with ID " + jwtId } }
  } else if (jwtLinkInfo.issuer !== issuer) {
    return { clientError: { message: "You are not the issuer of JWT " + jwtId } }
  } else if (jwtLinkInfo.linkCode) {
    return { clientError: { message: "JWT " + jwtId + " already has '" + jwtLinkInfo.linkCode + "' link with data: " + jwtLinkInfo.data } }
  }
  if (linkCode === 'NOSTR-EVENT-TRUSTROOTS') {
    const claim = JSON.parse(jwtLinkInfo.claim)
    // see constants at https://github.com/Trustroots/nostroots-server/blob/48517a866994092e1112683ad1acea652b2b0f0a/common/constants.ts
    if (!claim.location?.geo?.latitude || !claim.location?.geo?.longitude) {
      return {clientError: {message: "A nostr event for Trustroots requires a claim with location.geo.latitude and location.geo.longitude"}}
    }
    const plusCode = pluscodes.encode({
      latitude: claim.location.geo.latitude,
      longitude: claim.location.geo.longitude,
    })
    const moreTags = [
      ["L", "open-location-code"], // OPEN_LOCATION_CODE_NAMESPACE_TAG
      ["l", plusCode, "open-location-code"], // OPEN_LOCATION_CODE_NAMESPACE_TAG
    ]
    const kind = 30398 // MAP_NOTE_REPOST_KIND, custom to them
    return createAndSendNostr(jwtLinkInfo, linkCode, kind, inputJson, userNostrPubKeyHex, moreTags)

  } else if (linkCode === 'NOSTR-EVENT-TRIPHOPPING') {
    const claim = JSON.parse(jwtLinkInfo.claim)
    if (!claim.location?.geo?.latitude || !claim.location?.geo?.longitude) {
      return {clientError: {message: "A nostr event for TripHopping requires a claim with location.geo.latitude and location.geo.longitude"}}
    }
    const plusCode10 = pluscodes.encode({
      latitude: claim.location.geo.latitude,
      longitude: claim.location.geo.longitude,
    })
    const plusCode8 = pluscodes.encode({
      latitude: claim.location.geo.latitude,
      longitude: claim.location.geo.longitude,
    }, 8)
    const plusCode4 = pluscodes.encode({
      latitude: claim.location.geo.latitude,
      longitude: claim.location.geo.longitude,
    }, 4)
    const moreTags = [
      ["t", "timesafari"],
      ["g", plusCode10],
      ["g", plusCode8],
      ["g", plusCode4],
    ]
    const kind = 30402 // creator says to use the classifieds for his map
    return createAndSendNostr(jwtLinkInfo, linkCode, kind, inputJson, userNostrPubKeyHex, moreTags)

  } else {
    return { clientError: { message: "Unknown link code '" + linkCode + "'" } }
  }

  async function createAndSendNostr(jwtLinkInfo, linkCode, kind, inputJson, userNostrPubKeyHex, moreTags) {
    if (!NOSTR_PRIVATE_KEY_NSEC) {
      return {clientError: {message: "This server is not set up to relay to nostr."}}
    }
    if (!userNostrPubKeyHex) {
      return { clientError: { message: "No nostr public key was provided." } }
    }
    const claim = JSON.parse(jwtLinkInfo.claim)
    const input = JSON.parse(inputJson)
    const content = input || basicClaimDescription(claim)
    const createdSecs = Math.floor(new Date(jwtLinkInfo.issuedAt).getTime() / 1000)
    const event = {
      content,
      created_at: createdSecs,
      kind: kind,
      tags: [
        ["p", userNostrPubKeyHex],
        ...moreTags,
      ],
    };
    if (claim.endTime || claim.validThrough) {
      const expirationTime = Math.floor(new Date(claim.endTime || claim.validThrough).getTime() / 1000)
      event.tags.push([ "expiration", `${expirationTime}` ])
    } else if (process.env.NODE_ENV !== 'prod') { // add expiration in non-prod environments
      event.tags.push([ "expiration", `${createdSecs + 60 * 60 * 24 * 2}` ])
    }
    let relay
    try {
      const privateKeyBytes = decode(NOSTR_PRIVATE_KEY_NSEC).data
      // this adds: pubkey, id, sig
      const signedEvent = await finalizeEvent(event, privateKeyBytes)
      relay = await Relay.connect(DEFAULT_RELAY)
      relay.subscribe(
        [ { ids: [signedEvent.id] } ],
        { onevent(event) { l.info('Event recognized by relay:', event) } }
      )
      // remove after testing
      // const serverPubKeyHex = getPublicKey(privateKeyBytes)
      // relay.subscribe(
      //   [ { kinds: [kind], authors: [serverPubKeyHex] } ],
      //   { onevent(event) { l.info('Server events recognized by relay:', event) } }
      // )
      await relay.publish(signedEvent)
      const partnerLinkData = JSON.stringify({content: content, pubKeyHex: userNostrPubKeyHex})
      await dbService.partnerLinkInsert(
        {handleId: jwtLinkInfo.jwtHandleId, linkCode, externalId: signedEvent.id, data: partnerLinkData}
      )
      return {signedEvent}
    } catch (e) {
      l.error("Error creating " + linkCode + " event for JWT " + jwtId + ": " + e)
      return {error: "Error creating " + linkCode + " event for JWT " + jwtId + ": " + e}
    } finally {
      setTimeout(
        () => {
          relay.close();
          l.info("Closed relay.")
        },
        // wait so that we record an onevent from the subscription
        3000,
      )
    }
  }
}
