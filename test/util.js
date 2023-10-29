/**
   Load and run this file with: npm install esm; LOG_LEVEL=info node -r esm

   Some of this is copied in the endorser-auth package (eg. test.js).
**/

import R from 'ramda'
import { ERROR_CODES, HIDDEN_TEXT, isDid } from '../server/api/services/util'

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

/**
// Here's the DID Document for CREDS #0:
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/secp256k1recovery-2020/v2"
  ],
  "id": "did:ethr:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51",
  "verificationMethod": [
    {
      "id": "did:ethr:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51#controller",
      "type": "EcdsaSecp256k1RecoveryMethod2020",
      "controller": "did:ethr:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51",
      "blockchainAccountId": "eip155:1:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51"
    }
  ],
  "authentication": [
    "did:ethr:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51#controller"
  ],
  "assertionMethod": [
    "did:ethr:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51#controller"
  ]
}
**/

const CREDS = [

  // these are old users, from derivation path m/7696500'/0'/0'/0
  //{ did: 'did:ethr:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51', privateKey: '01a3172cd9e334210b2669dce737d435beefe5c99802ded607c44cd85c96666b' }, // seminar accuse mystery assist delay law thing deal image undo guard initial shallow wrestle list fragile borrow velvet tomorrow awake explain test offer control
  //{ did: 'did:ethr:0x111c4aCD2B13e26137221AC86c2c23730c9A315A', privateKey: '75fc2f133b27078d4b6bf61e90d31d240f9fa7eb8edb30289264374e82c05da6' }, // average mammal spice rebuild volume border tail bracket else absent sniff connect praise tennis twice inquiry summer crawl job nurse sister account tooth follow
  //{ did: 'did:ethr:0x2224EA786b7C2A8E5782E16020F2f415Dce6bFa7', privateKey: '1c9686218830e75f4c032f42005a99b424e820c5094c721b17e5ccb253f001e4' }, // annual soap surround inhale island jewel blush rookie gate aerobic brave enlist bird nut remain cross undo surround year rapid blade impulse control broccoli

  // from @ethersproject/hdnode: HDNode.fromMnemonic(bip39.generateMnemonic(wordlist)).derivePath("m/76798669'/0'/0'/0'")
  // ... with wordlist from @scure/bip39/wordlists/english

  { did: 'did:ethr:0x0009fb830A80d754b6cA73126061597769CC277b', privateKey: '9ff996fee981abadc1c05e5340a9585e5b79a481028b8513374ae29c2acadd59' }, // neglect grant leg brisk taxi guard elite tragic sure bird mouse kite
  { did: 'did:ethr:0x11193F937c20B6e13aDA3E26A376E89bC0c1ad3d', privateKey: 'e5cd1ea39db41570077bcb409746ea6fdca00b7648664e04ab9e304654458fbf' }, // seek doctor start swap crucial depth multiply glare champion state pond injury
  { did: 'did:ethr:0x222F7fDA65C7871a58ad8FA6762590d102D7B00B', privateKey: 'a6cd4c3ee1fc451ce457d842373a1b43578fb83f78928cc8498d9d347c2d770a' }, // lumber share news together sausage staff roof choice velvet hospital high estate
  { did: 'did:ethr:0x333C73F1997e73DE46C71Bc68D29Ce690380Ddab', privateKey: '38cd1606cc044f9baaba4cf3a3c558f7f772302e4c84c4ef3350973da29f424e' }, // anger pool pulse wild ankle identify inch tone strong area girl embrace
  { did: 'did:ethr:0x4442B7c1A4227a536FAf538E25AD1C4F291E8352', privateKey: 'ff489c1ff22f1febd5e9cc1e86988b5eacfa53bcfb1060cc24d7c13c56480fa1' }, // shrimp symptom undo cruel hire used lazy reason girl into dawn satoshi
  { did: 'did:ethr:0x555a65DdA391b797E014De658FF2B08ECd5c865D', privateKey: '76076d2d2a749db188e414e3307208442ce936f8270a3ea057044fbde4b755c2' }, // cause cliff soda exit ability giant all sustain wrong eye pitch true
  { did: 'did:ethr:0x6662a260e77AAAb0076Bc5601fdF0CBcdD0577D2', privateKey: 'e23bf80f20f0c0ad4243eb2c91d30823d2e87c77a4889ea968352f6e344fdab4' }, // rely discover glance output immense weekend drop decrease normal april milk front
  { did: 'did:ethr:0x77730Bb2Be6382DEe8D79002496301c051A13E7d', privateKey: 'f4145f789a47f340b66058c0a45e91093f4cacb32f4133b8e4e9a429b5aa5c6d' }, // grit tribe tumble cherry history verb stereo depth scissors drum type chunk
  { did: 'did:ethr:0x8881f29eE2BcE5c0Fc4654823EC34Af7a16b8221', privateKey: 'da46247799c267823699e5530a9790441208a97ca3b3ed1a2727b6000a591032' }, // mind element neglect fragile magic oil immense pill good offer annual planet
  { did: 'did:ethr:0x9993E20D763B4C27A4F6200c0C50b705ffe7d25C', privateKey: 'dafdfdbb11da61785626e6c2f324a32b63233bd19ed712efe3939188f0eeff81' }, // spare waste hawk decorate lunar observe fresh approve maximum remove orbit minor
  { did: 'did:ethr:0xAAA12fd349501eeD9eA4599aBb5053D2e6189777', privateKey: '543983ab0099c7fa1ec3083ee6df144af84427e11556d0754cbb5cbe8796af2b' }, // ozone bamboo own patient december mention shove angle intact bamboo rotate crisp
  { did: 'did:ethr:0xBBBDE0d7EBCfa2f907b08589070C6eAD5441d442', privateKey: '91b9b668d03baff94dfe3c876e0e765b1a7efd8de1c7e4b60fa778450b7273be' }, // dog kind fiscal artefact baby urban polar predict creek match device theme
  { did: 'did:ethr:0xCCC38F8a2ECd6B107D2A8af371d3ad51f72cFFfc', privateKey: '93dde71b94826eab9c03c1a5b3318f12081f9747d87126a8279e58928a54213b' }, // test visual camp priority vital alter country song buzz web husband catalog
  { did: 'did:ethr:0xDDDC499eD5b5ff51f12a8a10e9D01481856b0457', privateKey: '9aec87327023de703acd49403e9d93229cf289a2e944d4b12c8a9f304ec2d348' }, // release swarm warrior despair milk olympic payment aware simple slab energy unhappy
  { did: 'did:ethr:0xEEE718F17232869184f747f56cfa91573E910EB1', privateKey: 'fb9ccc1ef1ad0ffb6a060e39349efd7203143c8ab31d0bd8c02ef6adec6c1495' }, // crucial alcohol health abstract blanket effort ahead milk stable term lunch link
  { did: 'did:ethr:0xFFF40Ce45069ff3907e56975EF4Ac4f2001bD64d', privateKey: 'd8ce30a4161f3a5b614f88033885bbae96fd3e9905071e57f127cea2c520ecee' }, // hazard torch infant bid stairs term current latin garage mercy gentle refuse
  { did: 'did:ethr:0xaaaD39d1f6c8d204cEcc45C450dcBdA59Fe33Af5', privateKey: 'bc4468adc02029fa9b1f4ee630b88dddde7ed233eda5255e933b08d5136f22e5' }, // mechanic hard number found negative ghost donkey opera citizen bleak parent suit
  { did: 'did:ethr:0xbbb27e508806eeEC41efF6E72FdF795Ecb563FA1', privateKey: '896dd968d1fbb00b4748db1b7a7fd20df2c7f795994548524da18bf7653e575c' }, // often soup unable lady summer adult approve million fog solve initial until
  { did: 'did:ethr:0xccc9e9c2a31Cf3895C08b8f6BCDCdFfF09e7C779', privateKey: '516c24e172d740bfdb29cd0d3da22ce92358c76fecd2efa3d80dd5d1e4af6a7b' }, // fever water adapt buddy civil risk chat return flash fever pull angle
  { did: 'did:ethr:0xddda1B645b6a4c88c7D4603C918340EEF41cF95c', privateKey: '708b5d58abda7e3cd7d91c73324ad49fb942ec88d7e4465445755dba25409ca2' }, // paper heavy grocery noise fitness session kiwi build fantasy equal world tray
  { did: 'did:ethr:0xeeeEb3178F4C17493ab66A8450B045dDe7498129', privateKey: '70d5d1b8b5101c98089313699057af07811db987b5239f0bf7bf8c74e13f7e64' }, // club hollow whisper anchor little tenant series afraid oval tissue chapter glow
  { did: 'did:ethr:0xfff1509A39B90149532094Fd0E7aF08744cBC253', privateKey: '9dd3cfb3bb0945e4ad1acd721b59b55f5c434dc0901c94bff0c8116ecf603d55' }, // blade south rude brush ugly senior before cycle source save atom unit
]

const CREDENTIALS = R.map((c) => new Credentials(c), CREDS)

const INITIAL_DESCRIPTION = "Deliver an app that..."

module.exports = {

  creds: CREDS,

  credentials: CREDENTIALS,

  ERROR_CODES: ERROR_CODES,

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
    "agent": { "identifier": null }, // supply DID
    "object": "endorser.ch",
    "participant": { "identifier": null }, // supply DID
  },

  confirmationTemplate: {
    "@context": "https://schema.org",
    "@type": "AgreeAction",
    "object": [
      // supply claims
      // which could just have "identifier" of a previous claim (which would mean other properties are ignored)
      // ... though best practice is to replace this array with a single claim
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
      // supply "identifier"
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
      // supply "identifier"
    }
  },

  INITIAL_DESCRIPTION: INITIAL_DESCRIPTION,

  claimGive: {
    "@context": "https://schema.org",
    "@type": "GiveAction",
    //identifier: "...",
    //agent: { identifier: "..." },
    //recipient: { identifier: "..." },
    object: { '@type': 'TypeAndQuantityNode', amountOfThisGood: 2, unitCode: 'HUR' },
    fulfills: {
      '@type': 'Offer',
      //lastClaimId: "...",
      //identifier: "...", // but we prefer lastClaimId
    },
    description: "Help pulling a snowboarder along.",
  },

  claimOffer: {
    "@context": "https://schema.org",
    "@type": "Offer",
    //identifier: "...",
    //includesObject: { '@type': 'TypeAndQuantityNode', amountOfThisGood: 2, unitCode: 'HUR' },
    itemOffered: {
      description: "Help groom the runs before powder days!",
      //isPartOf: { '@type': 'PlanAction', identifier: "..." }
    },
    //offeredBy: { identifier: null }, // offering agent's DID string
    //recipient: { identifier: null }, // individual recipient DID string
    //validThrough: '...', // date string
  },

  claimPerson: {
    "@context": "https://schema.org",
    "@type": "Person",
    "identifier": null, // supply DID
    "seeks": "stuff",
  },

  claimPlanAction: {
    "@context": "https://schema.org",
    "@type": "PlanAction",
    "agent": { identifier: null }, // supply DID for intiator of this plan
    //"identifier": null, // supply plan ID
    "name": "Kick Starting with Time",
    "description": INITIAL_DESCRIPTION,
    "image": "https://live.staticflickr.com/2853/9194403742_c8297b965b_b.jpg",
    "startTime": "2022-07",
    "endTime": "2023-03-31T07:07:07Z",
    "location": { "geo": { "@type": "GeoCoordinates", "latitude": 40.883944, "longitude": -111.884787 } },
    "url": "https://example.com/plan/111",
  },

  claimProjectAction: {
    "@context": "https://schema.org",
    "@type": "Project",
    "agent": { identifier: null }, // supply DID for intiator of this project
    //"identifier": null, // supply project ID
    "name": "Kick Starting with Time",
    "description": INITIAL_DESCRIPTION,
    "image": "https://live.staticflickr.com/2853/9194403742_c8297b965b_b.jpg",
    "startTime": "2022-07",
    "endTime": "2023-03-31T07:07:07Z",
    "location": { "geo": { "@type": "GeoCoordinates", "latitude": 40.883944, "longitude": -111.884787 } },
    "url": "https://example.com/project/111",
  },

  claimVote: {
    "@context": "https://schema.org",
    "@type": "VoteAction",
    //"actionOption": "...", // supply option
    //"candidate": { identifier: "..." },
    "object": { "event": { "name": "Speaking Event", "startDate": "2023-03-25" } },
  },

  allDidsAreHidden: allDidsAreHidden,

}

