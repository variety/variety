package com.github.variety;

import com.mongodb.BasicDBObjectBuilder;
import com.mongodb.DBObject;
import com.mongodb.MongoCredential;
import com.mongodb.util.JSON;

/**
 * MongoDB access credentials for admin/root with unrestricted access and for user with read only database test
 */
public enum Credentials {
    ADMIN("admin", "variety_test_admin", "admin", "['userAdminAnyDatabase', 'readWriteAnyDatabase', 'dbAdminAnyDatabase']"),
    USER("test", "variety_test_user", "test", "['read']");

    /**
     * Name of database, where auth objects are stored.
     */
    public static final String AUTH_DATABASE_NAME = "admin";

    private final String authDatabase;
    private final String username;
    private final String password;
    private final String rolesJson;

    Credentials(final String authDatabase, final String username, final String password, final String rolesJson) {
        this.authDatabase = authDatabase;
        this.username = username;
        this.password = password;
        this.rolesJson = rolesJson;
    }

    public String getAuthDatabase() {
        return authDatabase;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }

    /**
     * @return Auth credentials for MongoDB Java driver.
     */
    public MongoCredential getMongoCredential() {
        return MongoCredential.createMongoCRCredential(getUsername(), getAuthDatabase(), getPassword().toCharArray());
    }

    /**
     * Convert username, password and roles to MongoDB document for user creation
     * @return json document to be passed to createUser (mongodb version >=2.6.x) / addUser function(mongodb 2.4.x)
     */
    public DBObject getUserDocument() {
        return new BasicDBObjectBuilder()
                .add("user", username)
                .add("pwd", password)
                .add("roles", JSON.parse(this.rolesJson))
                .get();
    }
}
