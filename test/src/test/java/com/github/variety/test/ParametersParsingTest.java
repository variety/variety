package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.VarietyAnalysis;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Verify, that variety can read and use(re-print to stdout) passed parameters like limit, sort, query and maxDepth.
 */
public class ParametersParsingTest {

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
     * Verify default parameters of variety.
     */
    @Test
    public void verifyDefaultResultsStdout() throws Exception {
        final VarietyAnalysis analysis = variety.runAnalysis();

        final Map<String, String> params = getParamsMap(analysis.getStdOut());

        Assert.assertEquals("99", params.get(Variety.PARAM_MAXDEPTH));
        Assert.assertEquals("{ }", params.get(Variety.PARAM_QUERY));
        Assert.assertEquals("{ \"_id\" : -1 }", params.get(Variety.PARAM_SORT));
        Assert.assertEquals("5", params.get(Variety.PARAM_LIMIT)); // TODO: why is limit configured to current count, not set as 'unlimited'? It could save one count query
    }

    /**
     * Verify, that all passed parameters are correctly recognized and printed out in stdout of variety.
     */
    @Test
    public void verifyRestrictedResultsStdout() throws Exception {
        final VarietyAnalysis analysis = variety
                .withQuery("{name:'Harry'}")
                .withSort("{name:1}")
                .withMaxDepth(5)
                .withLimit(2)
                .runAnalysis();

        final Map<String, String> params = getParamsMap(analysis.getStdOut());

        Assert.assertEquals("5", params.get(Variety.PARAM_MAXDEPTH));
        Assert.assertEquals("{ \"name\" : \"Harry\" }", params.get(Variety.PARAM_QUERY));
        Assert.assertEquals("{ \"name\" : 1 }", params.get(Variety.PARAM_SORT));
        Assert.assertEquals("2", params.get(Variety.PARAM_LIMIT));
    }

    /**
     * Verify, that variety recognizes unknown or empty collection and exists. In stdout should be recorded reason.
     */
    @Test
    public void testUnknownCollectionResponse() throws Exception {
        this.variety = new Variety("test", "--unknown--");
        try {
            variety.runAnalysis();
            Assert.fail("It should throw exception");
        } catch (final RuntimeException e) {
            Assert.assertTrue(e.getMessage().contains("does not exist or is empty"));
        }
    }

    @Test
    public void testDefaultOutputFormatParam() throws Exception {
        final VarietyAnalysis analysis = variety.runAnalysis(); // format option not provided
        final Map<String, String> params = getParamsMap(analysis.getStdOut());
        Assert.assertEquals("ascii", params.get(Variety.PARAM_OUTPUT_FORMAT));
    }

    @Test
    public void testAsciiOutputFormatParam() throws Exception {
        final VarietyAnalysis analysis = variety.withFormat(Variety.FORMAT_ASCII).runAnalysis();
        final Map<String, String> params = getParamsMap(analysis.getStdOut());
        Assert.assertEquals("ascii", params.get(Variety.PARAM_OUTPUT_FORMAT));
    }

    @Test
    public void testJsonOutputFormatParam() throws Exception {
        final VarietyAnalysis analysis = variety.withFormat(Variety.FORMAT_JSON).runAnalysis();
        final Map<String, String> params = getParamsMap(analysis.getStdOut());
        Assert.assertEquals("json", params.get(Variety.PARAM_OUTPUT_FORMAT));
    }

    /**
     * @param stdout Text from mongo shell, containing variety config output + json results
     * @return Map of config values
     */
    private Map<String, String> getParamsMap(final String stdout) {
        return Stream.of(stdout.split("\n"))
                .filter(line -> line.startsWith("Using "))
                .map(v -> v.replace("Using ", ""))
                .collect(Collectors.toMap(k -> k.split(" of ")[0], v -> v.split(" of ")[1]));
    }
}
