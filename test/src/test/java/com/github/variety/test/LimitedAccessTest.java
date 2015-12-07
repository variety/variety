package com.github.variety.test;

import com.github.variety.Credentials;
import com.github.variety.MongoShell;
import com.github.variety.Variety;
import com.github.variety.validator.ResultsValidator;
import com.mongodb.MongoClient;
import com.mongodb.ServerAddress;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.io.IOException;
import java.util.Arrays;

/**
 * Tests, if variety can return results for user with read only access to analyzed database (without permission to list
 * all other dbs / collections, without permission to persist results).
 */
public class LimitedAccessTest {

    private Variety variety;
    private MongoClient adminConnection;

    @Before
    public void setUp() throws Exception {

        // create admin user (expects empty users table => no auth used for this connection)
        createUser(null, Credentials.ADMIN);

        // create limited user
        createUser(Credentials.ADMIN, Credentials.USER);

        // connect with admin credentials
        adminConnection = new MongoClient(new ServerAddress("localhost"), Arrays.asList(Credentials.ADMIN.getMongoCredential()));

        // create sample collection (logged admin user, writes to test DB)
        adminConnection.getDB("test").getCollection("users").insert(SampleData.getDocuments());

        // initialize variety with limited user credentials, connects to test/users collection
        variety = new Variety("test", "users", Credentials.USER);
    }

    private void createUser(final Credentials loginCredentials, final Credentials userToCreate) throws IOException, InterruptedException {
        final MongoShell shell = new MongoShell(userToCreate.getAuthDatabase(), loginCredentials, "db.addUser(" + userToCreate.getUserDocument() + ")", null, false);
       System.out.println(shell.execute());
    }

    @After
    public void tearDown() throws Exception {
        adminConnection.getDB("test").getCollection("users").drop();

        // remove both users from admin (auth) database. Caution, order is important - first delete user, then admin
        System.out.println(new MongoShell("test", Credentials.ADMIN, "db.removeUser('" + Credentials.USER.getUsername() + "')", null, false).execute());
        System.out.println(new MongoShell("admin", Credentials.ADMIN, "db.removeUser('" + Credentials.ADMIN.getUsername() + "')", null, false).execute());
    }

    /**
     * Validate correct results read from JSON standard output, limited user connection provided
     */
    @Test
    public void verifyBasicResultsJson() throws Exception {
        validate(variety.runJsonAnalysis());
    }

    @Test
    public void verifyBasicResultsAscii() throws Exception {
        final String stdout = variety.withPersistResults(false).withQuiet(true).runAnalysis();
        Assert.assertEquals(SampleData.getExpectedDataAsciiTable(), stdout);
    }


    @Test
    public void testNotFoundDatabaseForAdmin() throws Exception {
        final Variety adminVariety = new Variety("foo", "users", Credentials.ADMIN);
        try {
            adminVariety.runAnalysis();
            Assert.fail("Should throw exception");
        } catch (final Exception e) {
            System.out.println(e);
            final String messageVersion24 = "The collection specified (users) in the database specified (foo) does not exist or is empty";
            final String messageVersion26 = "The database specified (foo) does not exist";
            Assert.assertTrue(e.getMessage().contains(messageVersion24) || e.getMessage().contains(messageVersion26));
        }
    }

    @Test
    public void testNotFoundCollectionForAdmin() throws Exception {
        final Variety adminVariety = new Variety("test", "bar", Credentials.ADMIN);
        try {
            adminVariety.runAnalysis();
            Assert.fail("Should throw exception");
        } catch (final Exception e) {
            Assert.assertTrue(e.getMessage().contains("The collection specified (bar) in the database specified (test) does not exist or is empty."));
            Assert.assertTrue(e.getMessage().contains("Possible collection options for database specified:"));
        }
    }

    @Test
    public void testNotFoundCollectionForUser() throws Exception {
        final Variety adminVariety = new Variety("test", "bar", Credentials.USER);
        try {
            adminVariety.runAnalysis();
            Assert.fail("Should throw exception");
        } catch (final Exception e) {
            Assert.assertTrue(e.getMessage().contains("The collection specified (bar) in the database specified (test) does not exist or is empty."));
            Assert.assertTrue(e.getMessage().contains("Possible collection options for database specified:"));
        }
    }

    @Test
    public void testNotFoundDbForUser() throws Exception {
        final Variety adminVariety = new Variety("foo", "users", Credentials.USER);
        try {
            adminVariety.runAnalysis();
            Assert.fail("Should throw exception");
        } catch (final Exception e) {
            Assert.assertTrue("Exception should contain info about not authorized access, full message is: '" + e.getMessage() + "'", e.getMessage().contains("not authorized"));
        }
    }

    private void validate(final ResultsValidator analysis) {
        analysis.validate("_id", 5, 100, "ObjectId");
        analysis.validate("name", 5, 100, "String");
        analysis.validate("bio", 3, 60, "String");
        analysis.validate("pets", 2, 40, "String", "Array");
        analysis.validate("someBinData", 1, 20, "BinData-old");
        analysis.validate("someWeirdLegacyKey", 1, 20, "String");
    }
}
