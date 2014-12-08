package com.github.variety.validator;

public interface ResultsValidator {
    void validate(String key, long totalOccurrences, double percentContaining, String... types);
    long getResultsCount();
    String getStdOut();
}
