package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.validator.ResultsValidator;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

/**
 * Variety can read '--quiet' option passed to mongo shell and mute all debug/metadata logs. In this case only
 * results should be printed. Together with output format set to json should be possible to simply forward output
 * from variety to another tool processing valid json.
 */
public class QuietOptionTest {

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
     * verify, that output contains only results table and nothing more
     */
    @Test
    public void testQuietLogs() throws Exception {
        final ResultsValidator varietyAnalysis = variety.withQuiet(true).runDatabaseAnalysis();
        Assert.assertEquals(SampleData.getExpectedDataAsciiTable(), varietyAnalysis.getStdOut());
    }
}
