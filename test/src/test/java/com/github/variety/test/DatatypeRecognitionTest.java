package com.github.variety.test;

import com.github.variety.Variety;
import com.github.variety.VarietyAnalysis;
import com.mongodb.BasicDBObject;
import org.bson.types.Binary;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.util.ArrayList;
import java.util.Date;

/**
 * Verify, that variety can recognize all usual datatypes, including different bindata types.
 * This test addresses issue https://github.com/variety/variety/issues/8
 */
public class DatatypeRecognitionTest {

    private Variety variety;

    @Before
    public void setUp() throws Exception {
        this.variety = new Variety("test", "users");
        variety.getSourceCollection().insert(new BasicDBObject()
            .append("key_string", "Just plain String")
            .append("key_boolean", true)
            .append("key_number", 1)
            .append("key_date", new Date())
            .append("key_binData-generic", new Binary((byte)0x00, new byte[]{1,2,3,4}))
            .append("key_binData-function", new Binary((byte) 0x01, new byte[]{1,2,3,4}))
            .append("key_binData-old", new Binary((byte) 0x02, new byte[]{1,2,3,4}))
            .append("key_binData-UUID", new Binary((byte) 0x03, new byte[]{1,2,3,4}))
            .append("key_binData-MD5", new Binary((byte) 0x05, new byte[]{1,2,3,4}))
            .append("key_binData-user", new Binary((byte) 0x80, new byte[]{1,2,3,4}))
            .append("key_array", new ArrayList<>())
            .append("key_object", new BasicDBObject())
            .append("key_null", null)
        );
    }

    @After
    public void tearDown() throws Exception {
        variety.getVarietyResultsDatabase().dropDatabase();
        variety.getSourceCollection().drop();
    }

    @Test
    public void testDatatypeRecognition() throws Exception {
        final VarietyAnalysis analysis = variety.runAnalysis();

        Assert.assertEquals(14, analysis.getResultsCollection().count());

        analysis.verifyResult("_id", 1, 100, "ObjectId");
        analysis.verifyResult("key_string", 1, 100, "String");
        analysis.verifyResult("key_boolean", 1, 100, "Boolean");
        analysis.verifyResult("key_number", 1, 100, "Number");
        analysis.verifyResult("key_date", 1, 100, "Date");
        analysis.verifyResult("key_binData-generic", 1, 100, "BinData-generic");
        analysis.verifyResult("key_binData-function", 1, 100, "BinData-function");
        analysis.verifyResult("key_binData-old", 1, 100, "BinData-old");
        analysis.verifyResult("key_binData-UUID", 1, 100, "BinData-UUID");
        analysis.verifyResult("key_binData-MD5", 1, 100, "BinData-MD5");
        analysis.verifyResult("key_binData-user", 1, 100, "BinData-user");
        analysis.verifyResult("key_array", 1, 100, "Array");
        analysis.verifyResult("key_object", 1, 100, "Object");
        analysis.verifyResult("key_null", 1, 100, "null"); // TODO: why has 'null' first letter lowercase, unlike all other types?
    }
}
