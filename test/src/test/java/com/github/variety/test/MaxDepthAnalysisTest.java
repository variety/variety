package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.validator.ResultsValidator;
import com.mongodb.DBObject;
import com.mongodb.util.JSON;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

public class MaxDepthAnalysisTest {

    private static final double EXPECTED_PERCENTS = 100;
    private Variety variety;

    @Before
    public void setUp() throws Exception {
        variety = new Variety("test", "users");
        variety.getSourceCollection().insert((DBObject) JSON.parse("{name:'Walter', someNestedObject:{a:{b:{c:{d:{e:1}}}}}})"));

    }

    @After
    public void tearDown() throws Exception {
        variety.getVarietyResultsDatabase().dropDatabase();
        variety.getSourceCollection().drop();
    }

    @Test
    public void testUnlimitedAnalysis() throws Exception {
        final ResultsValidator analysis = variety.runDatabaseAnalysis();
        Assert.assertEquals("Variety results have not correct count of entries", 8, analysis.getResultsCount()); // 8 results, including '_id' and 'name'

        analysis.validate("_id", 1, EXPECTED_PERCENTS, "ObjectId");
        analysis.validate("name", 1, EXPECTED_PERCENTS, "String");

        analysis.validate("someNestedObject", 1, EXPECTED_PERCENTS, "Object");
        analysis.validate("someNestedObject.a", 1, EXPECTED_PERCENTS, "Object");
        analysis.validate("someNestedObject.a.b", 1, EXPECTED_PERCENTS, "Object");
        analysis.validate("someNestedObject.a.b.c", 1, EXPECTED_PERCENTS, "Object");
        analysis.validate("someNestedObject.a.b.c.d", 1, EXPECTED_PERCENTS, "Object");
        analysis.validate("someNestedObject.a.b.c.d.e", 1, EXPECTED_PERCENTS, "Number");
    }

    @Test
    public void testLimitedDepthAnalysis() throws Exception {
        final ResultsValidator analysis = variety.withMaxDepth(3).runDatabaseAnalysis();

        Assert.assertEquals("Variety results have not correct count of entries", 5, analysis.getResultsCount()); // 5 results, including '_id' and 'name'

        analysis.validate("_id", 1, EXPECTED_PERCENTS, "ObjectId");
        analysis.validate("name", 1, EXPECTED_PERCENTS, "String");

        analysis.validate("someNestedObject", 1, EXPECTED_PERCENTS, "Object");
        analysis.validate("someNestedObject.a", 1, EXPECTED_PERCENTS, "Object");
        analysis.validate("someNestedObject.a.b", 1, EXPECTED_PERCENTS, "Object");
    }


}
