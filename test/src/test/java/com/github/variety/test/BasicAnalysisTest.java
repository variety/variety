package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.VarietyAnalysis;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/**
 * Tests basic collection structure provided in readme of variety
 */
public class BasicAnalysisTest {

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
    public void verifyBasicResults() throws Exception {
        final VarietyAnalysis analysis = variety.runAnalysis();
        analysis.verifyResult("_id", 5, 100, "ObjectId");
        analysis.verifyResult("name", 5, 100, "String");
        analysis.verifyResult("bio", 3, 60, "String");
        analysis.verifyResult("pets", 2, 40, "String", "Array");
        analysis.verifyResult("someBinData", 1, 20, "BinData-old");
        analysis.verifyResult("someWeirdLegacyKey", 1, 20, "String");
    }
}
