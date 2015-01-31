package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.validator.ResultsValidator;
import com.mongodb.DBObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/**
 * Tests limit functionality of variety. It should analyse only first _n_ objects.
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
        // limit=1 without other params selects the last inserted document (see SampleData class)
        // it should equals {name: "Jim", someBinData: new BinData(2,"1234")}
        analysis.validate("_id", 1, 100, "ObjectId");
        analysis.validate("name", 1, 100, "String");
        analysis.validate("someBinData", 1, 100, "BinData-old");
    }
}
