package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.validator.ResultsValidator;
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
        final ResultsValidator analysis = variety.withQuery("{birthday:{$exists: true}}").runDatabaseAnalysis();
        Assert.assertEquals(5, analysis.getResultsCount());

        analysis.validate("_id", 2, 100, "ObjectId");
        analysis.validate("birthday", 2, 100, "String");
        analysis.validate("name", 2, 100, "String");
        analysis.validate("bio", 1, 50, "String");
        analysis.validate("pets", 1, 50, "String");


    }
}
