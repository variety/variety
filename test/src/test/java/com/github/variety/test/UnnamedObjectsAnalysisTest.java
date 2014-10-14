package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.VarietyAnalysis;
import com.mongodb.DBObject;
import com.mongodb.util.JSON;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

/**
 * Test, how variety handles objects, that are not named (for example objects inside array).
 * It addresses behavior described in issue https://github.com/variety/variety/issues/29
 */
public class UnnamedObjectsAnalysisTest {

    private Variety variety;

    @Before
    public void setUp() throws Exception {
        this.variety = new Variety("test", "users");
        variety.getSourceCollection().insert((DBObject) JSON.parse("{title:'Article 1', comments:[{author:'John', body:'it works', visible:true }]}"));
        variety.getSourceCollection().insert((DBObject) JSON.parse("{title:'Article 2', comments:[{author:'Tom', body:'thanks'}]}"));
    }

    @After
    public void tearDown() throws Exception {
        variety.getVarietyResultsDatabase().dropDatabase();
        variety.getSourceCollection().drop();
    }

    @Test
    public void testUnnamedObjects() throws Exception {
        final VarietyAnalysis analysis = variety.runAnalysis();

        Assert.assertEquals(6, analysis.getResultsCollection().count());

        analysis.verifyResult("_id", 2, 100, "ObjectId");
        analysis.verifyResult("title", 2, 100, "String");
        analysis.verifyResult("comments", 2, 100, "Array");

        // unnamed objects are prefixed with .XX key
        analysis.verifyResult("comments.XX.author", 2, 100, "String");
        analysis.verifyResult("comments.XX.body", 2, 100, "String");
        analysis.verifyResult("comments.XX.visible", 1, 50, "Boolean");
    }
}
