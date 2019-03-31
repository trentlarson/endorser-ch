// npm install --save neo4j
var neo4j = require('neo4j-driver').v1;
var driver = new neo4j.driver('bolt://localhost', neo4j.auth.basic("neo4j","endorser"));
var session = driver.session();

// Run a Cypher statement, reading the result in a streaming manner as records arrive:

/**
session
//  .run('MERGE (a:Person {name:{nameParam}}) RETURN a', {nameParam:'Bob2'})
  .run('MERGE (e:Event {name:{name}, orgName:{orgName}, startTime:datetime({startTime})}) RETURN e', {name:'Saturday Morning Meeting', orgName:'Bountiful Voluntaryist Community', startTime:'2019-03-23T08:00:00.000-06:00'})
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

let mergeClaim =
    'MERGE \
  (e:Event {name:{name}, orgName:{orgName}, startTime:datetime({startTime})}) \
  MERGE \
  (a:ActionClaim {eventName:{name}, eventOrgName:{orgName}, eventStartTime:datetime({startTime})}) \
  MERGE \
  (e)-[:ACTION_EVENT]->(a) \
  RETURN *'

let mergeConfirm =
    'MERGE \
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




// var insertQuery = 
// "UNWIND {pairs} as pair \
//    MERGE (p1:Person {name:pair[0]}) \
//    MERGE (p2:Person {name:pair[1]}) \
//    MERGE (p1)-[:KNOWS]-(p2)";

// var foafQuery = 
//  "MATCH (person:Person)-[:KNOWS]-(friend)-[:KNOWS]-(foaf) \
//   WHERE person.name = {name} \
//    AND NOT (person)-[:KNOWS]-(foaf) \
//   RETURN foaf.name AS name";

// var commonFriendsQuery =
// "MATCH (user:Person)-[:KNOWS]-(friend)-[:KNOWS]-(foaf:Person) \
//  WHERE user.name = {name1} AND foaf.name = {name2} \
//  RETURN friend.name AS friend";

// var connectingPathsQuery =
// "MATCH path = shortestPath((p1:Person)-[:KNOWS*..6]-(p2:Person)) \
//  WHERE p1.name = {name1} AND p2.name = {name2} \
//  RETURN [n IN nodes(path) | n.name] as names";

// var data = [["Jim","Mike"],["Jim","Billy"],["Anna","Jim"],
//             ["Anna","Mike"],["Sally","Anna"],["Joe","Sally"],
//             ["Joe","Bob"],["Bob","Sally"]];

// function query(query, params, column, cb) {
//     function callback(err, results) {
//         if (err || !results) throw err;
//         if (!column) cb(results)
//         else results.forEach(function(row) { cb(row[column]) });
//     };
//     db.cypher({ query: query, params: params}, callback);
// }

// query(insertQuery, {pairs: data}, null, function () {
//     query(foafQuery, {name: "Joe"},"name", console.log); 
//     query(commonFriendsQuery, {name1: "Joe", name2:"Sally"},"friend",console.log);
//     query(connectingPathsQuery, {name1: "Joe", name2:"Billy"}, "names", 
//           function(res) { console.log(res)});
// });
