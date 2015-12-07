package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.validator.ResultsValidator;
import jdk.nashorn.internal.runtime.regexp.joni.Regex;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.net.URL;
import java.util.regex.Pattern;

public class PluginsTest {

    private Variety variety;

    public static final String EXPECTED_OUTPUT =
            "key|types|occurrences|percents\n" +
            "_id|ObjectId|5|100\n" +
            "name|String|5|100\n" +
            "bio|String|3|60\n" +
            "birthday|String|2|40\n" +
            "pets|Array,String|2|40\n" +
            "someBinData|BinData-old|1|20\n" +
            "someWeirdLegacyKey|String|1|20";

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
    public void verifyFormatResults() throws Exception {
        final String path = getPluginPath("/csvplugin.js");
        final ResultsValidator analysis = variety.withQuiet(true).withPlugins(path).runDatabaseAnalysis();
        Assert.assertEquals(EXPECTED_OUTPUT, analysis.getStdOut());
    }

    @Test
    public void verifyPluginParamParsing() throws Exception {
        final String path = getPluginPath("/csvplugin.js");
        final ResultsValidator analysis = variety.withPlugins(path + "|delimiter=;").runDatabaseAnalysis();
        Assert.assertTrue(analysis.getStdOut().contains(path));
    }

    private String getPluginPath(final String name) {
        final URL resource = this.getClass().getResource(name);
        return resource.getFile();
    }
}
