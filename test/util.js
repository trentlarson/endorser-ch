/**
   Load and run this file with: npm install esm; LOG_LEVEL=info node -r esm

   Some of this is copied in the endorser-auth package (eg. test.js).
**/

import R from 'ramda'
import { HIDDEN_TEXT, isDid } from '../server/api/services/util'

const { Credentials } = require('uport-credentials')

const NOW_EPOCH = Math.floor(new Date().getTime() / 1000)
const TOMORROW_EPOCH = NOW_EPOCH + (24 * 60 * 60)


/**
 @return true if all DIDs are either hidden or exceptDid
 @exceptDid is optional
 **/
function allDidsAreHidden(result, exceptDid) {
  if (Object.prototype.toString.call(result) === "[object String]") {
    if (isDid(result) && result !== HIDDEN_TEXT && result !== exceptDid) {
console.log('result and exceptDid', result, exceptDid)
      return false
    } else {
      return true
    }
  } else if (result instanceof Object) {
    var values
    if (Array.isArray(result)) {
      values = result
    } else {
      // assuming it's an object since it's not an array
      // (Hmmmm... this is inconsistent with other methods where the keys aren't checked.)
      values = R.keys(result).concat(R.values(result))
    }
    return R.reduce((a,b) => a && b, true, R.map(allDidsAreHiddenFor(exceptDid), values))
  } else {
    return true
  }
}

const allDidsAreHiddenFor = (exceptDid) => (result) => allDidsAreHidden(result, exceptDid)

const CREDS = [
  // those with mnemonic created by @ethersproject/hdnode: HDNode.fromMnemonic(bip39.entropyToMnemonic(crypto.randomBytes(32))).derivePath("m/7696500'/0'/0'/0'")
  // ... and the rest created by Credentials.createIdentity()

  { did: 'did:ethr:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51', privateKey: '01a3172cd9e334210b2669dce737d435beefe5c99802ded607c44cd85c96666b' }, // seminar accuse mystery assist delay law thing deal image undo guard initial shallow wrestle list fragile borrow velvet tomorrow awake explain test offer control
  { did: 'did:ethr:0x111c4aCD2B13e26137221AC86c2c23730c9A315A', privateKey: '75fc2f133b27078d4b6bf61e90d31d240f9fa7eb8edb30289264374e82c05da6' }, // average mammal spice rebuild volume border tail bracket else absent sniff connect praise tennis twice inquiry summer crawl job nurse sister account tooth follow
  { did: 'did:ethr:0x2224EA786b7C2A8E5782E16020F2f415Dce6bFa7', privateKey: '1c9686218830e75f4c032f42005a99b424e820c5094c721b17e5ccb253f001e4' }, // annual soap surround inhale island jewel blush rookie gate aerobic brave enlist bird nut remain cross undo surround year rapid blade impulse control broccoli
  { did: 'did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a', privateKey: 'b53089b38411ebda74f3807b810cc28f1bd3f9d8baf4e70fe81cd4f89537bbf9' }, // story wine milk orbit that mountain bus harvest piano warm idea pigeon major gallery check limit pond people torch use labor flock type pond
  { did: 'did:ethr:0x444D276f087158212d9aA4B6c85C28b9F7994AAC', privateKey: 'e7aea73ba5b9b45136bc1bf62b7ecedcd74ae4ec87d0378aeea551c1c14b3fc5' }, // mad insect spread pluck ready surround front table ghost present credit repair rather repair lobster fragile bleak okay loud dose cruel success wash credit
  { did: 'did:ethr:0x55523607353c874D88bC7B6B6E434C4F6945F3A4', privateKey: '946a5d7e7b950b0a1e5da7f510db32f028c8f01574e47097f618dc4de5de2d1c' }, // egg stick repeat attack discover shoe below strategy occur copy wish hour belt marriage gravity common illness film then sword aerobic apology seminar border
  { did: 'did:ethr:0x666fb9f5AE22cB932493a4FFF1537c2420E0a4D3', privateKey: '5ee77cc7819803c0c3468683d15336647b16ef7967db93226ac634a5761a4678' }, // situate plate artwork math error castle knock fitness museum they list library buyer village rail screen prosper hockey bless south matter message whale arrive
  { did: 'did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc', privateKey: 'd1e46db1bcbeef7e94f49ad2624b185e635609bea51f856fe9a2b2c44e0a04a2' }, // lonely stage long vote amateur web churn aspect neck cheese display wreck empty flock luggage number dynamic catalog soon they merit cactus naive diagram
  { did: 'did:ethr:0x888f266617cf244116362C90dA1731D6A2F1f4DD', privateKey: 'cfcba0f6e1aff4e72f3909e0168eca77e094e9635a66d3cca37c3bef4e35811c' }, // elite muscle claw steel amazing recipe addict cable tool office lava eager once whale audit wild avoid trade urge kick december draw glare sense
  { did: 'did:ethr:0x999BFe538DfC795FbcfEDe2D95C3BB3067CA3Ee3', privateKey: '82a115b095e03bd28a06fe294887d99a270145591b5d291acf80d3574a8e558f' }, // bag always embrace army fresh pretty buzz idea pear alien size property chalk hidden nothing credit pill wolf anger shrimp design glue zebra jealous
  { did: 'did:ethr:0xaaa808B42C3Cb12c6ca7110E327284028214657D', privateKey: 'e76b01b8af46082608753a907d926264e1700fc309fbef2f68380147be97ee7d' }, // grant stay suggest style antique upon scout evidence animal example live demand have erase congress hurry frequent network foot welcome struggle wave popular marble
  { did: 'did:ethr:0xbbbe0e5Af02D327d33C280855d478FFa57FBab70', privateKey: '86c72e586ceb818ab3e8bedab4a250e08dd9f0df2d483374c0c5f07452e8ba40' }, // claim brother drift deputy gaze emerge bunker vibrant game ski crucial myself attitude slush crew home crater guide second scout lonely earth chaos tunnel
  { did: 'did:ethr:0xccc0B0759Dbe2c49D3862f6F403Fae94dD905FC9', privateKey: '8a62b154e40a6a9839a8d0275d2886df05495dc2123ecabd0cb4719cd23630c4' }, // blue still absent awake casual always magnet item until undo release satoshi surface attract learn ridge security minimum grid clinic license lawn skate illness
  { did: 'did:ethr:0xddd3ef4cf2900f048b01713d50f61d232c2731ee', privateKey: '39482d2c39e9def860cf9f48facfe67a16c45209ecfba9c12bfc5bf831d80dc6' }, // wild fish nuclear scheme bamboo large solid express already rookie hire jump add announce thank spoon law pull bless cancel outside plate allow admit
  { did: 'did:ethr:0xeeeb9589823e0baef3635726006e611da7a715b9', privateKey: 'cb4ad57b266a628eb0b7ff74754d661ce036420cd1335720f53c31b5e74c268d' }, // arrest claim way idea hat wrap execute girl noble task march web capital this thrive time small erupt public tortoise violin one forest abandon
  { did: 'did:ethr:0xffff7def6267bedac4bd8bb2fa9128e8698b3d2f', privateKey: '741cc1ad98494afd4a9b9219b678e213fd5a27f6dd7822350d011430b0018e6d' }, // history loyal voice arm upper energy night interest vacuum swap siren economy siren tomorrow kick gain possible disorder scan same move wheat artefact notice
  ]

const CREDENTIALS = R.map((c) => new Credentials(c), CREDS)

module.exports = {

  creds: CREDS,

  credentials: CREDENTIALS,

  nowEpoch: NOW_EPOCH,

  tomorrowEpoch: NOW_EPOCH + (24 * 60 * 60),

  jwtTemplate: {
    "iat": NOW_EPOCH,
    "exp": TOMORROW_EPOCH,
    // supply "sub"
    // supply "claim", usually including same DID of "sub"
    // supply "iss"
  },

  registrationTemplate: {
    "@context": "https://schema.org",
    "@type": "RegisterAction",
    "agent": { "did": null }, // supply DID
    "object": { "did": null }, // supply DID
  },

  confirmationTemplate: {
    "@context": "https://schema.org",
    "@type": "AgreeAction",
    "object": [
      // supply claims
    ]
  },

  claimCornerBakery: {
    "@context": "https://endorser.ch",
    "@type": "Tenure",
    "spatialUnit": {
      "geo": {
        "@type": "GeoShape",
        "polygon": "40.883944,-111.884787 40.884088,-111.884787 40.884088,-111.884515 40.883944,-111.884515 40.883944,-111.884787"
      }
    },
    "party": {
      // supply "did"
    }
  },

  claimFoodPantry: {
    "@context": "https://endorser.ch",
    "@type": "Tenure",
    "spatialUnit": {
      "geo": {
        "@type": "GeoShape",
        "polygon": "40.890431,-111.870292 40.890425,-111.869691 40.890867,-111.869654 40.890890,-111.870295 40.890431,-111.870292"
      }
    },
    "party": {
      // supply "did"
    }
  },

  allDidsAreHidden: allDidsAreHidden,

}

