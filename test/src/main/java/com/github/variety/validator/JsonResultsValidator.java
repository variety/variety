package com.github.variety.validator;

import com.mongodb.BasicDBList;
import com.mongodb.BasicDBObject;
import com.mongodb.util.JSON;
import org.junit.Assert;

import java.util.*;

public class JsonResultsValidator implements ResultsValidator {

    private final List<VarietyEntry> entries;
    private final String stdOut;

    public JsonResultsValidator(final String stdOut) {
        this.entries = parse(stdOut);
        this.stdOut = stdOut;
    }

    private List<VarietyEntry> parse(final String stdOut) {
        final BasicDBList parse = (BasicDBList) JSON.parse(stdOut);
        final List<VarietyEntry> entries = new ArrayList<>();
        for(final Object o : parse) {
            final BasicDBObject obj = (BasicDBObject)o;
            final String key = ((BasicDBObject)obj.get("_id")).getString("key");
            final long totalOccurrences = obj.getLong("totalOccurrences");
            final double percentContaining = obj.getDouble("percentContaining");
            final BasicDBObject typesObj = (BasicDBObject) ((BasicDBObject)obj.get("value")).get("types");
            final Set<String> types = typesObj.keySet();
            entries.add(new VarietyEntry(key, totalOccurrences, percentContaining, types));
        }
        return entries;
    }

    @Override
    public void validate(final String key, final long totalOccurrences, final double percentContaining, final String... types) {
        final Optional<VarietyEntry> first = entries.stream().filter(entry -> entry.getKey().equals(key)).findFirst();
        if(!first.isPresent()) {
            Assert.fail("Entry with key '" + key + "' not found in variety results");
        }

        final VarietyEntry varietyEntry = first.get();
        Assert.assertEquals("Failed to verify types of key " + key, new HashSet<>(Arrays.asList(types)), varietyEntry.getTypes());
        Assert.assertEquals("Failed to verify total occurrences of key " + key, totalOccurrences, varietyEntry.getTotalOccurrences());
        Assert.assertEquals("Failed to verify percents of key " + key, percentContaining, varietyEntry.getPercentContaining(), 1e-15); // TODO: precision?
    }

    @Override
    public long getResultsCount() {
        return entries.size();
    }

    public String getStdOut() {
        return stdOut;
    }

    private class VarietyEntry {
        private final String key;
        private final long totalOccurrences;
        private final double percentContaining;
        private final Set<String> types;

        private VarietyEntry(final String key, final long totalOccurrences, final double percentContaining, final Set<String> types) {
            this.key = key;
            this.totalOccurrences = totalOccurrences;
            this.percentContaining = percentContaining;
            this.types = types;
        }

        private String getKey() {
            return key;
        }

        private long getTotalOccurrences() {
            return totalOccurrences;
        }

        private double getPercentContaining() {
            return percentContaining;
        }

        private Set<String> getTypes() {
            return types;
        }
    }
}
