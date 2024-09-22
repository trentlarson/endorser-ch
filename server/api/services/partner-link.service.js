//import * as nostrify from "@nostrify/nostrify";
import * as pluscodes from "pluscodes"

import { dbService } from './endorser.db.service'
import { basicClaimDescription } from "./util"

const NOSTR_PRIVATE_KEY_NSEC = process.env.NOSTR_PRIVATE_KEY_NSEC

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://nostr.manasiwibi.com",
  "wss://nos.lol",
]

// see https://github.com/Trustroots/nostroots-server/blob/48517a866994092e1112683ad1acea652b2b0f0a/validation/repost.ts#L20
async function getRelayPool() {
  const relays = DEFAULT_RELAYS;
  const { NPool, NRelay1 } = nostrify;

  // should be chosen according to outbox model
  // https://nostrify.dev/relay/outbox
  const pool = new NPool({
    open(url) {
      return new NRelay1(url);
    },
    async reqRouter(filter /** nostrify.NostrFilter[] **/) {
      const map = new Map();
      relays.map((relay) => {
        map.set(relay, filter);
      });
      return map;
    },
    async eventRouter(_event) {
      return relays;
    },
  });

  return pool;
}

export async function sendAndStoreLink(issuer, jwtId, linkCode, nostrPubKeyHex, inputJson) {
  return {} // until we get things working
  const { NSecSigner } = nostrify

  if (!nostrPubKeyHex) {
    return { clientError: "No Trustroots public key was provided." }
  }
  const jwtLinkInfo = await dbService.jwtAndPartnerLinkForCode(jwtId)
  if (!jwtLinkInfo) {
    return { clientError: "No JWT exists with ID " + jwtId}
  } else if (jwtLinkInfo.issuer !== issuer) {
    return { clientError: "You are not the issuer of JWT " + jwtId}
  } else if (jwtLinkInfo.linkCode) {
    return { clientError: "JWT " + jwtId + " already has '" + jwtLinkInfo.linkCode + "' link with data: " + jwtLinkInfo.data }
  }
  const claim = JSON.parse(jwtLinkInfo.claim)
  if (linkCode === 'NOSTR-EVENT-TRUSTROOTS') {
    if (!NOSTR_PRIVATE_KEY_NSEC) {
      return { clientError: "This server is not set up to relay to nostr." }
    }
    if (!claim.location?.geo?.latitude || !claim.location?.geo?.longitude) {
      return { clientError: "A nostr event for Trustroots requires a claim with location.geo.latitude and location.geo.longitude" }
    }
    const input = JSON.parse(inputJson)
    const content = basicClaimDescription(claim) + (input ? " - " + input : "")
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
        [ "expiration", `${expirationTime}` ],
        [ "L", "open-location-code" ], // OPEN_LOCATION_CODE_NAMESPACE_TAG
        [ "l", plusCode, "open-location-code" ], // OPEN_LOCATION_CODE_NAMESPACE_TAG
        [ "p", nostrPubKeyHex ],
      ],
    };
    try {
      const signer = new NSecSigner(NOSTR_PRIVATE_KEY_NSEC);
      const signedEvent = await signer.signEvent(event);
      const relayResult = await getRelayPool().event(signedEvent);
      console.log("added my event!!!!!!!!!!! ", signedEvent, relayResult);
      return { relayResult }
    } catch (e) {
      return { error: "Error creating event: " + e }
    }
  } else {
    return { clientError: "Unknown link code '" + linkCode + "'" }
  }

}
