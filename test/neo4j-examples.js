
/** commenting out since it runs every time when we `npm run test`

// npm install --save neo4j
var neo4j = require('neo4j-driver').v1;
var driver = new neo4j.driver('bolt://localhost', neo4j.auth.basic("neo4j","endorser"));
var session = driver.session();

// Run a Cypher statement, reading the result in a streaming manner as records arrive:

let mergeClaim =
    '\
  MERGE \
  (e:Event {name:{name}, orgName:{orgName}, startTime:datetime({startTime})}) \
  MERGE \
  (a:ActionClaim {eventName:{name}, eventOrgName:{orgName}, eventStartTime:datetime({startTime})}) \
  MERGE \
  (e)-[:ACTION_EVENT]->(a) \
  RETURN *'

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
