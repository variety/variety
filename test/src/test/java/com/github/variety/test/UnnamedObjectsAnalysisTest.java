package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.validator.ResultsValidator;
import com.mongodb.DBObject;
import com.mongodb.util.JSON;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.util.Arrays;

/**
 * Test, how variety handles objects, that are not named (for example objects inside array).
 * It addresses behavior described in issue https://github.com/variety/variety/issues/29
 */
public class UnnamedObjectsAnalysisTest {

    private Variety variety;

    @Before
    public void setUp() throws Exception {
        this.variety = new Variety("test", "users");
        variety.getSourceCollection().insert(Arrays.asList(
                createDbObj("{title:'Article 1', comments:[{author:'John', body:'it works', visible:true }]}"),
                createDbObj("{title:'Article 2', comments:[{author:'Tom', body:'thanks'}, {author:'Mark', body:1}]}")
        ));
    }

    private DBObject createDbObj(final String json) {
        return (DBObject) JSON.parse(json);
    }

    @After
    public void tearDown() throws Exception {
        variety.getVarietyResultsDatabase().dropDatabase();
        variety.getSourceCollection().drop();
    }

    @Test
    public void testUnnamedObjects() throws Exception {
        final ResultsValidator analysis = variety.runDatabaseAnalysis();

        Assert.assertEquals(6, analysis.getResultsCount());

        analysis.validate("_id", 2, 100, "ObjectId");
        analysis.validate("title", 2, 100, "String");
        analysis.validate("comments", 2, 100, "Array");

        // unnamed objects are prefixed with .XX key
        analysis.validate("comments.XX.author", 2, 100, "String");
        analysis.validate("comments.XX.body", 2, 100, "String", "Number");
        analysis.validate("comments.XX.visible", 1, 50, "Boolean");
    }
}
