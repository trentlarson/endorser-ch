/**
   Load and run this file with: npm install esm; LOG_LEVEL=info node -r esm

   Some of this is copied in the endorser-auth package (eg. test.js).
**/

import R from 'ramda'
import { ERROR_CODES, HIDDEN_TEXT, isDid } from '../dist/api/services/util'

const { Credentials } = require('uport-credentials')

const NOW_EPOCH = Math.floor(new Date().getTime() / 1000)
const NEXT_MINUTE_EPOCH = NOW_EPOCH + (24 * 60 * 60)
const NEXT_WEEK_EPOCH = NOW_EPOCH + (7 * 24 * 60 * 60)

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
 @return true if any DID is hidden
 **/
const anyDidMatches = (text) => (result) => {
  if (Object.prototype.toString.call(result) === "[object String]") {
    return result === text
  } else if (result instanceof Object) {
    var values
    if (Array.isArray(result)) {
      values = result
    } else {
      // assuming it's an object since it's not an array
      // (Hmmmm... this is inconsistent with other methods where the keys aren't checked.)
      values = R.keys(result).concat(R.values(result))
    }
    return R.reduce((a,b) => a || b, false, R.map(anyDidMatches(text), values))
  } else {
    return false
  }
}

const anyDidIsHidden = anyDidMatches(HIDDEN_TEXT)

/**
// Here's the DID Document for ETHR_CRED_DATA #0:
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/secp256k1recovery-2020/v2"
  ],
  "id": "did:ethr:0x0000694B58C2cC69658993A90D3840C560f2F51F",
  "verificationMethod": [
    {
      "id": "did:ethr:0x0000694B58C2cC69658993A90D3840C560f2F51F#controller",
      "type": "EcdsaSecp256k1RecoveryMethod2020",
      "controller": "did:ethr:0x0000694B58C2cC69658993A90D3840C560f2F51F",
      "blockchainAccountId": "eip155:1:0x0000694B58C2cC69658993A90D3840C560f2F51F"
    }
  ],
  "authentication": [
    "did:ethr:0x0000694B58C2cC69658993A90D3840C560f2F51F#controller"
  ],
  "assertionMethod": [
    "did:ethr:0x0000694B58C2cC69658993A90D3840C560f2F51F#controller"
  ]
}
**/

const ETHR_CRED_DATA = [

  // these old ones generated with derivation path m/7696500'/0'/0'/0'
  //{ did: 'did:ethr:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51', privateKey: '01a3172cd9e334210b2669dce737d435beefe5c99802ded607c44cd85c96666b' }, // seminar accuse mystery assist delay law thing deal image undo guard initial shallow wrestle list fragile borrow velvet tomorrow awake explain test offer control
  //{ did: 'did:ethr:0x111c4aCD2B13e26137221AC86c2c23730c9A315A', privateKey: '75fc2f133b27078d4b6bf61e90d31d240f9fa7eb8edb30289264374e82c05da6' }, // average mammal spice rebuild volume border tail bracket else absent sniff connect praise tennis twice inquiry summer crawl job nurse sister account tooth follow
  //{ did: 'did:ethr:0x2224EA786b7C2A8E5782E16020F2f415Dce6bFa7', privateKey: '1c9686218830e75f4c032f42005a99b424e820c5094c721b17e5ccb253f001e4' }, // annual soap surround inhale island jewel blush rookie gate aerobic brave enlist bird nut remain cross undo surround year rapid blade impulse control broccoli

  //  mnemonic created with @scure/bip39 (& their wordlists/english) & @ethersproject/hdnode: HDNode.fromMnemonic(bip39.generateMnemonic(wordlist)).derivePath("m/84737769'/0'/0'/0'")
  // ... and the rest created by Credentials.createIdentity()

  { did: 'did:ethr:0x0000694B58C2cC69658993A90D3840C560f2F51F', privateKey: '2b6472c026ec2aa2c4235c994a63868fc9212d18b58f6cbfe861b52e71330f5b' }, // rigid shrug mobile smart veteran half all pond toilet brave review universe ship congress found yard skate elite apology jar uniform subway slender luggage
  { did: 'did:ethr:0x111d15564f824D56C7a07b913aA7aDd03382aA39', privateKey: 'be64d297e1c6f3545971cd0bc24c3bf32656f8639a2ae32cb84a1e3c75ad69cd' }, // island fever beef wine urban aim vacant quit afford total poem flame service calm better adult neither color gaze forum month sister imitate excite
  { did: 'did:ethr:0x222BB77E6Ff3774d34c751f3c1260866357B677b', privateKey: '267dbe0ff8e0b98a224deec6f055cc81884bbd63df08243dc10df2396cbb5df5' }, // wild trade rescue help access cave expand toward coconut gas weird neck history wealth desk course action number print ahead black song dumb long
  { did: 'did:ethr:0x333B0a0dDCC4a766dF4dd43C5BFDc96AE75BDabF', privateKey: '4a1a8ad7ffd29a40988db71194063627ca7f12cdce20a76e574cd5812691adf7' }, // kangaroo rose sail royal gorilla proud echo miracle monster answer about pigeon keen over pistol limb saddle defense cruel umbrella firm raccoon creek donor
  { did: 'did:ethr:0x44471084464351082Ae36EA94087E0e8c67ef7b7', privateKey: '8de71148a9c2e619a3d1fe8fa0106d1cab46cdc4fbaa2a5222b85f766a8e3397' }, // merit before luggage casino crater relax sail kit palm bike despair spy inmate river increase file bounce silk couch fresh parrot attitude lens board
  { did: 'did:ethr:0x555fD42Aa136832927f1Db94ef4F530223D40a1d', privateKey: '651c0eb2071f17019c3ff8356476df55c6dfb0afd503ce4d4c8392ee320e8d66' }, // dinner bone size thunder image net meadow intact screen job maple minor human panel abuse dolphin sure sketch zebra tourist force spot scene load
  { did: 'did:ethr:0x66696162E344652b4e1297e5708212553398e2F4', privateKey: '90f76340efc2657e411075b2fc3eac0cad0e3f6b9ef3cbd9359788146cac1b18' }, // lottery banana swallow suffer weekend space put fitness toss rifle decide minor below common control that memory trade tomato stock vote mention confirm satoshi
  { did: 'did:ethr:0x777065BcAd807082E058eEe3ff2560AA5B3E0D10', privateKey: 'b7aadff57c7b3488ba3d08de87b33c0ade7f3dc1f2a27b732ee4b55dfaac61b0' }, // home lucky post lunch target dad peace pact whisper muffin patient cheese onion carry tongue box twice donkey prepare rabbit crazy divorce mountain wrist
  { did: 'did:ethr:0x88881a55f314D77a782a326d4A9Cca13dFb66A9a', privateKey: '1c84fe560f0950552374a5e588c896342150933e5bc7f4593c3acec02c318ff4' }, // trim invest muffin clap yellow habit crowd limb lecture useful diet retreat minimum usage stumble tank make donate word mention myth scale paddle chair
  { did: 'did:ethr:0x9990d07c7f19Dede98B6E56471Be7c6aeeeeBd7e', privateKey: 'ac434ab87d11577c4c38f2d9fe7e077645cc666c1c274b1242c15e43f4f88f1b' }, // nominee ripple draft marine you game ritual bracket thought dash nose clock avocado pretty employ scene silly desk birth joy rebel rate hello great
  { did: 'did:ethr:0xAAAfE9D9Cc2Fd733B2958bB3209e544FB863bEd9', privateKey: 'c1f720c516ca4d16897f6dc715fcb76083d520c06974af1d131d63b0331fa58a' }, // action immense lava scissors cereal meat asset sail carpet foot general wall kitchen laugh pave miss cream junior palm mammal metal inch broccoli marine
  { did: 'did:ethr:0xBBB1E2Dc9782EdC9eB467A24f19B4BB679b5B5cc', privateKey: '41642082d1d2acad33be3dd2a37215ed024c2a05a240cef5f148ff131ac50ad4' }, // gown connect aerobic asset awful tree smile expire august double artist depend napkin same crawl cabbage shop call bright usual again empty enjoy bridge
  { did: 'did:ethr:0xCCC8F13a5768454dD8f9d64A383C9c046f7c2928', privateKey: '2dd7b39b8ef7cb86a5943ddb8025263f46dc74aebefa133ea52aa4d78386a0a3' }, // lecture purity push topple home engage salon bone design pull always zoo ladder glimpse must measure dream knee wave traffic couch happy doctor local
  { did: 'did:ethr:0xDDDfF264441B8e7e43AEE1a5E8a789b12fC8ED29', privateKey: '24f96f03e7465119917cfe7086cfd98f7669d4ab84750a384609e0a0e44f768d' }, // tooth guard detect else measure suit victory lend female flame great across rib much nasty seven top enlist detail thing elder swap crisp shaft
  { did: 'did:ethr:0xEEE786d938afb013BB0Bb77119b5B71ac76d47B7', privateKey: 'f3084353f01c8dce4edbd04da1e41fbee8d11ad2862030826a1e38e17aedbe00' }, // drive order tiger omit hurt evidence private purse subject armor creek amateur settle gallery beauty decade resemble common brain erase there admit mercy cupboard
  { did: 'did:ethr:0xFFF6C551B853B0368cC1e69a9f2D2ece1aDA03AF', privateKey: 'cd7ae33a16af37d33104d4d17f587241eb7d1f072b251b39990fc150ec3889b6' }, // void quick page name hollow mask urge pilot spatial gym spike foam essay fuel magnet east violin stem light funny stool pencil rival cool
  { did: 'did:ethr:0xaaabaecb78CFc24BC568D4F12F242804b01Ec82C', privateKey: '887005be3dfccb27118b08eb690986beb01fb9da871ae826d569f1db0375bbe2' }, // guess crop stereo maid attack school off film motion concert bachelor soap leg clinic grab ski rent achieve arrange pupil logic oven gallery iron
  { did: 'did:ethr:0xbbb31BE1cC70785732B2a148ADa8493AbAd58e61', privateKey: 'f9dbb4667a85ee7012fd8269f0886ad7418846e169b554cefd0c61b912c5e21b' }, // hundred virus captain lesson dentist grit example unhappy public feed attack sun same ready frown exhaust gesture nut flip acoustic other palm warfare logic
  { did: 'did:ethr:0xccc2269144C12e2b50aE7D90B11C2DB2BAc5df36', privateKey: '4fbe5a4808f6a989e7c5f56fc58ddda0e311f7c298637189688493e893cb7f86' }, // magnet found job rice raw way range awkward lady city indicate copy lake display network asset annual solar mechanic plate rich silent limb pigeon
  { did: 'did:ethr:0xddd15c794faD78Da0A95641471E5bd51B12432ce', privateKey: '4437dc899dc20547369c290f657e3db2f8e6d705e41d2b054f3abafa33d32d41' }, // suffer pony chaos deposit jewel remain bulb food fun nominee sausage siege traffic sure elder best suggest cement man cup short egg sketch trash
  { did: 'did:ethr:0xeee3B6CF5Dc444C4deFbcB4Cc9ED784B3485F073', privateKey: '841a025e8e348c57a04e562c588f9759699036347a70ac1b5649c8730c00cfbe' }, // enrich symptom public uncover buddy cry jungle object draw mosquito mean visa organ engine summer engage empty stick mansion park force dinosaur quality drum
  { did: 'did:ethr:0xfff1008fe34D4863bA0b2d5ED1fcBCb2E10e1B2b', privateKey: 'f139f9469795f3bd235f4234d0d38c023554e0f8f8c6bcdc93608a3cea4a65b4' }, // fly often shoe notable shield canoe december drama amateur impose math desk farm easily system draw wide smooth outdoor salmon use pencil moral sea

]

const PEER_CRED_DATA = [
  { did: 'did:peer:0zKMFjvUgYrM1hXwDciYHiA9MxXtJPXnRLJvqoMNAKoDLX9pKMWLb3VDsgua1p2zW1xXRsjZSTNsfvMnNyMS7dB4k7NAhFwL3pXBrBXgyYJ9ri', publicKeyHex: 'a50102032620012158204bfa4f3a68e72142df6791b516f32e6cd44383240c7af13fe610b8ab21f42eba22582037bb715ba5e071b8e6754148a0b17a224f5ca7a5294dc7bd964864f41f9b3bbb' },
];

const ETHR_CREDENTIALS = R.map((c) => new Credentials(c), ETHR_CRED_DATA)

const INITIAL_DESCRIPTION = "Deliver an app that..."

module.exports = {

  ethrCredData: ETHR_CRED_DATA,
  ethrCredentials: ETHR_CREDENTIALS,

  peerCredData: PEER_CRED_DATA,

  ERROR_CODES: ERROR_CODES,

  nowEpoch: NOW_EPOCH,

  nextMinuteEpoch: NEXT_MINUTE_EPOCH,

  jwtTemplate: {
    "iat": NOW_EPOCH,
    "exp": NEXT_MINUTE_EPOCH,
    // supply "sub"
    // supply "claim", usually including same DID of "sub"
    // supply "iss"
  },

  registrationTemplate: {
    "@context": "https://schema.org",
    "@type": "RegisterAction",
    "agent": { "identifier": null }, // supply DID
    "endTime": NEXT_WEEK_EPOCH,
    //"identifier": null, // used for invites, alternative to "participant"
    "object": "endorser.ch",
    "participant": { "identifier": null }, // supply DID, alternative to invite "identifier"
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
    "name": "Crowd Funding Plans with Time",
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
    "name": "Crowd Funding with Time",
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

  anyDidIsHidden: anyDidIsHidden,
  anyDidMatches: anyDidMatches,

}

