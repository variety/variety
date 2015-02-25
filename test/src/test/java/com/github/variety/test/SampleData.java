package com.github.variety.test;

import com.mongodb.BasicDBObjectBuilder;
import com.mongodb.DBObject;
import org.bson.types.Binary;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

class SampleData {

    /**
     * Ascii table representation of sample data results. It should be possible to verify actual output of Variety
     * against this table, to check correct formatting.
     */
    public static final String EXPECTED_DATA_ASCII_TABLE =
            "+------------------------------------------------------------+\n" +
            "| key                | types        | occurrences | percents |\n" +
            "| ------------------ | ------------ | ----------- | -------- |\n" +
            "| _id                | ObjectId     | 5           | 100      |\n" +
            "| name               | String       | 5           | 100      |\n" +
            "| bio                | String       | 3           | 60       |\n" +
            "| birthday           | String       | 2           | 40       |\n" +
            "| pets               | Array,String | 2           | 40       |\n" +
            "| someBinData        | BinData-old  | 1           | 20       |\n" +
            "| someWeirdLegacyKey | String       | 1           | 20       |\n" +
            "+------------------------------------------------------------+";

    /**
     * Java representation of sample collection provided in variety README:<p>
     *
     * {name: "Tom", bio: "A nice guy.", pets: ["monkey", "fish"], someWeirdLegacyKey: "I like Ike!"}<p>
     * {name: "Dick", bio: "I swordfight.", birthday: new Date("1974/03/14")}<p>
     * {name: "Harry", pets: "egret", birthday: new Date("1984/03/14")}<p>
     * {name: "Geneviève", bio: "Ça va?"}<p>
     * {name: "Jim", someBinData: new BinData(2,"1234")}<p>
     */
    public static List<DBObject> getDocuments() {
        final List<DBObject> examples = new ArrayList<>();
        examples.add(
            new BasicDBObjectBuilder()
                .add("name", "Tom")
                .add("bio", "A nice guy.")
                .add("pets", Arrays.asList("monkey", "fish"))
                .add("someWeirdLegacyKey", "I like Ike!")
            .get()
        );
        examples.add(
            new BasicDBObjectBuilder()
                .add("name", "Dick")
                .add("bio", "I swordfight.")
                .add("birthday", LocalDate.of(1974, 3, 14).toString())
            .get()
        );
        examples.add(
            new BasicDBObjectBuilder()
                .add("name", "Harry")
                .add("pets", "egret")
                .add("birthday", LocalDate.of(1984, 3, 14).toString())
            .get()
        );
        examples.add(
            new BasicDBObjectBuilder()
                .add("name", "Geneviève")
                .add("bio", "Ça va?")
            .get()
        );
        examples.add(
            new BasicDBObjectBuilder()
                .add("name", "Jim")
                .add("someBinData", new Binary((byte) 0x02, new byte[]{1,2,3,4}))
            .get()
        );

        return examples;
    }
}
