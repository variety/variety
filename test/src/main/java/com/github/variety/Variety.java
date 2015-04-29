package com.github.variety;

import com.github.variety.validator.DbResultsValidator;
import com.github.variety.validator.JsonResultsValidator;
import com.github.variety.validator.ResultsValidator;
import com.mongodb.DB;
import com.mongodb.DBCollection;
import com.mongodb.MongoClient;
import com.mongodb.ServerAddress;

import java.io.IOException;
import java.net.UnknownHostException;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.StringJoiner;

/**
 * Variety wrapper, provides access to MongoDB database, collection and execution of variety analysis.
 */
public class Variety {

    /**
     * Hardcoded database name in variety.js for analysis results
     */
    public static final String VARIETY_RESULTS_DBNAME = "varietyResults";
    public static final String FORMAT_JSON = "json";
    public static final String FORMAT_ASCII = "ascii";

    public static final String PARAM_QUERY = "query";
    public static final String PARAM_SORT = "sort";
    public static final String PARAM_MAXDEPTH = "maxDepth";
    public static final String PARAM_LIMIT = "limit";
    public static final String PARAM_OUTPUT_FORMAT = "outputFormat";
    public static final String PARAM_PERSIST_RESULTS = "persistResults";
    public static final String PARAM_PLUGINS = "plugins";


    private final String inputDatabase;
    private final String inputCollection;
    private final MongoClient mongoClient;

    private final Credentials credentials;

    private Integer limit;
    private Integer maxDepth;
    private String query;
    private String sort;
    private String outputFormat;
    private boolean quiet;
    private boolean persistResults;
    private String[] plugins;

    /**
     * Create variety wrapper with defined connection do analysed database and collection
     * @param database   name of database, that will be analysed
     * @param collection name of collection, that will be analysed
     * @throws UnknownHostException Thrown when fails connection do default host and port of MongoDB
     */
    public Variety(final String database, final String collection) throws UnknownHostException {
        this(database, collection, null);
    }

    public Variety(final String inputDatabase, final String inputCollection, final Credentials credentials) throws UnknownHostException {
        this.inputDatabase = inputDatabase;
        this.inputCollection = inputCollection;
        this.credentials = credentials;

        if (credentials == null) {
            this.mongoClient = new MongoClient();
        } else {
            this.mongoClient = new MongoClient(new ServerAddress("localhost"), Arrays.asList(credentials.getMongoCredential()));
        }
    }

    /**
     * @return Access to MongoDB database, where variety stores computed results
     */
    public DB getVarietyResultsDatabase() {
        return mongoClient.getDB(VARIETY_RESULTS_DBNAME);
    }

    /**
     * @return Access to collection with source data, that are provided for analysis
     */
    public DBCollection getSourceCollection() {
        return mongoClient.getDB(inputDatabase).getCollection(inputCollection);
    }

    /**
     * Variety wrapper for {@code limit} option
     */
    public Variety withLimit(final Integer limit) {
        this.limit = limit;
        return this;
    }

    /**
     * Variety wrapper for {@code maxDepth} option
     */
    public Variety withMaxDepth(final Integer maxDepth) {
        this.maxDepth = maxDepth;
        return this;
    }

    /**
     * Variety wrapper for {@code query} option
     */
    public Variety withQuery(final String query) {
        this.query = query;
        return this;
    }

    /**
     * Variety wrapper for {@code sort} option
     */
    public Variety withSort(final String sort) {
        this.sort = sort;
        return this;
    }

    /**
     * Variety wrapper for {@code format} option.
     * @param format valid values are either 'json' or 'ascii'
     */
    public Variety withFormat(final String format) {
        this.outputFormat = format;
        return this;
    }

    /**
     * Wrapper for command line option '--quiet', that is passed to mongo shell. Variety is able to read this option
     * and mute its logs with metadata.
     */
    public Variety withQuiet(final boolean quiet) {
        this.quiet = quiet;
        return this;
    }

    /**
     * Variety wrapper for {@code persistResults} option
     */
    public Variety withPersistResults(final boolean persistResults) {
        this.persistResults = persistResults;
        return this;
    }

    public Variety withPlugins(String... plugins) {
        this.plugins = plugins;
        return this;
    }

    /**
     * Executes mongo shell with configured variety options and variety.js script in path.
     * @return Stdout of variety.js
     */
    public String runAnalysis() throws IOException, InterruptedException {
        final MongoShell mongoShell = new MongoShell(inputDatabase, credentials, buildParams(), getVarietyPath(), quiet);
        final String result = mongoShell.execute();
        System.out.println(result);
        return result;
    }

    public ResultsValidator runJsonAnalysis() throws IOException, InterruptedException {
        final String stdOut = withFormat(FORMAT_JSON).withQuiet(true).runAnalysis();
        return new JsonResultsValidator(stdOut);
    }

    public ResultsValidator runDatabaseAnalysis() throws IOException, InterruptedException {
        final String stdOut = withFormat(FORMAT_ASCII).withPersistResults(true).runAnalysis();
        return new DbResultsValidator(mongoClient, inputCollection, stdOut);
    }

    /**
     * @return Params passed to mongo client together with variety. Collection name is always present, other are optional
     */
    private String buildParams() {
        final StringJoiner args = new StringJoiner(",");
        args.add("var collection = '" + inputCollection + "'");

        if(limit != null) {
            args.add(PARAM_LIMIT + " = " + limit);
        }

        if(maxDepth != null) {
            args.add(PARAM_MAXDEPTH + " = " + maxDepth);
        }

        if(query != null && !query.isEmpty()) {
            args.add(PARAM_QUERY + " = " + query);
        }

        if(sort != null && !sort.isEmpty()) {
            args.add(PARAM_SORT + " = " + sort);
        }

        if(outputFormat != null) {
            args.add(PARAM_OUTPUT_FORMAT + " = '" + outputFormat + "'");
        }

        if(persistResults) {
            args.add(PARAM_PERSIST_RESULTS + " = " + persistResults);
        }

        if(plugins != null && plugins.length > 0) {
            args.add(PARAM_PLUGINS + " = \"" + String.join(",", plugins) +  "\"");
        }

        return args.toString();
    }

    /**
     * @return detect absolute path to variety.js, stored in same repository as this tests.
     */
    private String getVarietyPath() {
        // TODO: is there any better way how to compute relative path to variety.js?
        // relative path from maven compiled classes root to variety.js file.
        return Paths.get(this.getClass().getResource("/").getFile()).getParent().getParent().getParent().resolve("variety.js").toString();
    }


}
