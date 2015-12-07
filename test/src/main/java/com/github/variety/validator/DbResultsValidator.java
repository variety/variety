package com.github.variety.validator;

import com.github.variety.Variety;
import com.mongodb.*;
import org.junit.Assert;

import java.util.Arrays;
import java.util.Set;

public class DbResultsValidator implements ResultsValidator {


    private final MongoClient mongoClient;
    private final String sourceCollectionName;
    private final String stdOut;

    public DbResultsValidator(final MongoClient mongoClient, final String sourceCollectionName, final String stdOut) {
        this.mongoClient = mongoClient;
        this.sourceCollectionName = sourceCollectionName;
        this.stdOut = stdOut;
    }

    @Override
    public void validate(final String key, final long totalOccurrences, final double percentContaining, final String... types) {
        verifyResult(key, totalOccurrences, percentContaining, types);
    }

    @Override
    public long getResultsCount() {
        return getResultsCollection().count();
    }

    public String getStdOut() {
        return stdOut;
    }

    /**
     * Verifier for collected results in variety analysis
     * @param key Results should contain entry with this key
     * @param totalOccurrences Results should contain entry with this total occurrences
     * @param percentContaining Results should contain entry with this relative percentage
     * @param types Expected data types of this entry (Based on MongoDB type names)
     */
    private void verifyResult(final String key, final long totalOccurrences, final double percentContaining, final String... types) {
        final DBCursor cursor = getResultsCollection().find(new BasicDBObject("_id.key", key));
        Assert.assertEquals("Entry with key '" + key + "' not found in variety results", 1, cursor.size());
        final DBObject result = cursor.next();

        verifyKeyTypes(key, result, types);

        Assert.assertEquals("Failed to verify total occurrences of key " + key, totalOccurrences, ((Double)result.get("totalOccurrences")).longValue());
        Assert.assertEquals("Failed to verify percents of key " + key, percentContaining, result.get("percentContaining"));
        cursor.close();
    }

    private void verifyKeyTypes(final String key, final DBObject result, final String[] expectedTypes) {
        final BasicDBObject typesObj = (BasicDBObject)((BasicDBObject)result.get("value")).get("types");
        final Set<String> types = typesObj.keySet();

        Assert.assertEquals(
                "Incorrect count of expected(" + Arrays.toString(expectedTypes) + ") and real types(" + Arrays.toString(types.toArray())
                        + ") of key: " + key, expectedTypes.length, types.size());

        for (final String expected : expectedTypes) {
            if (!types.contains(expected)) {
                Assert.fail("Type '" + expected + "' not found in real types(" + Arrays.toString(expectedTypes) + ") of key: " + key);
            }
        }

    }

    private DBCollection getResultsCollection() {
        return mongoClient.getDB(Variety.VARIETY_RESULTS_DBNAME).getCollection(getResultsCollectionName());
    }

    /**
     * @return name of variety results collection name. Format is {_original_name_}Keys. For collection cars it will be carsKeys.
     */
    private String getResultsCollectionName() {
        return sourceCollectionName + "Keys";
    }
}
