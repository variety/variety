package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.VarietyAnalysis;
import com.mongodb.DBObject;
import com.mongodb.util.JSON;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.util.stream.Stream;

/**
 * Variety outputs json-like results to stdout. Lets verify that.
 */
public class JsonOutputTest {

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
    public void verifyJsonEntries() throws Exception {
        final VarietyAnalysis analysis = variety.runAnalysis();

        // TODO: output itself is not valid JSON. It contains mongo shell output (can be removed with --quiet) and variety execution info.
        // At the end of output, there are printed records from result collection, every record on new line.
        // Valid json output is requested in issue https://github.com/variety/variety/issues/23

        // Verify, that every object is parse-able json by transforming strings to json stream
        // Results are detected by line starting with character '{'.
        final Stream<DBObject> objects = Stream.of(analysis.getStdOut().split("\n"))
                .filter(line -> line.startsWith("{"))
                .map(str -> (DBObject)JSON.parse(str));

        // there should be seven different json results in the stdout
        Assert.assertEquals(7, objects.count());
    }
}
