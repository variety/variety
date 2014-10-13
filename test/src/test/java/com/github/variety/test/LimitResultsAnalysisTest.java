package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.VarietyAnalysis;
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
        final VarietyAnalysis analysis = variety.withLimit(1).runAnalysis();
        analysis.verifyResult("_id", 5, 100, "ObjectId");
        analysis.verifyResult("name", 5, 100, "String");

        // TODO: there is only one document with 'someBinData'. Why variety returns 5/100% instead of 1/20% ?
        // FIXME: analysis.verifyResult("someBinData", 1, 20, "BinData-old");
    }
}
