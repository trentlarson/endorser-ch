
/** commenting out since it runs every time when we `npm run test`

// npm install --save neo4j
var neo4j = require('neo4j-driver')
// for server v3
var driver = new neo4j.driver('bolt://localhost', neo4j.auth.basic("neo4j","endorserendorser"))
// for server v4
//var driver = new neo4j.driver('neo4j://localhost', neo4j.auth.basic("neo4j","endorserendorser"))
var session = driver.session()

// Run a Cypher statement, reading the result in a streaming manner as records arrive:

// just a query
session.run('match (n) return n', {}).then(result => {
  result.records.forEach(record => {
    console.log(record.get('n'))
  })
}).catch(error => {
  console.log(error)
})


// create person
session.run('MERGE (james:Person {name : $nameParam}) RETURN james.name AS name', {
  nameParam: 'James'
}).then(result => {
  result.records.forEach(record => {
    console.log(record.get('name'))
  })
}).catch(error => {
  console.log(error)
})



var mergeClaim = '\
  MERGE \
  (e:Event {name:{name}, orgName:{orgName}, startTime:({startTime})}) \
  MERGE \
  (a:ActionClaim {eventName:{name}, eventOrgName:{orgName}, eventStartTime:({startTime})}) \
  MERGE \
  (e)-[:ACTION_EVENT]->(a) \
  RETURN *'

let values = {name:'Saturday Morning Meeting', orgName:'Bountiful Voluntaryist Community', startTime:'2019-03-23T08:00:00.000-06:00', issuerDid:"did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e"}

session.run(mergeClaim, values).then(result => {
  result.records.forEach(record => {
  console.log(record.get('e'), "\n", record.get('a'))
  })
}).catch(error => {
  console.log(error)
})




let mergeConfirm =
    '\
  MERGE \
  (e:Event {name:{name}, orgName:{orgName}, startTime:datetime({startTime})}) \
  MERGE \
  (a:ActionClaim {eventName:{name}, eventOrgName:{orgName}, eventStartTime:datetime({startTime})}) \
  MERGE \
  (c:Confirmation {issuer:{issuerDid}}) \
  MERGE \
  (a)-[:ACTION_EVENT]->(e) \
  MERGE \
  (c)-[:CONFIRM_ACTION]->(a) \
  RETURN *'

let values = {name:'Saturday Morning Meeting', orgName:'Bountiful Voluntaryist Community', startTime:'2019-03-23T08:00:00.000-06:00', issuerDid:"did:ethr:0xdf0d8e5fd234086f6649f77bb0059de1aebd143e"}

session
  .run(mergeConfirm, values)
  .subscribe({
    onNext: function (record) {
      console.log(record.get('e'));
    },
    onCompleted: function () {
      driver.close()
    },
    onError: function (error) {
      console.log(error);
    }
  });

**/
