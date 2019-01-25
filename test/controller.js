import * as childProcess from 'child_process';
import chai from 'chai';
import request from 'supertest';
import Server from '../server';

let dbInfo = require('../conf/flyway.js')

const expect = chai.expect;

var firstId = 1

describe('Claim', () => {

  it('should get no claims', () =>
     request(Server)
     .get('/api/claim')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(0)
     }))

  it('should get a 404, missing claim #0', () =>
     request(Server)
     .get('/api/claim/0')
     .then(r => {
       expect(400)
     }))

  it('should add a new claim', () =>
     request(Server)
     .post('/api/claim')
     .send({"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDczNjMyMDQsImV4cCI6MTU0NzQ0OTYwNCwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE4LTEyLTI5VDA4OjAwOjAwLjAwMC0wNzowMCJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.uwutl2jx7lHqLeDRbEv6mKxUSUY75X91g-V0fpJcKZ2dO9jUYnZ9VEkS7rpsD8lcdYoQ7f5H8_3LT_vhqE-9UgA"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId)
     })).timeout(5000)

  it('should get a claim #' + firstId, () =>
     request(Server)
     .get('/api/claim/' + firstId)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.a.property('claimContext')
         .that.equals('http://schema.org')
       expect(r.body)
         .that.has.a.property('claimType')
         .that.equals('JoinAction')
     }))

  it('should add a new confirmation', () =>
     request(Server)
     .post('/api/claim')
     .send({"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDczNjMzMzIsImV4cCI6MTU0NzQ0OTczMiwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IkNvbmZpcm1hdGlvbiIsImNsYWltRW5jb2RlZCI6ImV5SkFZMjl1ZEdWNGRDSTZJbWgwZEhBNkx5OXpZMmhsYldFdWIzSm5JaXdpUUhSNWNHVWlPaUpLYjJsdVFXTjBhVzl1SWl3aVlXZGxiblFpT25zaVpHbGtJam9pWkdsa09tVjBhSEk2TUhoa1pqQmtPR1UxWm1ReU16UXdPRFptTmpZME9XWTNOMkppTURBMU9XUmxNV0ZsWW1ReE5ETmxJbjBzSW1WMlpXNTBJanA3SW05eVoyRnVhWHBsY2lJNmV5SnVZVzFsSWpvaVFtOTFiblJwWm5Wc0lGWnZiSFZ1ZEdGeWVXbHpkQ0JEYjIxdGRXNXBkSGtpZlN3aWJtRnRaU0k2SWxOaGRIVnlaR0Y1SUUxdmNtNXBibWNnVFdWbGRHbHVaeUlzSW5OMFlYSjBWR2x0WlNJNklqSXdNVGd0TVRJdE1qbFVNRGc2TURBNk1EQXVNREF3TFRBM09qQXdJbjE5In0sImlzcyI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9.JzDwaMO1omEdWvUD3yeG4atZypQAondyPnzYpZUbLf5QW6-B_P5xHu5th7s9uhdiYPhxoRLMBDjeQH2UzOgydQA"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 1)
     })).timeout(10000)

  it('should get 2 claims', () =>
     request(Server)
     .get('/api/claim')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
     }))

  it('should get 1 claim', () =>
     request(Server)
     .get('/api/claim?claimType=JoinAction')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
     }))

  it('should get 1 comfirmation', () =>
     request(Server)
     .get('/api/claim?claimType=Confirmation')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
     }))

  it('should add another new claim', () =>
     request(Server)
     .post('/api/claim')
     .send({"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDc4NjcxOTIsImV4cCI6MTU0Nzk1MzU5Miwic3ViIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4ZGYwZDhlNWZkMjM0MDg2ZjY2NDlmNzdiYjAwNTlkZTFhZWJkMTQzZSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6Ik1lLCBNeXNlbGYsIGFuZCBJIn0sIm5hbWUiOiJGcmlkYXkgbmlnaHQiLCJzdGFydFRpbWUiOiIyMDE5LTAxLTE4VDIwOjAwOjAwLjAwMC0wNzowMCJ9fSwiaXNzIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0.VFEcx8lHicvjVr_b_md1QREmvjp7y1ggBvQ0H4T50sz_JXVhrOelnzI6FQWhOkNoAw-GTdz6ce3O-Nq4VEtwIAE"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 2)
     })).timeout(5000)

  it('should add yet another new claim', () =>
     request(Server)
     .post('/api/claim')
     .send({"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDc1MjczMzQsImV4cCI6MTU0NzYxMzczNCwic3ViIjoiZGlkOmV0aHI6MHg0ZmYxY2ZlYjU2ZGZhYTUxMjA4Njk2ZWEwMjk1NGJmYWFhMjliNTJhIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vc2NoZW1hLm9yZyIsIkB0eXBlIjoiSm9pbkFjdGlvbiIsImFnZW50Ijp7ImRpZCI6ImRpZDpldGhyOjB4NGZmMWNmZWI1NmRmYWE1MTIwODY5NmVhMDI5NTRiZmFhYTI5YjUyYSJ9LCJldmVudCI6eyJvcmdhbml6ZXIiOnsibmFtZSI6IkJvdW50aWZ1bCBWb2x1bnRhcnlpc3QgQ29tbXVuaXR5In0sIm5hbWUiOiJTYXR1cmRheSBNb3JuaW5nIE1lZXRpbmciLCJzdGFydFRpbWUiOiIyMDE5LTAxLTEzVDA4OjAwOjAwLjAwMC0wNzowMCJ9fSwiaXNzIjoiZGlkOmV0aHI6MHg0ZmYxY2ZlYjU2ZGZhYTUxMjA4Njk2ZWEwMjk1NGJmYWFhMjliNTJhIn0.njNEA1neEdRLDJQDLpnt1fs_s37DWx58uGh3kA6U86Xv8a8-UGL8lYtVP3DFuKMZQTR_7bOGD0tEk4aqbZFxKgA"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 3)
     })).timeout(5000)

  it('should add another new confirmation', () =>
     request(Server)
     .post('/api/claim')
     .send({"jwtEncoded": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NkstUiJ9.eyJpYXQiOjE1NDc0MzE1MTcsImV4cCI6MTU0NzUxNzkxNywic3ViIjoiZGlkOmV0aHI6MHg0ZmYxY2ZlYjU2ZGZhYTUxMjA4Njk2ZWEwMjk1NGJmYWFhMjliNTJhIiwiY2xhaW0iOnsiQGNvbnRleHQiOiJodHRwOi8vZW5kb3JzZXIuY2giLCJAdHlwZSI6IkNvbmZpcm1hdGlvbiIsImNsYWltRW5jb2RlZCI6ImV5SkFZMjl1ZEdWNGRDSTZJbWgwZEhBNkx5OXpZMmhsYldFdWIzSm5JaXdpUUhSNWNHVWlPaUpLYjJsdVFXTjBhVzl1SWl3aVlXZGxiblFpT25zaVpHbGtJam9pWkdsa09tVjBhSEk2TUhoa1pqQmtPR1UxWm1ReU16UXdPRFptTmpZME9XWTNOMkppTURBMU9XUmxNV0ZsWW1ReE5ETmxJbjBzSW1WMlpXNTBJanA3SW05eVoyRnVhWHBsY2lJNmV5SnVZVzFsSWpvaVFtOTFiblJwWm5Wc0lGWnZiSFZ1ZEdGeWVXbHpkQ0JEYjIxdGRXNXBkSGtpZlN3aWJtRnRaU0k2SWxOaGRIVnlaR0Y1SUUxdmNtNXBibWNnVFdWbGRHbHVaeUlzSW5OMFlYSjBWR2x0WlNJNklqSXdNVGd0TVRJdE1qbFVNRGc2TURBNk1EQXVNREF3TFRBM09qQXdJbjE5In0sImlzcyI6ImRpZDpldGhyOjB4NGZmMWNmZWI1NmRmYWE1MTIwODY5NmVhMDI5NTRiZmFhYTI5YjUyYSJ9.ssYRH4WR4_qqY5SJuatQuXLCu1Cz0cUjEXV_wUlUlkYJADkRLGqhPIeGvJ3r8UudwA8A9R1YsbA4i32SYRxScgE"})
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.a('number')
         .that.equals(firstId + 4)
     })).timeout(10000)

})

describe('Action', () => {

  it('should get action with the right properties', () =>
     request(Server)
     .get('/api/action/' + firstId)
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('object')
         .that.has.property('did')
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
       expect(r.body)
         .that.has.property('claimEncoded')
         .that.equals('eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJKb2luQWN0aW9uIiwiYWdlbnQiOnsiZGlkIjoiZGlkOmV0aHI6MHhkZjBkOGU1ZmQyMzQwODZmNjY0OWY3N2JiMDA1OWRlMWFlYmQxNDNlIn0sImV2ZW50Ijp7Im9yZ2FuaXplciI6eyJuYW1lIjoiQm91bnRpZnVsIFZvbHVudGFyeWlzdCBDb21tdW5pdHkifSwibmFtZSI6IlNhdHVyZGF5IE1vcm5pbmcgTWVldGluZyIsInN0YXJ0VGltZSI6IjIwMTgtMTItMjlUMDg6MDA6MDAuMDAwLTA3OjAwIn19')
     }))

})

describe('Event', () => {

  it('should get event with the right properties', () =>
     request(Server)
     .get('/api/event/' + firstId)
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
     }))

  it('should get 1 event', () =>
     request(Server)
     .get('/api/event?orgName=Bountiful%20Voluntaryist%20Community')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(r.body)
         .to.be.an('array')
         .of.length(2)
     }))

  it('should get a set of action claims & confirmations', () =>
     request(Server)
     .get('/api/event/1/actionClaimsAndConfirmations')
     .expect('Content-Type', /json/)
     .then(r => {
       console.log(r.body)
       expect(r.body)
         .to.be.an('array')
         .of.length(1)
       expect(r.body[0])
         .to.be.an('object')
         .that.has.property('action')
         .that.has.property('did')
         .that.equals('did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e')
     }))

})

describe('Report', () => {

  it('should get right aggregated info', () =>
     request(Server)
     .get('/api/report/actionClaimsAndConfirmationsSince?dateTime=2018-12-29T08:00:00.000-07:00')
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

})

describe('Util', () => {

  it('should get a sorted object', () =>
     request(Server)
     .get('/api/util/objectWithKeysSorted?object=\{"b":\[5,1,2,3,\{"bc":3,"bb":2,"ba":1\}\],"c":\{"cb":2,"ca":1\},"a":4\}')
     .expect('Content-Type', /json/)
     .then(r => {
       expect(JSON.stringify(r.body))
         .to.deep.equal('{"a":4,"b":[5,1,2,3,{"ba":1,"bb":2,"bc":3}],"c":{"ca":1,"cb":2}}')
     }))

})
