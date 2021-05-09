// Load and run this file with: npm install esm; LOG_LEVEL=info node -r esm

import R from 'ramda'
import { HIDDEN_TEXT, isDid } from '../server/api/services/util'

const { Credentials } = require('uport-credentials')

let NOW_EPOCH = Math.floor(new Date().getTime() / 1000)
let TOMORROW_EPOCH = NOW_EPOCH + (24 * 60 * 60)


function allDidsAreHidden(result) {
  if (Object.prototype.toString.call(result) === "[object String]") {
    if (isDid(result) && result !== HIDDEN_TEXT) {
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
    return R.reduce((a,b) => a && b, true, R.map(allDidsAreHidden, values))
  } else {
    return true
  }
}

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
  { did: 'did:ethr:0x888acf84fa5793a5e0dd64ac25bcfc55e7f25d8f', privateKey: '9c18f36cdf8ff55e9b0ceef77ed5fe69e5d93009a881d5c552afe8aad66175a7' },
  { did: 'did:ethr:0x999676de3eaa1bcf5ebae2467ac36682069215e1', privateKey: '83239f76f6eb46f75b977b43c60184f57410a4039ce19a674aa815f0203ae773' },
  { did: 'did:ethr:0xaaa29f09c29fb0666b8302b64871d7029032b479', privateKey: 'b4507c7473031d213a1e0a6c3eaf68517519ef0f852928d6d7dffdc851d5ccda' },
  { did: 'did:ethr:0xbbbee8d9c34746aac37116be7384a8228d73e6aa', privateKey: 'feb8d652df079b3c6d85f78be40804f6993b107482787cf9a9ec761f452432b9' },
  { did: 'did:ethr:0xccc4645181a6158aa253a5765e1edde893fb164b', privateKey: 'b4d3efaf5475ebbbd665fe31cba81e398248971b5708093e3a89fcecb0824d3f' },
  { did: 'did:ethr:0xddd6c03f186c9e27bc150d3629d14d5dbea0effd', privateKey: 'aa7a540eb94f9a24682cb4ff9ee6918be7397b1f3349e4eda4493ab7e95c32c0' },
  { did: 'did:ethr:0xeeed589b09a449ae6ccf89ad0e9effe74072f829', privateKey: 'bad6e7ab26eb2cc98ec39ccc6bb7b814b8bf08dcde184e7d0514a914d032b963' },
  { did: 'did:ethr:0xfff9f93c0c7adb7213022c22b9eb99fcb409e734', privateKey: 'f2c27382d8ab785be1df575323d110181d2ea46207ffda52d76fb5f98db088fa' },
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

  confirmationTemplate: {
    "@context": "http://schema.org",
    "@type": "AgreeAction",
    "object": [
      // supply claims
    ]
  },

  claimCornerBakery: {
    "@context": "http://endorser.ch",
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
    "@context": "http://endorser.ch",
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

