package com.github.variety.test;

import junit.framework.AssertionFailedError;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Compare, that variety version info is identical in variety.js and in CHANGELOG files.
 */
public class VersionInfoTest {

    public static final Pattern VARIETYJS_PATTERN = Pattern.compile("\\w+\\('(.+), released (.+)'\\).*");
    public static final Pattern CHANGELOG_PATTERN = Pattern.compile("\\((.+)\\)(.+):(.*)");
    
    private List<String> varietyLines;
    private List<String> changelogLines;

    @Before
    public void setUp() throws Exception {
        varietyLines = Files.readAllLines(getFile("variety.js"));
        changelogLines = Files.readAllLines(getFile("CHANGELOG"));
    }

    @Test
    public void testVersionsEquality() throws Exception {
        Assert.assertEquals("Version provided in variety.js is different from given in CHANGELOG",
                getChangelogVersion(changelogLines), getVarietyVersion(varietyLines));
    }

    @Test
    public void testDatesEquality() throws Exception {
        Assert.assertEquals("Date provided in variety.js is different from given in CHANGELOG",
                getChangelogDate(changelogLines), getVarietyDate(varietyLines));
    }

    private String getVarietyVersion(List<String> variety) {
        return getVarietyPatternGroup(variety, 1);
    }

    private String getVarietyDate(List<String> variety) {
        return getVarietyPatternGroup(variety, 2);
    }

    private String getChangelogDate(List<String> changelog) {
        return getChangelogPatternGroup(changelog, 1);
    }

    private String getChangelogVersion(List<String> changelog) {
        return getChangelogPatternGroup(changelog, 2);
    }

    private String getVarietyPatternGroup(final List<String> variety, final int group) {
        for (String line : variety) {
            final Matcher matcher = VARIETYJS_PATTERN.matcher(line);
            if (matcher.matches()) {
                return matcher.group(group);
            }
        }
        throw new AssertionFailedError("Variety.js does not contain version and date info");
    }

    private String getChangelogPatternGroup(final List<String> changelog, final int group) {
        final Matcher matcher = CHANGELOG_PATTERN.matcher(changelog.get(0));
        if (!matcher.find()) {
            throw new AssertionFailedError("CHANGELOG does not contain version and date info");
        }
        return matcher.group(group).trim();
    }

    private Path getFile(String filename) {
        // on linux could it be for example /{path_to_project}/variety/test/target/test-classes
        final String testClassesPath = this.getClass().getResource("/").getFile();

        // traverse from test classes path to variety base directory
        return Paths.get(testClassesPath).getParent().getParent().getParent().resolve(filename);
    }
}
