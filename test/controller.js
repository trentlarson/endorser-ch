import * as childProcess from 'child_process';
import chai from 'chai';
import didJWT from 'did-jwt'
import request from 'supertest';
import { DateTime } from 'luxon'

import Server from '../server';
import { calcBbox, hideDids, HIDDEN_TEXT, UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util';

let dbInfo = require('../conf/flyway.js')

const expect = chai.expect;

const START_TIME_STRING = '2018-12-29T08:00:00.000-07:00'
const DAY_START_TIME_STRING = DateTime.fromISO(START_TIME_STRING).set({hour:0}).startOf("day").toISO()
const TODAY_START_TIME_STRING = DateTime.local().set({hour:0}).startOf("day").toISO()
const signer = didJWT.SimpleSigner('fa09a3ff0d486be2eb69545c393e2cf47cb53feb44a3550199346bdfa6f53245');


// Set up some JWTs for calls.
let tomorrow = Math.floor(new Date().getTime() / 1000) + (24 * 60 * 60 * 1000)
var globalJwt1 = null
// from https://github.com/uport-project/did-jwt#1-create-a-did-jwt
didJWT.createJWT(
  //did:uport:2osnfJ4Wy7LBAm2nPBXire1WfQn75RrV6Ts
  {aud: 'did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e', exp: tomorrow, name: 'uPort Developer'},
  {issuer: 'did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e', signer})
  .then( response => { globalJwt1 = response; console.log("Created JWT", globalJwt1) });
var globalJwt2 = null
didJWT.createJWT(
  //did:uport:2osnfJ4Wy7LBAm2nPBXire1WfQn75RrV6Ts
  {aud: 'did:ethr:0xaaee47210032962f7f6aa2a2324a7a453d205761', exp: tomorrow, name: 'uPort Developer'},
  {issuer: 'did:ethr:0xaaee47210032962f7f6aa2a2324a7a453d205761', signer})
  .then( response => { globalJwt2 = response; console.log("Created JWT", globalJwt2) });



var firstId = 1

describe('Util', () => {

  // I couldn't find a way to wait for that JWT creation (without putting all these tests in a function).
  it('should already have a JWT', () => {
    if (!globalJwt1) {
      console.log("Never got the initial JWT created in time, so will stop.")
      console.log("If we can't get past this, we'll have to try a real approach, eg. https://mochajs.org/#delayed-root-suite")
      process.exit(1)
    }
  })

  it('should return the right bbox', () =>
     expect(calcBbox("40.883944,-111.884787 40.884088,-111.884787 40.884088,-111.884515 40.883944,-111.884515 40.883944,-111.884787"))
     .to.be.deep.equal({ westLon:-111.884787 , minLat:40.883944, eastLon:-111.884515, maxLat:40.884088 })
    )

  it('should return the same bbox even in different order', () =>
     expect(calcBbox("40.884088,-111.884515 40.883944,-111.884515 40.883944,-111.884787 40.884088,-111.884787 40.884088,-111.884515"))
     .to.be.deep.equal({ westLon:-111.884787 , minLat:40.883944, eastLon:-111.884515, maxLat:40.884088 })
    )

  it('should hide DIDs', () => {
    let addr0 = 'did:ethr:0x00000000C0293c8cA34Dac9BCC0F953532D34e4d'
    let addr6 = 'did:ethr:0x6666662aC054fEd267a5818001104EB0B5E8BAb3'
    let addra = 'did:ethr:0xaaee47210032962f7f6aa2a2324a7a453d205761'
    let addrd = 'did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e'
    let addru = 'did:uport:2osnfJ4Wy7LBAm2nPBXire1WfQn75RrV6Ts'
    var someObj = {a: 1, b: addr0, c: {d: addr6, e: [], f: [9, {g: addru}]}}
    var replObj1 = {a: 1, b: HIDDEN_TEXT, c: {d: HIDDEN_TEXT, e: [], f: [9, {g: HIDDEN_TEXT}]}}
    var replObj2 = {a: 1, b: addr0, c: {d: HIDDEN_TEXT, e: [], f: [9, {g: addru}]}}
    var allowedDids

    allowedDids = []
    expect(hideDids(allowedDids, null)).to.be.equal(null)
    expect(hideDids(allowedDids, 9)).to.be.equal(9)
    expect(hideDids(allowedDids, false)).to.be.equal(false)
    expect(hideDids(allowedDids, "Some random randomness")).to.be.equal("Some random randomness")
    expect(hideDids(allowedDids, addru)).to.be.equal(HIDDEN_TEXT)
    expect(hideDids(allowedDids, {})).to.be.deep.equal({})
    expect(hideDids(allowedDids, someObj)).to.be.deep.equal(replObj1)
    expect(hideDids(allowedDids, [])).to.be.deep.equal([])
    expect(hideDids(allowedDids, [someObj])).to.be.deep.equal([replObj1])

    allowedDids = [addrd]
    expect(hideDids(allowedDids, addrd)).to.be.deep.equal(addrd)
    expect(hideDids(allowedDids, addru)).to.be.deep.equal(HIDDEN_TEXT)

    allowedDids = [addr0, addrd, addru]
    expect(hideDids(allowedDids, addr0)).to.be.deep.equal(addr0)
    expect(hideDids(allowedDids, addra)).to.be.deep.equal(HIDDEN_TEXT)
    expect(hideDids(allowedDids, someObj)).to.be.deep.equal(replObj2)
  })

  it('should get a sorted object', () =>
     request(Server)
     .get('/util/objectWithKeysSorted?object=\{"b":\[5,1,2,3,\{"bc":3,"bb":2,"ba":1\}\],"c":\{"cb":2,"ca":1\},"a":4\}')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(JSON.stringify(r.body))
         .to.deep.equal('{"a":4,"b":[5,1,2,3,{"ba":1,"bb":2,"bc":3}],"c":{"ca":1,"cb":2}}')
     }))

})

describe('Claim', () => {

  it('should get no claims', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
     })).timeout(3001) // looks like the first time through JWT processing just takes longer

  it('should get a 404, missing first claim', () =>
     request(Server)
     .get('/api/claim/' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .then(r => {
       expect(400)
     }))

  it('should add a new action claim', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .send({"jwtEncoded":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDczNjMyMDQsImV4cCI6MTU0NzQ0OTYwNCwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLjAwMC0wNzowMCJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.uwutl2jx7lHqLeDRbEv6mKxUSUY75X91g-V0fpJcKZ2dO9jUYnZ9VEkS7rpsD8lcdYoQ7f5H8_3LT_vhqE-9UgA"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId)
     })).timeout(6000)

  it('should get a claim #' + firstId, () =>
     request(Server)
     .get('/api/claim/' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.a.property('claimContext')
         .that.equals('http://schema.org')
       expect(r.body)
         .that.has.a.property('claimType')
         .that.equals('JoinAction')
       expect(r.body)
         .that.has.a.property('issuer')
         .that.equals('did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e')
     })).timeout(3001)

  it('should get a claim with the DID hidden', () =>
     request(Server)
     .get('/api/claim/' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt2)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.a.property('claimContext')
         .that.equals('http://schema.org')
       expect(r.body)
         .that.has.a.property('claimType')
         .that.equals('JoinAction')
       expect(r.body)
         .that.has.a.property('issuer')
         .that.equals(HIDDEN_TEXT)
     })).timeout(3001)

  it('should add a new confirmation for that action', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .send({"jwtEncoded":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDg0ODQxMTEsImV4cCI6MTU0ODU3MDUxMSwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IkNvbmZpcm1hdGlvbiIsIm9yaWdpbmFsQ2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLjAwMC0wNzowMCJ9fX0sImlzcyI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9.5l1NTMNk0rxBm9jj91hFnT3P463aYELbmPVeQcFCkHZ2Gj9sP3FgbidCI69AeSArAVKvvRGAjcifJ94UtiEdfAA"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 1)
     })).timeout(6002)

  it('should get 2 claims', () =>
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
     })).timeout(3001)

  it('should get 1 JoinAction claim', () =>
     request(Server)
     .get('/api/claim?claimType=JoinAction')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
     })).timeout(3001)

  it('should get 1 comfirmation', () =>
     request(Server)
     .get('/api/claim?claimType=Confirmation')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
     }))

  it('should add another new claim', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .send({"jwtEncoded":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDc4NjcxOTIsImV4cCI6MTU0Nzk1MzU5Miwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6Ik1lLCBNeXNlbGYsIGFuZCBJIn0sIm5hbWUiOiJGcmlkYXkgbmlnaHQiLCJzdGFydFRpbWUiOiIyMDE5LTAxLTE4VDIwOjAwOjAwLjAwMC0wNzowMCJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.VFEcx8lHicvjVr_b_md1QREmvjp7y1ggBvQ0H4T50sz_JXVhrOelnzI6FQWhOkNoAw-GTdz6ce3O-Nq4VEtwIAE"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 2)
     })).timeout(6002)

  it('should add yet another new claim', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .send({"jwtEncoded":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDc1MjczMzQsImV4cCI6MTU0NzYxMzczNCwic3ViIjoiZGlkOmV0aHI6MHg0ZmYxY2ZlYjU2ZGZhYTUxMjA4Njk2ZWEwMjk1NGJmYWFhMjliNTJhIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4NGZmMWNmZWI1NmRmYWE1MTIwODY5NmVhMDI5NTRiZmFhYTI5YjUyYSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE5LTAxLTEzVDA4OjAwOjAwLjAwMC0wNzowMCJ9fSwiaXNzIjoiZGlkOmV0aHI6MHg0ZmYxY2ZlYjU2ZGZhYTUxMjA4Njk2ZWEwMjk1NGJmYWFhMjliNTJhIn0.njNEA1neEdRLDJQDLpnt1fs_s37DWx58uGh3kA6U86Xv8a8-UGL8lYtVP3DFuKMZQTR_7bOGD0tEk4aqbZFxKgA"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 3)
     })).timeout(7500)

  it('should add another new confirmation', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .send({"jwtEncoded":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDg0ODQ0OTQsImV4cCI6MTU0ODU3MDg5NCwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IkNvbmZpcm1hdGlvbiIsIm9yaWdpbmFsQ2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLjAwMC0wNzowMCJ9fX0sImlzcyI6ImRpZDpldGhyOjB4NGZmMWNmZWI1NmRmYWE1MTIwODY5NmVhMDI5NTRiZmFhYTI5YjUyYSJ9.aCVQwIGcM5Wt9lKT9KASMWs-R_jHvpxdCVDaAG7vdXSI54m-3ZxGW6YByZemKcXLhc6CSxIaEMVNj1b1oeOE4AA"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 4)
     })).timeout(6002)

  it('should add a new join claim for a debug event (Trent @ home, Thurs night debug, 2019-02-01T02:00:00Z)', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .send({"jwtEncoded":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDg5OTY2ODUsImV4cCI6MTU0OTA4MzA4NSwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IlRyZW50IEAgaG9tZSJ9LCJuYW1lIjoiVGh1cnMgbmlnaHQgZGVidWciLCJzdGFydFRpbWUiOiIyMDE5LTAyLTAxVDAyOjAwOjAwWiJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.BzIZK1rZ-8pGjkl2A8pA4tulBA9ugK8isbT4EExlrN0IZh5LG5IA7Bs4Qvxd200ST9DwIgK4aBplAEZ1D1jfuAE"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 5)
     })).timeout(6002)


  it('should add another new confirmation of two claims', () =>
     request(Server)
     .post('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .send({"jwtEncoded":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NTIxODYyNDIsImV4cCI6MTU1MjI3MjY0Miwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IkNvbmZpcm1hdGlvbiIsIm9yaWdpbmFsQ2xhaW1zIjpbeyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJKb2luQWN0aW9uIiwiYWdlbnQiOnsiZGlkIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0sImV2ZW50Ijp7Im9yZ2FuaXplciI6eyJuYW1lIjoiVHJlbnQgQCBob21lIn0sIm5hbWUiOiJUaHVycyBuaWdodCBkZWJ1ZyIsInN0YXJ0VGltZSI6IjIwMTktMDItMDEgMDI6MDA6MDAifX0seyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJKb2luQWN0aW9uIiwiYWdlbnQiOnsiZGlkIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0sImV2ZW50Ijp7Im9yZ2FuaXplciI6eyJuYW1lIjoiQm91bnRpZnVsIFZvbHVudGFyeWlzdCBDb21tdW5pdHkifSwibmFtZSI6IlNhdHVyZGF5IE1vcm5pbmcgTWVldGluZyIsInN0YXJ0VGltZSI6IjIwMTgtMTItMjkgMTU6MDA6MDAifX1dfSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.yBxNZ77UHPlQ5Vdga11fSPuvsp3z9jwt6ExC4eHLu_2VFET6e_V5nBvv4acHVk33_r1R9cuD_o09SVFkG8IYXgE"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 6)
     })).timeout(6002)

})

describe('Action', () => {

  it('should get action with the right properties', () =>
     request(Server)
     .get('/api/action/' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.property('agentDid')
         .that.equals('did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e')
       expect(r.body)
         .that.has.property('jwtId')
         .that.equals(firstId)
       expect(r.body)
         .that.has.property('eventId')
         .that.equals(firstId)
       expect(r.body)
         .that.has.property('eventOrgName')
         .that.equals('Bountiful Voluntaryist Community')
       expect(r.body)
         .that.has.property('eventName')
         .that.equals('Saturday Morning Meeting')
       expect(r.body)
         .that.has.property('eventStartTime')
         .that.equals('2018-12-29 15:00:00')
     })).timeout(3001)

  it('should get complaint about a missing JWT', () =>
     request(Server)
     .get('/api/action/' + firstId)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(400)
       expect(r.body)
         .that.equals("Missing JWT In " + UPORT_PUSH_TOKEN_HEADER)
     }))


  it('should get action with the DID hidden', () =>
     request(Server)
     .get('/api/action/' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt2)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.property('agentDid')
         .that.equals(HIDDEN_TEXT)
       expect(r.body)
         .that.has.property('eventStartTime')
         .that.equals('2018-12-29 15:00:00')
     })).timeout(3001)

  it('should get no actions that match query', () =>
     request(Server)
     .get('/api/action?eventStartTime=2018-12-29T14:59:59Z')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
     })).timeout(3001)

  it('should get one action that matched query', () =>
     request(Server)
     .get('/api/action?eventStartTime=2018-12-29T15:00:00Z')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       let action1 = r.body[0]
       expect(action1)
         .that.has.property('agentDid')
         .that.equals('did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e')
       expect(action1)
         .that.has.property('eventId')
         .that.equals(firstId)
       expect(action1)
         .that.has.property('eventOrgName')
         .that.equals('Bountiful Voluntaryist Community')
       expect(action1)
         .that.has.property('eventName')
         .that.equals('Saturday Morning Meeting')
       expect(action1)
         .that.has.property('eventStartTime')
         .that.equals('2018-12-29 15:00:00')
     })).timeout(3001)

  it('should get enough past claims', () =>
     request(Server)
     .get('/api/action/?eventStartTime_greaterThanOrEqualTo=' + DAY_START_TIME_STRING)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(4)
       let action1 = r.body[0]
       expect(action1)
         .that.has.property('agentDid')
         .that.equals('did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e')
       expect(action1)
         .that.has.property('eventId')
         .that.equals(firstId + 3)
       expect(action1)
         .that.has.property('eventOrgName')
         .that.equals('Trent @ home')
       expect(action1)
         .that.has.property('eventName')
         .that.equals('Thurs night debug')
       expect(action1)
         .that.has.property('eventStartTime')
         .that.equals('2019-02-01 02:00:00')
     }))

  it('should get no claims today', () =>
     request(Server)
     .get('/api/action/?eventStartTime_greaterThanOrEqualTo=' + TODAY_START_TIME_STRING)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
     })).timeout(3001)

})

describe('Event', () => {

  it('should get event with the right properties', () =>
     request(Server)
     .get('/api/event/' + firstId)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.property('orgName')
         .that.equals('Bountiful Voluntaryist Community')
       expect(r.body)
         .that.has.property('name')
         .that.equals('Saturday Morning Meeting')
       expect(r.body)
         .that.has.property('startTime')
         .that.equals('2018-12-29 15:00:00')
     })).timeout(3001)

  it('should get 1 event', () =>
     request(Server)
     .get('/api/event?orgName=Bountiful%20Voluntaryist%20Community')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
     }))

  it('should get a set of action claims & confirmations', () =>
     request(Server)
     .get('/api/event/1/actionClaimsAndConfirmations')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.body[0])
         .to.be.an('object')
         .that.has.property('action')
         .that.has.property('agentDid')
         .that.equals('did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e')
       expect(r.body[0])
         .to.be.an('object')
         .that.has.property('confirmations')
         .that.has.property(0)
         .that.has.property('issuer')
         .that.equals('did:ethr:0x4ff1cfeb56dfaa51208696ea02954bfaaa29b52a')

     }))

})

describe('Tenure', () => {

  it ('should create a tenure', () =>
      request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
      .send({"jwtEncoded":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NTUyNTgyODMsImV4cCI6MTU1NTM0NDY4Mywic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IlRlbnVyZSIsInNwYXRpYWxVbml0Ijp7ImdlbyI6eyJAdHlwZSI6Ikdlb1NoYXBlIiwicG9seWdvbiI6IjQwLjg4Mzk0NCwtMTExLjg4NDc4NyA0MC44ODQwODgsLTExMS44ODQ3ODcgNDAuODg0MDg4LC0xMTEuODg0NTE1IDQwLjg4Mzk0NCwtMTExLjg4NDUxNSA0MC44ODM5NDQsLTExMS44ODQ3ODcifX0sInBhcnR5Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.g7jKukK9a2NAf2AHrrtQLNWePmkU1iLya1EFUdRxvk18zNJBFdHF77YoZMhz5VAW4cIgaUhnzVqNgVrXLc7RSAE"})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body)
          .to.be.a('number')
          .that.equals(firstId + 7)
      })).timeout(6000)

  it('should get 1 claim', () =>
     request(Server)
     .get('/api/claim?claimType=Tenure')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
     }))

})

describe('Report', () => {

  it('should get right aggregated info', () =>
     request(Server)
     .get('/api/report/actionClaimsAndConfirmationsSince?dateTime=' + START_TIME_STRING)
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.property('did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e')
       let df0Claims = r.body['did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e']
       expect(df0Claims)
         .to.be.an('array')
       expect(df0Claims[0].confirmations)
         .to.be.an('array')
         .of.length(2)
       expect(r.body)
         .to.be.an('object')
         .that.has.property('did:ethr:0x4ff1cfeb56dfaa51208696ea02954bfaaa29b52a')
     }))

  it('should get 1 tenure', () =>
     request(Server)
     .get('/api/report/tenureClaimsAtPoint?lat=40.883944&lon=-111.884787')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
     })).timeout(3001)

  it('should get no tenures', () =>
     request(Server)
     .get('/api/report/tenureClaimsAtPoint?lat=40.883943&lon=-111.884787')
     .set(UPORT_PUSH_TOKEN_HEADER, globalJwt1)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
     }))

})
