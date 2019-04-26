import chai from 'chai';
import request from 'supertest';
import Server from '../server';
import { HIDDEN_TEXT, UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util';
import {allDidsAreHidden} from './util'

const expect = chai.expect;

// from https://developer.uport.space/uport-credentials/reference/index and https://developer.uport.space/credentials/transactions
const { Credentials } = require('uport-credentials')
// from Credentials.createIdentity();
var aId = { did: 'did:ethr:0x7bc41517a0397b24eef6a5f2875cdad84c6595df', privateKey: 'f2e9656d76980171bba6791be99a000aa2babde1b41a7da77049ce20c7daebf0' }
var aCreds = new Credentials(aId)
var bId = { did: 'did:ethr:0x275cee0e4657075d3b9564940fe39194e9cedceb', privateKey: '923035e1d86a95d11859be1e8c8657aa1725edfaab1792faedcc94d82467b57c' }
var bCreds = new Credentials(bId)
var cId = { did: 'did:ethr:0xbfb23cacc8659cb79cd9582d6b11fe0a2c8e7478', privateKey: 'ece0e7d174f80ff6164dd5dc94c616de457e753f72de1cfc913c440e11dd76a5' }
var cCreds = new Credentials(cId)

let tomorrow = Math.floor(new Date().getTime() / 1000) + (24 * 60 * 60)
let aPushToken = aCreds.createVerification({exp:tomorrow})
let bPushToken = bCreds.createVerification({exp:tomorrow})
let cPushToken = cCreds.createVerification({exp:tomorrow})

let allPromises = Promise.all([aPushToken, bPushToken, cPushToken])

let claimChecks = (allTokens) => (() => {

  it('should test that nothing is visible', () => {
    expect(allDidsAreHidden(null)).to.be.true
    expect(allDidsAreHidden(9)).to.be.true
    expect(allDidsAreHidden(true)).to.be.true
    expect(allDidsAreHidden("stuff")).to.be.true
    expect(allDidsAreHidden(HIDDEN_TEXT)).to.be.true
    expect(allDidsAreHidden("did:x:0xabc123...")).to.be.false
    expect(allDidsAreHidden({a:HIDDEN_TEXT, b:[HIDDEN_TEXT]})).to.be.true
    expect(allDidsAreHidden({a:"did:x:0xabc123...", b:[HIDDEN_TEXT]})).to.be.false
    expect(allDidsAreHidden(["a", "b", "c", {d: HIDDEN_TEXT}])).to.be.true
    expect(allDidsAreHidden(["a", "b", "c", {d: "did:x:0xabc123..."}])).to.be.false
  })

  it('should get claims but cannot see inside', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, allTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       for (var i = 0; i < r.body.length; i++) {
         expect(allDidsAreHidden(r.body[i]))
           .to.be.true
       }
     }))

})

allPromises.then(allJwts => {
  describe('Set of Test Claims', claimChecks(allJwts))
})
