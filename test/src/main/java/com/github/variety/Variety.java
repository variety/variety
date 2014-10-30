package com.github.variety;

import com.mongodb.DB;
import com.mongodb.DBCollection;
import com.mongodb.MongoClient;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
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


    private final String inputDatabase;
    private final String inputCollection;
    private final MongoClient mongoClient;

    private Integer limit;
    private Integer maxDepth;
    private String query;
    private String sort;
    private String outputFormat;

    private boolean verbose = true;

    /**
     * Create variety wrapper with defined connection do analysed database and collection
     * @param database name of database, that will be analysed
     * @param collection name of collection, that will be analysed
     * @throws UnknownHostException Thrown when fails connection do default host and port of MongoDB
     */
    public Variety(final String database, final String collection) throws UnknownHostException {
        this.inputDatabase = database;
        this.inputCollection = collection;
        this.mongoClient = new MongoClient();
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

    public Variety withFormat(final String format) {
        this.outputFormat = format;
        return this;
    }

    /**
     * Enable analysis output stdout of script to stdout of java process.
     * Deprecated because it should only be used for debugging of test, not real/production tests itself. If you
     * need to read stdout of variety, it can be accessed through {@link VarietyAnalysis#getStdOut()}
     */
    @Deprecated()
    public Variety verbose() {
        this.verbose = true;
        return this;
    }

    /**
     * Executes mongo shell with configured variety options and variety.js script in path.
     * @return Results of analysis including stdout of variety.js and verifier of collected keys
     * @throws IOException
     * @throws InterruptedException
     */
    public VarietyAnalysis runAnalysis() throws IOException, InterruptedException {
        final String[] commands = new String[]{"mongo", this.inputDatabase,  "--eval", buildParams(), getVarietyPath()};
        final Process child = Runtime.getRuntime().exec(commands);

        final int returnCode = child.waitFor();
        final String stdOut = readStream(child.getInputStream());

        if(returnCode != 0) {
            throw new RuntimeException("Failed to execute variety.js with arguments: " + Arrays.toString(commands) + ".\n" + stdOut);
        } else if(verbose) {
            System.out.println(stdOut);
        }
        return new VarietyAnalysis(mongoClient, inputCollection, stdOut);
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

    /**
     * Converts input stream to String containing lines separated by \n
     */
    private String readStream(final InputStream stream)  {
        final BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        final StringJoiner builder = new StringJoiner("\n");
        reader.lines().forEach(builder::add);
        return builder.toString();
    }
}
