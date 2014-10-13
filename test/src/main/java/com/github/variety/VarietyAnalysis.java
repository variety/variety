package com.github.variety;

import com.mongodb.*;
import org.junit.Assert;

import java.util.Arrays;

/**
 * Results of variety.js run in mongo shell. Contains stdout of shell and access to results collection. For convenience there
 * is defined method verifyResult, that checks correct types and occurrences of desired key.
 */
public class VarietyAnalysis {

    private final MongoClient mongoClient;
    private final String sourceCollectionName;

    private final String stdOut;

    /**
     * @param mongoClient connection to MongoDB
     * @param sourceCollectionName name of original source collection. Used to access results in variety database
     * @param stdOut output of analysis execution - output of variety.js script
     */
    public VarietyAnalysis(final MongoClient mongoClient, final String sourceCollectionName, final String stdOut) {
        this.mongoClient = mongoClient;
        this.sourceCollectionName = sourceCollectionName;
        this.stdOut = stdOut;
    }

    /**
     * Verifier for collected results in variety analysis
     * @param key Results should contain entry with this key
     * @param totalOccurrences Results should contain entry with this total occurrences
     * @param percentContaining Results should contain entry with this relative percentage
     * @param types Expected data types of this entry (Based on MongoDB type names)
     */
    public void verifyResult(final String key, final double totalOccurrences, final double percentContaining, final String... types) {
        final DBCursor cursor = getResultsCollection().find(new BasicDBObject("_id.key", key));
        Assert.assertEquals("Entry with key '" + key + "' not found in variety results", 1, cursor.size());
        final DBObject result = cursor.next();

        verifyKeyTypes(key, result, types);

        Assert.assertEquals("Failed to verify total occurrences of key " + key, totalOccurrences, result.get("totalOccurrences"));
        Assert.assertEquals("Failed to verify percents of key " + key, percentContaining, result.get("percentContaining"));
        cursor.close();
    }

    private void verifyKeyTypes(final String key, final DBObject result, final String[] expectedTypes) {
        final BasicDBList types = (BasicDBList)((DBObject) result.get("value")).get("types");
        
        Assert.assertEquals(
            "Incorrect count of expected(" + Arrays.toString(expectedTypes) + ") and real types(" + Arrays.toString(types.toArray())
                + ") of key: " + key, expectedTypes.length, types.size());
        
        for (final String expected : expectedTypes) {
            if (!types.contains(expected)) {
                Assert.fail("Type '" + expected + "' not found in real types(" + Arrays.toString(expectedTypes) + ") of key: " + key);
            }
        }
       
    }

    /**
     * @return Direct access to variety results collection of this analysis
     */
    public DBCollection getResultsCollection() {
        return mongoClient.getDB(Variety.VARIETY_RESULTS_DBNAME).getCollection(getResultsCollectionName());
    }

    /**
     * @return Standard output of mongo client with variety.js analysis script executed.
     */
    public String getStdOut() {
        return stdOut;
    }

    /**
     * @return name of variety results collection name. Format is {_original_name_}Keys. For collection cars it will be carsKeys.
     */
    private String getResultsCollectionName() {
        return sourceCollectionName + "Keys";
    }
}
