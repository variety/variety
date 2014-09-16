package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.VarietyAnalysis;
import com.mongodb.DBObject;
import com.mongodb.util.JSON;
import org.junit.After;
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

        analysis.verifyResult("_id", 2, 100, "ObjectId");
        analysis.verifyResult("title", 2, 100, "String");
        analysis.verifyResult("comments", 2, 100, "Array");


        // TODO: current version of variety is not able to handle unnamed inside objects. Earlier they were marked with XX. key prefix.
        // Now the unnamed object are skipped and not analysed at all. Example of earlier version results can be seen
        // in issue https://github.com/variety/variety/issues/29

        // There should be 6 different keys: _id, title, comments and three from anonymous objects: comments.XX.author, comments.XX.body, comments.XX.visible
        // FIXME: Assert.assertEquals(6, analysis.getResultsCollection().count());

        // FIXME: analysis.verifyResult("comments.XX.author", 2, 100, "String");
        // FIXME: analysis.verifyResult("comments.XX.body", 2, 100, "String");
        // FIXME: analysis.verifyResult("comments.XX.visible", 1, 50, "Boolean");
    }
}
