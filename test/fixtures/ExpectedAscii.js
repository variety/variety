export default `

+--------------------------------------------------------------------+
| key                | types                | occurrences | percents |
| ------------------ | -------------------- | ----------- | -------- |
| _id                | ObjectId             |           5 |    100.0 |
| name               | String               |           5 |    100.0 |
| bio                | String               |           3 |     60.0 |
| birthday           | Date                 |           2 |     40.0 |
| pets               | String (1),Array (1) |           2 |     40.0 |
| someBinData        | BinData-generic      |           1 |     20.0 |
| someWeirdLegacyKey | String               |           1 |     20.0 |
+--------------------------------------------------------------------+

`.trim();
