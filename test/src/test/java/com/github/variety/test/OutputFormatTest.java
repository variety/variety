package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.VarietyAnalysis;
import com.mongodb.BasicDBList;
import com.mongodb.util.JSON;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.util.stream.Collectors;
import java.util.stream.Stream;

public class OutputFormatTest {

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
        final VarietyAnalysis analysis = variety
                .withQuiet(true) // do not output any other metadata, only results
                .withFormat(Variety.FORMAT_JSON)
                .runAnalysis();

        // Verify, that output is parse-able json by transforming stdout to json
        final BasicDBList parsed = (BasicDBList) JSON.parse(analysis.getStdOut());

        // there should be seven different json results
        Assert.assertEquals(7, parsed.size());
    }

    @Test
    public void verifyAsciiTableOutput() throws Exception {
        final VarietyAnalysis analysis = variety.withFormat(Variety.FORMAT_ASCII).runAnalysis();

        // filter only lines starting with character '|'
        final String actual = Stream.of(analysis.getStdOut().split("\n"))
                .filter(line -> line.startsWith("|") || line.startsWith("+"))
                .collect(Collectors.joining("\n"));

        Assert.assertEquals(SampleData.EXPECTED_DATA_ASCII_TABLE, actual);

    }
}
