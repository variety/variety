package com.github.variety;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.StringJoiner;

public class MongoShell {

    private final boolean quiet;
    private final Credentials credentials;
    private final String eval;
    private final String database;
    private final String script;

    public MongoShell(final String database, final Credentials credentials, final String eval, final String script, final boolean quiet) {
        this.quiet = quiet;
        this.credentials = credentials;
        this.eval = eval;
        this.database = database;
        this.script = script;
    }

    public String execute() throws IOException, InterruptedException {
        final List<String> commands = new ArrayList<>();
        commands.add("mongo");
        if (database != null && !database.isEmpty()) {
            commands.add(this.database);
        }
        if (quiet) {
            commands.add("--quiet");
        }

        if (credentials != null) {
            commands.add("--username");
            commands.add(credentials.getUsername());
            commands.add("--password");
            commands.add(credentials.getPassword());
            commands.add("--authenticationDatabase");
            commands.add(credentials.getAuthDatabase());
        }

        if (eval != null && !eval.isEmpty()) {
            commands.add("--eval");
            commands.add(eval);
        }

        if (script != null && !script.isEmpty()) {
            commands.add(script);
        }

        final String[] cmdarray = commands.toArray(new String[commands.size()]);
        final Process child = Runtime.getRuntime().exec(cmdarray);

        final int returnCode = child.waitFor();
        final String stdOut = readStream(child.getInputStream());

        if (returnCode != 0) {
            throw new RuntimeException("Failed to execute MongoDB shell with arguments: " + Arrays.toString(cmdarray) + ".\n" + stdOut);
        }
        return stdOut;
    }

    /**
     * Converts input stream to String containing lines separated by \n
     */
    private String readStream(final InputStream stream) {
        final BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        final StringJoiner builder = new StringJoiner("\n");
        reader.lines().forEach(builder::add);
        return builder.toString();
    }
}
