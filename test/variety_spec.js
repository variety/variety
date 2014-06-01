var mongo = require('mongodb');

var TESTED_COLLECTION_NAME = 'usersKeys';
var CONNECTION_STRING = 'mongodb://127.0.0.1:27017/varietyResults';

var mongoClient = mongo.MongoClient;

var withVarietyDb = function (callback) {
    mongoClient.connect(CONNECTION_STRING, function (err, db) {
        if (err) throw err;
        callback(db);
    });
};

var verifyVarietyResultEntry = function (keyName, expectedType, occurrencesCount, percentContaining, doneCallback) {
    withVarietyDb(function (db) {
        var collection = db.collection(TESTED_COLLECTION_NAME);
        collection.findOne({'_id.key': keyName}, function (err, result) {
            if (err) throw err;

            expect(result).not.toBeNull();
            if (result != null) {
                expect(result.value.types).toEqual(expectedType);
                expect(result.totalOccurrences).toEqual(occurrencesCount);
                expect(result.percentContaining).toEqual(percentContaining);
            }
            db.close();
            doneCallback();
        });
    });
};

describe("Variety results", function () {

    it("should verify correct count of results", function (done) {
        withVarietyDb(function (db) {
            db.collection(TESTED_COLLECTION_NAME).count(function (err, count) {
                if (err) throw err;

                expect(count).toEqual(7);

                db.close();
                done();
            });
        });
    });

    it("should verify correct '_id' result", function (done) {
        verifyVarietyResultEntry("_id", ["ObjectId"], 5, 100, done);
    });

    it("should verify correct 'name' result", function (done) {
        verifyVarietyResultEntry("name", ["String"], 5, 100, done);
    });

    it("should verify correct 'name' result", function (done) {
        verifyVarietyResultEntry("bio", ["String"], 3, 60, done);
    });

    it("should verify correct 'pets' result", function (done) {
        verifyVarietyResultEntry("pets", [ "String", "Array" ], 2, 40, done);
    });

    it("should verify correct 'birthday' result", function (done) {
        verifyVarietyResultEntry("birthday", ["Date"], 2, 40, done);
    });

    it("should verify correct 'someBinData' result", function (done) {
        verifyVarietyResultEntry("someBinData", ["BinData-old"], 1, 20, done);
    });

    it("should verify correct 'someWeirdLegacyKey' result", function (done) {
        verifyVarietyResultEntry("someWeirdLegacyKey", ["String"], 1, 20, done);
    });
});
