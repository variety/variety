package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.validator.ResultsValidator;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/**
 * Tests limit functionality of variety. It should analyse only first _n_ objects and then compute occurrences from
 * all objects in collection.
 */
public class LimitResultsAnalysisTest {

    private Variety variety;

    @Before
    public void setUp() throws Exception {
        this.variety = new Variety("test", "users");
        variety.getSourceCollection().insert(SampleData.getDocuments());
    }

    @After
    public void tearDown() throws Exception {
        variety.getVarietyResultsDatabase().dropDatabase();
        variety.getSourceCollection().drop();
    }

    @Test
    public void verifyLimitedResults() throws Exception {
        final ResultsValidator analysis = variety.withLimit(1).runDatabaseAnalysis();
        analysis.validate("_id", 5, 100, "ObjectId");
        analysis.validate("name", 5, 100, "String");

        analysis.validate("someBinData", 1, 20, "BinData-old");
    }
}
