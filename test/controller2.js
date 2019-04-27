import chai from 'chai'
import request from 'supertest'
import R from 'ramda'

import Server from '../server'
import { HIDDEN_TEXT, UPORT_PUSH_TOKEN_HEADER } from '../server/api/services/util'

const expect = chai.expect

// from https://developer.uport.space/uport-credentials/reference/index and https://developer.uport.space/credentials/transactions
const { Credentials } = require('uport-credentials')
// from Credentials.createIdentity();
var creds = [
  { did: 'did:ethr:0x7bc41517a0397b24eef6a5f2875cdad84c6595df', privateKey: 'f2e9656d76980171bba6791be99a000aa2babde1b41a7da77049ce20c7daebf0' },
  { did: 'did:ethr:0x275cee0e4657075d3b9564940fe39194e9cedceb', privateKey: '923035e1d86a95d11859be1e8c8657aa1725edfaab1792faedcc94d82467b57c' },
  { did: 'did:ethr:0xbfb23cacc8659cb79cd9582d6b11fe0a2c8e7478', privateKey: 'ece0e7d174f80ff6164dd5dc94c616de457e753f72de1cfc913c440e11dd76a5' },
  { did: 'did:ethr:0x9e4d3803025b9989c7e49f0e0be193e28463e3c7', privateKey: '589391737cdf00ce1f9467ed7b3d90c259699818d838badeceb02de248ba0ece' }
]

var credentials = R.map((c) => new Credentials(c), creds)

let tomorrow = Math.floor(new Date().getTime() / 1000) + (24 * 60 * 60)

let pushTokens = R.map((c) => c.createVerification({ exp: tomorrow }), credentials)

var allTokens
before(async () => {
  await Promise.all(pushTokens).then((allJwts) => { allTokens = allJwts })
})

describe('Set of Test Claims', () => {

  it ('should create a tenure', () => {
      request(Server)
      .post('/api/claim')
      .set(UPORT_PUSH_TOKEN_HEADER, allTokens[0])
      .send({"jwtEncoded":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NTUyNTgyODMsImV4cCI6MTU1NTM0NDY4Mywic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IlRlbnVyZSIsInNwYXRpYWxVbml0Ijp7ImdlbyI6eyJAdHlwZSI6Ikdlb1NoYXBlIiwicG9seWdvbiI6IjQwLjg4Mzk0NCwtMTExLjg4NDc4NyA0MC44ODQwODgsLTExMS44ODQ3ODcgNDAuODg0MDg4LC0xMTEuODg0NTE1IDQwLjg4Mzk0NCwtMTExLjg4NDUxNSA0MC44ODM5NDQsLTExMS44ODQ3ODcifX0sInBhcnR5Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.g7jKukK9a2NAf2AHrrtQLNWePmkU1iLya1EFUdRxvk18zNJBFdHF77YoZMhz5VAW4cIgaUhnzVqNgVrXLc7RSAE"})
      .expect('Content-Type', /json/)
      .then(r => {
        expect(r.body)
          .to.be.a('number')
      })}).timeout(5001)

  it('should get claims but cannot see inside', () => {
     request(Server)
     .get('/api/claim')
     .set(UPORT_PUSH_TOKEN_HEADER, allTokens[0])
     .expect('Content-Type', /json/)
     .then(r => {
       for (var i = 0; i < r.body.length; i++) {
         expect(allDidsAreHidden(r.body[i]))
           .to.be.true
       }
     })})

})


