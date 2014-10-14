package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.VarietyAnalysis;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

public class QueryLimitedAnalysisTest {
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
    public void testQueryLimitedAnalysis() throws Exception {
        final VarietyAnalysis analysis = variety.withQuery("{someBinData:{$exists: true}}").runAnalysis();
        Assert.assertEquals(3, analysis.getResultsCollection().count());

        // we analyzed only the keys of objects defined by query. But total counts and percents are computed from the complete collection
        analysis.verifyResult("_id", 5, 100, "ObjectId");
        analysis.verifyResult("name", 5, 100, "String");
        analysis.verifyResult("someBinData", 1, 20, "BinData-old");

    }
}
