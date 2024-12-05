/**
 * You'll notice that this functionality is not only separated by functionality
 * but the DB is also entirely separate: this data includes info from outside
 * services and can be used to correlate the user across domains. We want to
 * avoid that, and eventually make this into an entirely separate server all
 * on it's own. That way we can have a service that makes money and offers
 * extended services but we have architectural lines that keep us from
 * correlating customer data by accident.
 */

import crypto from "crypto"
import { encodeBase32 as geohashEncodeBase32 } from "geohashing"
import { SimplePool } from 'nostr-tools/pool'
import { Event, finalizeEvent } from "nostr-tools/pure"
import { Relay, useWebSocketImplementation } from "nostr-tools/relay"
import { decode } from "nostr-tools/nip19"
import * as pluscodes from "pluscodes"
import { schnorr } from "@noble/curves/secp256k1" // used for nostr, imported by nostr-tools
import WebSocket from "ws"

import l from "../../common/logger"
import { dbService } from "./endorser.db.service"
import { basicClaimDescription } from "./util"

const NOSTR_PRIVATE_KEY_NSEC = process.env.NOSTR_PRIVATE_KEY_NSEC

const DEFAULT_RELAYS = [
  "wss://nos.lol",
  "wss://nostr.manasiwibi.com",
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://relay.trustroots.org",
]
const DEFAULT_RELAY = DEFAULT_RELAYS[4] // besides trustroots, manasiwibi seems to be the most reliable, at least for showing on https://lightningk0ala.github.io/nostr-wtf/query

useWebSocketImplementation(WebSocket)

export async function sendAndStoreLink(
  issuer,
  jwtId,
  linkCode,
  inputJson,
  pubKeyHex,
  pubKeyImage,
  pubKeySigHex,
) {
  // When we separate this into another service, this will have to be an API call.
  // See the image-api server for an example of how to leverage JWTs to get
  // permission to access data from the other service.
  const jwtInfo = await dbService.jwtById(jwtId)

  const linkInfo = await dbService.partnerLinkForCode(jwtInfo.handleId, linkCode)

  if (!jwtInfo) {
    return { clientError: { message: "No JWT exists for " + jwtId } }
  } else if (jwtInfo.issuer !== issuer) {
    return { clientError: { message: "You are not the issuer of JWT " + jwtId } }
  } else if (linkInfo) {
    return { clientError: { message: "JWT " + jwtId + " already has '" + linkInfo.linkCode + "' link with data: " + linkInfo.data } }
  }
  // check that public key matches this issuer's DID

  if (linkCode === "NOSTR-EVENT-TRUSTROOTS") {
    // Check that the Ethereum derived address matches the Nostr public key
    const pubKeyCheck = validateNostrSignature(pubKeyImage, pubKeyHex, pubKeySigHex)
    if (!pubKeyCheck) {
      return { clientError: { message: "The signature does not match the public key provided." } }
    }

    const claim = JSON.parse(jwtInfo.claim)
    // see constants at https://github.com/Trustroots/nostroots-server/blob/48517a866994092e1112683ad1acea652b2b0f0a/common/constants.ts
    if (!claim.location?.geo?.latitude || !claim.location?.geo?.longitude) {
      return { clientError: { message: "A nostr event for Trustroots requires a claim with location.geo.latitude and location.geo.longitude" } }
    }
    const plusCode = pluscodes.encode({
      latitude: claim.location.geo.latitude,
      longitude: claim.location.geo.longitude,
    })
    const moreTags = [
      ["L", "open-location-code"], // OPEN_LOCATION_CODE_NAMESPACE_TAG
      ["l", plusCode, "open-location-code"], // OPEN_LOCATION_CODE_NAMESPACE_TAG
      ["t", "timesafari"],
      [
        "original_created_at",
        `${Math.floor(new Date(jwtInfo.issuedAt).getTime() / 1000)}`,
      ],
    ]
    const kind = 30398 // MAP_NOTE_REPOST_KIND, custom to them
    return createAndSendNostr(
      jwtInfo,
      linkCode,
      kind,
      inputJson,
      moreTags,
      pubKeyHex,
      pubKeyImage,
      pubKeySigHex,
    )
  } else if (linkCode === "NOSTR-EVENT-TRIPHOPPING") {
    // Check that the Ethereum derived address matches the Nostr public key
    const pubKeyCheck = validateNostrSignature(pubKeyImage, pubKeyHex, pubKeySigHex)
    if (!pubKeyCheck) {
      return { clientError: { message: "The signature does not match the public key provided." } }
    }

    const claim = JSON.parse(jwtInfo.claim)
    if (!claim.location?.geo?.latitude || !claim.location?.geo?.longitude) {
      return { clientError: { message: "A nostr event for TripHopping requires a claim with location.geo.latitude and location.geo.longitude" } }
    }
    const geohash8 = geohashEncodeBase32(claim.location.geo.latitude, claim.location.geo.longitude, 8)
    const geohash6 = geohashEncodeBase32(claim.location.geo.latitude, claim.location.geo.longitude, 6)
    const geohash4 = geohashEncodeBase32(claim.location.geo.latitude, claim.location.geo.longitude, 4)
    const geohash2 = geohashEncodeBase32(claim.location.geo.latitude, claim.location.geo.longitude, 2)
    const moreTags = [
      ["g", geohash8],
      ["g", geohash6],
      ["g", geohash4],
      ["g", geohash2],
      ["t", "timesafari"],
      // ["location", "Lusaka, Zambia"],
      // ["price", "0", "USD"],
      // ["published_at", `${Math.floor(new Date(jwtInfo.issuedAt).getTime() / 1000)}`],
      // ["status", "sold"],
      // ["summary", JSON.parse(inputJson)],
      // ["title", JSON.parse(inputJson)],
    ]
    const kind = 30402 // creator says to use the classifieds for his map
    return createAndSendNostr(
      jwtInfo,
      linkCode,
      kind,
      inputJson,
      moreTags,
      pubKeyHex,
      pubKeyImage,
      pubKeySigHex,
    )
  } else {
    return { clientError: { message: "Unknown link code '" + linkCode + "'" } }
  }

  // We have validated that the sender with the Authorization header is the sender,
  // and we are also sending a public key so we need to verify that they own it.
  function validateNostrSignature(eventImage, pubKeyHex, sigHex) {
    // I actually tried to use the nostr-tools/pure verifyEvent but it didn't recognize "kind" as a number. :-S
    const hash = crypto.createHash("sha256").update(new TextEncoder().encode(eventImage)).digest("hex")
    const sigCheck = schnorr.verify(sigHex, hash, pubKeyHex)
    return sigCheck
  }

  async function createAndSendNostr(
    jwtInfo,
    linkCode,
    kind,
    inputJson,
    moreTags,
    pubKeyHex,
    pubKeyImage,
    pubKeySigHex,
  ) {
    if (!NOSTR_PRIVATE_KEY_NSEC) {
      return {
        clientError: {
          message: "This server is not set up to relay to nostr.",
        },
      }
    }
    if (!pubKeyHex) {
      return { clientError: { message: "No nostr public key was provided." } }
    }
    const claim = JSON.parse(jwtInfo.claim)
    const input = JSON.parse(inputJson)
    const content = input || basicClaimDescription(claim)
    const createdSecs = Math.floor(new Date(jwtInfo.issuedAt).getTime() / 1000)
    const event = {
      content,
      created_at: createdSecs,
      kind: kind,
      tags: [
        ["d", pubKeyHex + ":" + jwtInfo.id],
        ["p", pubKeyHex],
        ...moreTags,
      ],
    }
    if (claim.endTime || claim.validThrough) {
      const expirationTime = Math.floor(
        new Date(claim.endTime || claim.validThrough).getTime() / 1000,
      )
      event.tags.push(["expiration", `${expirationTime}`])
    } else if (process.env.NODE_ENV !== "prod") {
      // add an expiration in non-prod environments
      event.tags.push(["expiration", `${createdSecs + 60 * 60 * 24 * 2}`])
    }
    let relay
    try {
      const privateKeyBytes = decode(NOSTR_PRIVATE_KEY_NSEC).data
      // this adds: pubkey, id, sig
      const signedEvent = await finalizeEvent(event, privateKeyBytes)

      //console.log("Signed event:", signedEvent)

      // Pool of relays
      const pool = new SimplePool()
      const closer = pool.subscribeMany(
        DEFAULT_RELAYS,
        [ { ids: [signedEvent.id] } ],
        {
          // this will only be called once the first time the event is received
          onevent(event) { l.info("Event recognized by relay pool:", event) },
          oneose() { closer.close() }
        }
      )
      await Promise.any(pool.publish(DEFAULT_RELAYS, signedEvent))

      // // One relay
      // relay = await Relay.connect(DEFAULT_RELAY)
      // relay.subscribe(
      //   [{ ids: [signedEvent.id] }], /* ... kinds: [kind], authors: [getPublicKey(privateKeyBytes)] */
      //   {
      //     onevent(event) { l.info("Event recognized by one relay:", event) },
      //     oneose() { relay.close() }
      //   }
      // );
      // await relay.publish(signedEvent)

      const partnerLinkData = JSON.stringify({ content, pubKeyHex })
      await dbService.partnerLinkInsert({
        handleId: jwtInfo.handleId,
        linkCode,
        externalId: signedEvent.id,
        data: partnerLinkData,
        pubKeyHex,
        pubKeyImage,
        pubKeySigHex,
      })
      return { signedEvent }
    } catch (e) {
      l.error("Error creating " + linkCode + " event for JWT " + jwtId + ": " + e)
      return { error: "Error creating " + linkCode + " event for JWT " + jwtId + ": " + e }
    }
  }
}
