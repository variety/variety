// This script contains initial data from Variety README. It will be called once before test run. All data created here
// should be removed in cleanup.js script. It is not necessary on Travis-CI, but very useful on local environments

use test;

db.users.insert({name: "Tom", bio: "A nice guy.", pets: ["monkey", "fish"], someWeirdLegacyKey: "I like Ike!"});
db.users.insert({name: "Dick", bio: "I swordfight.", birthday: new Date("1974/03/14")});
db.users.insert({name: "Harry", pets: "egret", birthday: new Date("1984/03/14")});
db.users.insert({name: "Geneviève", bio: "Ça va?"});
db.users.insert({name: "Jim", someBinData: new BinData(2,"1234")});