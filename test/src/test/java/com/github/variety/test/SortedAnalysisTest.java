package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.VarietyAnalysis;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

/**
 * Verify, that variety can handle sort parameter and analyse collection in given order. It is useful only when
 * used together with limit.
 */
public class SortedAnalysisTest {

    private Variety variety;

    @Before
    public void setUp() throws Exception {
        variety = new Variety("test", "users");
        variety.getSourceCollection().insert(SampleData.getDocuments());
    }

    @After
    public void tearDown() throws Exception {
        variety.getVarietyResultsDatabase().dropDatabase();
        variety.getSourceCollection().drop();
    }

    @Test
    public void testSortedAnalysis() throws Exception {
        // Sort without limit or other query should not modify results itself. Analysis is done on the same data, only in another order.
        final VarietyAnalysis analysis = variety.withSort("{name:-1}").runAnalysis();
        analysis.verifyResult("_id", 5, 100, "ObjectId");
        analysis.verifyResult("name", 5, 100, "String");
        analysis.verifyResult("bio", 3, 60, "String");
        analysis.verifyResult("pets", 2, 40, "String", "Array");
        analysis.verifyResult("someBinData", 1, 20, "BinData-old");
        analysis.verifyResult("someWeirdLegacyKey", 1, 20, "String");

    }

    @Test
    public void testSortedAnalysisWithLimit() throws Exception {
        // when sorting default SampleData by name desc, first entry becomes Tom. He is only with key 'someWeirdLegacyKey'
        // Together with applying limit 1, Tom is the only result in analysis. That gives us chance to assume keys and verify
        // that ordering is correct.
        final VarietyAnalysis analysis = variety.withSort("{name:-1}").withLimit(1).runAnalysis();

        Assert.assertEquals(5, analysis.getResultsCollection().count());

        analysis.verifyResult("_id", 5, 100, "ObjectId");
        analysis.verifyResult("name", 5, 100, "String");
        analysis.verifyResult("bio", 3, 60, "String");
        analysis.verifyResult("pets", 2, 40, "Array");
        analysis.verifyResult("someWeirdLegacyKey", 1, 20, "String");

    }
}
