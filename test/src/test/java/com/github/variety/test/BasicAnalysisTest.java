package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.validator.ResultsValidator;
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

    /**
     * Validate correct results read from DB
     */
    @Test
    public void verifyBasicResultsDb() throws Exception {
        validate(variety.runDatabaseAnalysis());
    }

    /**
     * Validate correct results read from JSON standard output
     */
    @Test
    public void verifyBasicResultsJson() throws Exception {
        validate(variety.runJsonAnalysis());
    }

    private void validate(final ResultsValidator analysis) {
        analysis.validate("_id", 5, 100, "ObjectId");
        analysis.validate("name", 5, 100, "String");
        analysis.validate("bio", 3, 60, "String");
        analysis.validate("pets", 2, 40, "String", "Array");
        analysis.validate("someBinData", 1, 20, "BinData-old");
        analysis.validate("someWeirdLegacyKey", 1, 20, "String");
    }
}
