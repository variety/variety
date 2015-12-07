package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.validator.ResultsValidator;
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
        final ResultsValidator analysis = variety
                .withQuiet(true) // do not output any other metadata, only results
                .withFormat(Variety.FORMAT_JSON)
                .runJsonAnalysis();

        // there should be seven different json results
        Assert.assertEquals(7, analysis.getResultsCount());
    }

    @Test
    public void verifyAsciiTableOutput() throws Exception {
        final ResultsValidator analysis = variety.withFormat(Variety.FORMAT_ASCII).runDatabaseAnalysis();

        // filter only lines starting with character '|'
        final String actual = Stream.of(analysis.getStdOut().split("\n"))
                .filter(line -> line.startsWith("|") || line.startsWith("+"))
                .collect(Collectors.joining("\n"));

        Assert.assertEquals(SampleData.getExpectedDataAsciiTable(), actual);

    }
}
