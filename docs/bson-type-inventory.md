# MongoDB BSON Type Inventory

External sources retrieved: 2026-04-21
Local evidence inspected: 2026-04-23

This document inventories the BSON value types that MongoDB can store or has
historically recognized, including deprecated types, `$type` aliases, binary
subtypes, and known nested interpretation schemes. It intentionally separates
storage-level BSON from shell constructors, Extended JSON representations,
driver wrapper classes, and query/operator-only aliases.

## Scope Notes

- "Storage-level BSON type" means an element type byte from the BSON
  specification, plus the payload shape associated with that type.
- BSON `Binary` (`binData`, type `5`) has its own subtype byte. This is the
  only top-level BSON type whose subtypes are formally part of the BSON value
  payload.
- Some BSON values have internal structure, such as ObjectId's 12 bytes,
  Timestamp's two 32-bit halves, regular expression options, and vector binary
  metadata. This document lists those structures separately so they are not
  mistaken for top-level types.
- Shell helpers such as `ObjectId()`, `ISODate()`, `NumberLong()`,
  `Decimal128()`, `Timestamp()`, `BinData()`, and `UUID()` are constructors or
  wrappers. They are not additional stored BSON types.
- Extended JSON tokens such as `$oid`, `$date`, `$numberLong`, `$binary`,
  `$regularExpression`, and `$numberDecimal` are JSON representations used to
  preserve BSON type information. They are not additional stored BSON types.
- BSON type code `0` is not a value type. In the BSON grammar, a null byte
  terminates a document's element list.

## Variety Status Legend

The "Variety" column summarizes current Variety support status from local code
and test evidence inspected on 2026-04-22.

| Status | Meaning |
| --- | --- |
| Tested | A test asserts Variety output for this entry. |
| Tested merged | A test exists, but Variety reports this under a broader or legacy label. |
| Partial | Some important cases in this row are tested; others are not. |
| Untested | Code may handle it, but no test-backed support claim is made here. |
| Unmapped | Variety does not currently assign this entry a distinct, intentional label; values may fall through to `BinData-undefined`, `Object`, or another generic result instead of being recognized as this type. |
| Out of scope | Not a storage type or not something Variety should directly classify. |

Primary local evidence: [V1] tests most BSON-wrapper recognition; [V2], [V3],
and [V4] cover common application values and arrays; [V5] defines the current
type mapping; [V6] tests every standard binary subtype, representative
reserved/user-defined-range cases, and vector dtype-specific labels; and [V7]
proves the Variety label for each deprecated top-level BSON type.
Current tests recognize BSON `Double` and `Int32` as Variety `Number` because
the current shell-backed retrieval path receives both as plain JavaScript
numbers before Variety inspects them. BSON JavaScript code and
JavaScript-with-scope report as Variety `Code`, BSON `Symbol` (type 14) reports
as Variety `String` in mongosh, standard binary subtypes report under their
`BinData-{subtype}` labels, user-defined binary subtypes `0x80` through `0xFF`
report as `BinData-user[0xNN]`, BSON-reserved binary subtypes `0x0A` through
`0x7F` report as `BinData-reserved`, and vector binary subtype `9` values
report under dtype-specific labels (`BinData-vector[FLOAT32]`,
`BinData-vector[INT8]`, `BinData-vector[PACKED_BIT]`), with unknown dtypes
reported as `BinData-vector[0xNN]` and malformed payloads as
`BinData-vector[malformed]`. Distinguishing `Double` from `Int32` would require
a different retrieval architecture, not just a new Variety label.

## Top-Level BSON Value Types

The following list is the complete storage-level element type inventory from
the BSON 1.1 grammar and MongoDB's BSON Types reference. The "query alias"
column is the string alias accepted by MongoDB `$type` where documented.

| Type code | BSON value type | Query alias | Status | Variety | Storage shape and notes | Sources |
| --- | --- | --- | --- | --- | --- | --- |
| `-1` | Min key | `minKey` | Current | Tested | Special value that compares lower than every other possible BSON element value. No payload beyond the element type and field name. | [S1], [S2] |
| `1` | Double | `double` | Current | Tested merged | 64-bit IEEE 754 binary floating point. Variety's current shell-backed integration path sees this as a plain JavaScript number, so Variety reports it under the merged label `Number`. | [S1], [S2] |
| `2` | String | `string` | Current | Tested | Length-prefixed UTF-8 string. MongoDB drivers generally convert language strings to UTF-8. | [S1], [S2] |
| `3` | Object / embedded document | `object` | Current | Tested | Embedded BSON document. A top-level MongoDB record is also a BSON document, but it is not preceded by an element type byte unless nested as a value. | [S1], [S2] |
| `4` | Array | `array` | Current | Tested | Encoded as a BSON document whose keys are sequential integer strings starting at `0`. | [S1], [S2] |
| `5` | Binary data | `binData` | Current | Tested merged | Length-prefixed byte array plus a binary subtype byte. Variety has no single `Binary data` label; every binary value is reported under a `BinData-{subtype}` label instead. Every standard binary subtype is test-backed, and the reserved/user-defined ranges now have representative test coverage with intentional range-wide mappings; see "BSON Binary Subtypes" for per-subtype details. | [S1], [S2], [V6] |
| `6` | Undefined | `undefined` | Deprecated | Tested | Historical undefined value with no payload. It remains a recognized BSON type and `$type` alias, but should not be used for new data. The BSON library deserializes stored type-6 values as JavaScript `undefined`; Variety reports these as `undefined`. Coverage is analyzer-level test evidence against the deserialized value. | [S1], [S2], [V7] |
| `7` | ObjectId | `objectId` | Current | Tested | 12-byte object identifier. See "Internal Structures and Interpretation Schemes". | [S1], [S2] |
| `8` | Boolean | `bool` | Current | Tested | One byte: `0` for false, `1` for true. | [S1], [S2] |
| `9` | Date / UTC datetime | `date` | Current | Tested | Signed 64-bit integer containing milliseconds since the Unix epoch. Before MongoDB 2.0, Date values were incorrectly interpreted as unsigned for some sort, range query, and index behavior. | [S1], [S2] |
| `10` | Null | `null` | Current | Tested | Null value with no payload. Distinct from a missing field and from deprecated Undefined. | [S1], [S2], [S4] |
| `11` | Regular expression | `regex` | Current | Tested | Two cstrings: pattern and options. See regex options below. | [S1], [S2] |
| `12` | DBPointer | `dbPointer` | Deprecated | Tested merged | Historical database pointer: namespace string plus a 12-byte ObjectId. Deprecated. Do not confuse this BSON type with the later DBRef convention, which is a normal document shape rather than a BSON type. The BSON library maps stored type-12 values to a DBRef object; Variety reports these as `DBRef`, the broader label shared with the DBRef convention. Coverage is analyzer-level test evidence against the deserialized value. | [S1], [S2], [V7] |
| `13` | JavaScript code | `javascript` | Current BSON type, operationally discouraged | Tested merged | JavaScript source code stored as a string. Variety reports this as `Code`, the same label used for JavaScript code with scope (type `15`). Server-side JavaScript functions are deprecated starting in MongoDB 8.0, but this BSON storage type remains in the BSON type inventory. | [S1], [S2], [S10], [V1] |
| `14` | Symbol | `symbol` | Deprecated | Tested merged | Historical symbol value stored as a string. Deprecated. Mongosh promotes stored type-14 values to plain JavaScript strings; Variety reports these as `String`, the broader label shared with BSON String (type 2). The analyzer also has a `BSONSymbol` path for BSONSymbol objects. | [S1], [S2], [V1], [V7] |
| `15` | JavaScript code with scope | `javascriptWithScope` | Deprecated | Tested merged | Code-with-scope value containing total length, JavaScript source string, and a scope document. Variety reports this as `Code`. `$where` no longer supports this type; its use with `$where` was deprecated since MongoDB 4.2.1. `mapReduce` function support was removed in MongoDB 4.4 after the same deprecation. | [S1], [S2], [S9], [S10], [V1], [V7] |
| `16` | 32-bit integer | `int` | Current | Tested merged | Signed 32-bit integer. Variety's current shell-backed integration path sees this as a plain JavaScript number, so Variety reports it under the merged label `Number`. | [S1], [S2] |
| `17` | Timestamp | `timestamp` | Current, mostly internal | Tested | 64-bit timestamp used internally by MongoDB replication and sharding. MongoDB compares the time portion before the increment portion. Use BSON Date for application timestamps in most cases. | [S1], [S2] |
| `18` | 64-bit integer | `long` | Current | Tested | Signed 64-bit integer. Variety reports this as `NumberLong`. | [S1], [S2] |
| `19` | Decimal128 | `decimal` | Current, introduced with MongoDB 3.4 | Tested | 128-bit IEEE 754-2008 decimal floating point. MongoDB documents 34 decimal digits of precision and an exponent range of `-6143` to `+6144`. Variety reports this as `Decimal128`. | [S1], [S2], [S8] |
| `127` | Max key | `maxKey` | Current | Tested | Special value that compares higher than every other possible BSON element value. No payload beyond the element type and field name. | [S1], [S2] |

## BSON Binary Subtypes

Binary subtype is a one-byte unsigned value inside a BSON `Binary` value. The
BSON specification defines subtype `0x80` through `0xFF` as user-defined. The
MongoDB manual currently summarizes this as custom data at `128`; the
specification is the broader authority for the whole user-defined range.

| Subtype | Name | Status | Variety | Meaning and caveats | Sources |
| --- | --- | --- | --- | --- | --- |
| `0` / `0x00` | Generic binary | Current | Tested | Default generic binary subtype for arbitrary bytes. Variety reports this as `BinData-generic`. | [S1], [S2], [V6] |
| `1` / `0x01` | Function | Current / historical | Tested | Function data. Rare in modern application schemas. Variety reports this as `BinData-function`. | [S1], [S2], [V6] |
| `2` / `0x02` | Binary (old) | Deprecated | Tested | Old binary format, deprecated in favor of subtype `0`. Its payload nests an additional `int32` length before the bytes. Variety reports this as `BinData-old`. | [S1], [S2], [V6] |
| `3` / `0x03` | UUID (old) | Deprecated | Tested | Legacy UUID storage. Deprecated in favor of subtype `4`. The bytes do not identify which legacy driver byte order was used. Variety maps subtype `3` to `BinData-UUID` together with subtype `4`; both are test-backed. See "Legacy UUID Interpretations". | [S1], [S2], [S7], [V6] |
| `4` / `0x04` | UUID | Current | Tested | Standard UUID binary subtype. Drivers use this for standardized UUID byte order. Variety reports this as `BinData-UUID`. | [S1], [S2], [S7], [V6] |
| `5` / `0x05` | MD5 | Current / historical | Tested | MD5 binary subtype. Mostly encountered in older schemas or protocol/tooling contexts. Variety reports this as `BinData-MD5`. | [S1], [S2], [V6] |
| `6` / `0x06` | Encrypted BSON value | Current | Tested | Encrypted BSON value, used by MongoDB encryption features. Variety reports this as `BinData-encrypted`. | [S1], [S2], [V6] |
| `7` / `0x07` | Compressed BSON column / compressed time series data | Current | Tested | BSON spec calls this "Compressed BSON column"; MongoDB docs describe it as compressed time series data and mark it new in MongoDB 5.2. The format uses delta, delta-of-delta, run-length encoding, and sparse-array missing-value encoding. Variety reports this as `BinData-compressed-column`. Coverage is analyzer-level because MongoDB validates compressed-column payloads. | [S1], [S2], [V6] |
| `8` / `0x08` | Sensitive | Current | Tested | Sensitive data such as a key or secret. MongoDB logs a placeholder rather than the literal binary value. Variety reports this as `BinData-sensitive`. | [S1], [S2], [V6] |
| `9` / `0x09` | Vector | Current | Tested | Dense numeric vector storage. The binary payload starts with a dtype byte and padding byte before the packed elements. Variety inspects the dtype byte and reports dtype-specific labels: `BinData-vector[FLOAT32]`, `BinData-vector[INT8]`, `BinData-vector[PACKED_BIT]`. Unknown dtypes produce `BinData-vector[0xNN]`; unreadable payloads produce `BinData-vector[malformed]`. See "Vector Subtype 9 Dtypes". | [S1], [S2], [S6], [V6] |
| `10` / `0x0A` through `127` / `0x7F` | Reserved | Reserved by BSON spec | Tested | Subtype range not assigned by the BSON specification. These subtypes cannot be inserted into MongoDB. Variety reports any value with a subtype in this range as `BinData-reserved`. Coverage is analyzer-level. | [S1], [V6] |
| `128` / `0x80` through `255` / `0xFF` | User-defined / custom | Current | Tested | User-defined binary subtype range. MongoDB's BSON Types page lists `128` as custom data; the BSON spec reserves the full `128` through `255` range for user-defined subtypes. Variety reports each subtype in this range as `BinData-user[0xNN]` where `NN` is the subtype byte in lowercase zero-padded hex (e.g. `BinData-user[0x80]`, `BinData-user[0x81]`). The former flat label `BinData-user` is retired. Integration coverage for `0x80` and `0x81`; analyzer-level coverage for `0xff`. | [S1], [S2], [V6] |

## Vector Subtype 9 Dtypes

Binary subtype `9` is itself a BSON `Binary` value. Its first payload byte is a
vector dtype, the second payload byte is padding metadata, and the remaining
bytes are the packed vector values. These dtype bytes are not BSON element type
codes and are not valid outside binary subtype `9`.

The vector subtype specification is accepted, says it is not tied to a minimum
MongoDB server version, and records acceptance on 2024-11-01 with later
validation updates through 2025-06-23.

| Dtype byte | Alias | Bits per vector element | Variety | Meaning | Sources |
| --- | --- | --- | --- | --- | --- |
| `0x03` | `INT8` | 8 | Tested | Signed 8-bit integer vector elements in the range `-128` through `127`. Variety reports this as `BinData-vector[INT8]`. | [S6], [V6] |
| `0x10` | `PACKED_BIT` | 1 | Tested | Binary quantized vector. Logical values are bits, packed into bytes. The padding byte says how many least-significant bits in the final byte should be ignored. Variety reports this as `BinData-vector[PACKED_BIT]`. | [S6], [V6] |
| `0x27` | `FLOAT32` | 32 | Tested | 32-bit floating point vector elements. Payload length after metadata must be a multiple of 4 bytes. Variety reports this as `BinData-vector[FLOAT32]`. | [S6], [V6] |
| any unrecognized byte | — | N/A | Tested | Dtype byte not defined in the current spec. Variety reports this as `BinData-vector[0xNN]` where `NN` is the dtype byte in lowercase zero-padded hex. Coverage is analyzer-level. | [V6] |
| (no payload) | — | N/A | Tested | Payload too short to contain a dtype byte. Variety reports this as `BinData-vector[malformed]`. Coverage is analyzer-level. | [V6] |

## Legacy UUID Interpretations

Legacy UUIDs are BSON `Binary` subtype `3`. The subtype does not encode which
legacy representation was used, so the following are driver interpretation
schemes, not additional stored subtypes. New data should use subtype `4`
standard UUIDs.

| Representation | Stored subtype | Variety | Byte order / behavior | Sources |
| --- | --- | --- | --- | --- |
| `STANDARD` | `4` | Tested | Standard UUID representation using BSON binary subtype `4`. Variety reports this as `BinData-UUID`. | [S7], [V6] |
| `PYTHON_LEGACY` | `3` | Tested | Legacy PyMongo representation. Uses the standard RFC 4122 byte order but stores it under old UUID subtype `3`. Variety maps any subtype `3` value to `BinData-UUID` without examining byte order. | [S7], [V6] |
| `JAVA_LEGACY` | `3` | Tested | Legacy Java driver byte order under old UUID subtype `3`. Variety maps any subtype `3` value to `BinData-UUID` without examining byte order. | [S7], [V6] |
| `CSHARP_LEGACY` | `3` | Tested | Legacy .NET/C# driver byte order under old UUID subtype `3`. Variety maps any subtype `3` value to `BinData-UUID` without examining byte order. | [S7], [V6] |
| `UNSPECIFIED` | Not a storage format | Out of scope | Driver configuration state: do not automatically encode native UUIDs, and decode UUID binary values as raw Binary objects unless a representation is supplied. | [S7] |

## Internal Structures and Interpretation Schemes

These structures are part of BSON value payloads or MongoDB interpretation
rules. They are useful when building type detection, display, migration, or
round-trip tests, but they are not extra top-level BSON types.

| BSON value | Variety | Internal structure | Sources |
| --- | --- | --- | --- |
| Array | Tested | Encoded as a BSON document whose field names are sequential integer strings beginning with `0`. | [S1] |
| Binary old, subtype `2` | Tested | The binary payload itself contains an `int32` length followed by bytes. This is in addition to the outer binary length field. Variety reports this as `BinData-old`. | [S1], [V6] |
| Boolean | Tested | Single byte: `0` means false and `1` means true. | [S1] |
| Code with scope, type `15` | Tested merged | Total byte length, JavaScript source string, and scope document mapping identifiers to values. Variety reports this as `Code`. | [S1], [V7] |
| DBPointer, type `12` | Tested merged | Namespace string and 12-byte ObjectId. The BSON library deserializes type-12 to a DBRef object; Variety reports `DBRef`. | [S1], [V7] |
| Date, type `9` | Tested | Signed 64-bit integer containing UTC milliseconds since the Unix epoch. MongoDB notes old pre-2.0 unsigned interpretation bugs for dates before 1970. | [S1], [S2] |
| Decimal128, type `19` | Tested | IEEE 754-2008 128-bit decimal floating point. MongoDB stores Decimal128 using binary integer decimal encoding and requires exact value preservation on round trip. | [S2], [S8] |
| ObjectId, type `7` | Tested | 12 bytes: 4-byte timestamp in seconds, 5-byte process-random value, and 3-byte counter. MongoDB notes ObjectIds are approximately ordered but not strictly monotonic. | [S2] |
| Regular expression, type `11` | Tested | Pattern cstring and options cstring. Options must be stored alphabetically. Supported option characters are `i`, `m`, `s`, `x`, and `u`. | [S1] |
| String, type `2` | Tested | `int32` byte length, UTF-8 bytes, and trailing null byte. | [S1], [S2] |
| Timestamp, type `17` | Tested | Serialized as a BSON `uint64`. BSON spec describes the first serialized 4 bytes as increment and the second as timestamp; MongoDB describes the logical value as high 32 bits `time_t` and low 32 bits ordinal, and compares time before ordinal. | [S1], [S2] |
| Vector binary, subtype `9` | Tested | First byte is dtype, second byte is padding, and the rest is packed vector data using little-endian format. Variety inspects the dtype byte and reports `BinData-vector[FLOAT32]`, `BinData-vector[INT8]`, or `BinData-vector[PACKED_BIT]` for recognized dtypes; `BinData-vector[0xNN]` for unknown dtypes; and `BinData-vector[malformed]` for payloads too short to contain a dtype byte. | [S6], [V6] |

## Query and Operator Aliases That Are Not Storage Types

| Alias or output | Where it appears | Variety | Meaning | Sources |
| --- | --- | --- | --- | --- |
| `$type: <number>` | Query predicate `$type` | Out of scope | Query `$type` accepts either the numeric BSON type code or string alias. | [S3] |
| `$type: "number"` | Query predicate `$type`; BSON Types reference | Out of scope | Convenience alias matching numeric BSON values: double, 32-bit integer, 64-bit integer, and Decimal128. It is not a stored BSON type. | [S2], [S3] |
| `$isNumber` | Aggregation expression | Out of scope | Returns true for BSON integer, decimal, double, or long values. It is a predicate/operator, not a stored type. | [S2], [S4] |
| `"missing"` | Aggregation expression `$type` output | Out of scope | Returned by aggregation `$type` when the referenced field is missing. It is not BSON Null, not deprecated Undefined, and not a stored BSON type. | [S4] |

## Common Non-Types To Keep Separate

| Looks like a type | Classification | Variety | Why it is not another storage type | Sources |
| --- | --- | --- | --- | --- |
| `ObjectId()`, `ISODate()`, `NumberInt()`, `NumberLong()`, `Decimal128()`, `Timestamp()`, `BinData()`, `UUID()` | Shell/helper constructors or wrappers | Out of scope | They create or display BSON values from the storage-level types above. The function names are not additional BSON element type codes. | [S2], [S10] |
| Extended JSON keys such as `$oid`, `$date`, `$binary`, `$numberLong`, `$numberDecimal`, `$regularExpression` | JSON interchange representations | Out of scope | JSON cannot directly represent every BSON type, so Extended JSON adds representations that preserve type information. These are serialized JSON forms, not extra BSON storage types. | [S5] |
| Canonical Extended JSON vs relaxed Extended JSON | Representation modes | Out of scope | Canonical mode emphasizes type preservation; relaxed mode emphasizes readability and can lose type information during conversion back to BSON. Neither mode changes the BSON type inventory. | [S5] |
| DBRef | Document convention / helper shape | Tested | DBRef is conventionally represented as an ordinary document. It is distinct from deprecated BSON DBPointer type `12`. Variety recognizes the driver `DBRef` wrapper and reports `DBRef`. | [S1], [S2], [S10] |
| GeoJSON, legacy coordinate pairs, dates encoded as strings, application enums | Application schema conventions | Out of scope | They are stored using ordinary BSON object, array, string, number, or other top-level BSON types. | [S1], [S2] |

## Historical and Version Notes

| Item | Variety | Version note | Sources |
| --- | --- | --- | --- |
| Deprecated top-level BSON types | Tested merged | Undefined (`6`), DBPointer (`12`), Symbol (`14`), and JavaScript code with scope (`15`) are still listed and recognized, but deprecated. All four now have test-backed Variety behavior: Undefined is labeled `undefined`, DBPointer is labeled `DBRef`, Symbol is labeled `String` in mongosh, and code with scope is labeled `Code`. DBPointer, Symbol, and code with scope are reported under broader or merged labels, making this grouping `Tested merged`. | [S1], [S2], [V1], [V7] |
| Date signedness | Tested | Before MongoDB 2.0, Date values were incorrectly interpreted as unsigned integers in some sort, range query, and index behavior. Variety has current Date tests, but no historical pre-2.0 behavioral test. | [S2] |
| Decimal128 | Tested | MongoDB 3.4 introduced BSON Decimal128, type code `19` / `0x13`. | [S8] |
| Binary subtype `7` | Tested | MongoDB's BSON Types page marks compressed time series data as new in MongoDB 5.2. BSON spec names the subtype "Compressed BSON column". Variety reports this as `BinData-compressed-column`. | [S1], [S2], [V6] |
| JavaScript code with scope in server-side JavaScript operations | Tested merged | Use of type `15` for `$where` and `mapReduce` functions was deprecated since MongoDB 4.2.1. MongoDB 4.4 removed `mapReduce` support for type `15`; current `$where` docs say `$where` no longer supports it. Variety reports code-with-scope values as `Code`. | [S9], [S10] |
| Server-side JavaScript functions | Out of scope | Starting in MongoDB 8.0, server-side JavaScript functions such as `$accumulator`, `$function`, and `$where` are deprecated. This is an operational JavaScript execution caveat, not the removal of BSON type `13` from the storage inventory. | [S10] |
| Vector binary subtype `9` | Tested | The vector subtype specification is accepted, has no minimum server version, and records acceptance on 2024-11-01. It has dtype validation updates through 2025-06-23. Variety inspects the dtype byte and reports dtype-specific labels: `BinData-vector[FLOAT32]`, `BinData-vector[INT8]`, `BinData-vector[PACKED_BIT]`. Unknown dtypes produce `BinData-vector[0xNN]`; malformed payloads produce `BinData-vector[malformed]`. | [S6], [V6] |

## Source Register

- [S1] BSON (Binary JSON), "Specification Version 1.1",
  <https://bsonspec.org/spec.html>. Retrieved 2026-04-21. Essential metadata:
  specification version 1.1.
- [S2] MongoDB Manual, "BSON Types", current Database Manual 8.2 page,
  <https://www.mongodb.com/docs/manual/reference/bson-types/>. Retrieved
  2026-04-21. Essential metadata: current docs page labels the Database Manual
  as 8.2 current.
- [S3] MongoDB Manual, "`$type` (query predicate operator)",
  <https://www.mongodb.com/docs/manual/reference/operator/query/type/>.
  Retrieved 2026-04-21. Essential metadata: current Database Manual 8.2 page.
- [S4] MongoDB Manual, "`$type` (expression operator)",
  <https://www.mongodb.com/docs/manual/reference/operator/aggregation/type/>.
  Retrieved 2026-04-21. Essential metadata: current Database Manual 8.2 page.
- [S5] MongoDB Manual, "MongoDB Extended JSON (v2)",
  <https://www.mongodb.com/docs/manual/reference/mongodb-extended-json/>.
  Retrieved 2026-04-21. Essential metadata: current Database Manual 8.2 page.
- [S6] MongoDB specifications repository, "BSON Binary Subtype 9 - Vector",
  <https://github.com/mongodb/specifications/blob/master/source/bson-binary-vector/bson-binary-vector.md>.
  Retrieved 2026-04-21. Essential metadata: status Accepted; minimum server
  version N/A; GitHub page showed 272 lines; changelog included acceptance on
  2024-11-01 and validation updates through 2025-06-23.
- [S7] MongoDB PyMongo Driver v4.7 documentation, "Universally Unique IDs
  (UUIDs)",
  <https://www.mongodb.com/docs/languages/python/pymongo-driver/v4.7/data-formats/uuid/>.
  Retrieved 2026-04-21. Essential metadata: documents subtype `3` historical
  UUID byte-order differences and subtype `4` standard UUID behavior.
- [S8] MongoDB Specifications, "BSON Decimal128",
  <https://specifications.readthedocs.io/en/latest/bson-decimal128/decimal128/>.
  Retrieved 2026-04-21. Essential metadata: status Accepted; minimum server
  version 3.4.
- [S9] MongoDB Manual v4.4, "Compatibility Changes in MongoDB 4.4",
  <https://www.mongodb.com/docs/v4.4/release-notes/4.4-compatibility/>.
  Retrieved 2026-04-21. Essential metadata: archived v4.4 documentation,
  explicitly marked no longer supported by MongoDB docs.
- [S10] MongoDB Manual, "`$where` (query predicate operator)",
  <https://www.mongodb.com/docs/manual/reference/operator/query/where/>.
  Retrieved 2026-04-21. Essential metadata: current Database Manual 8.2 page;
  documents server-side JavaScript deprecation starting MongoDB 8.0 and
  `$where` support for BSON String and JavaScript but not JavaScript with scope.
- [V1] Variety local test file,
  [test/cases/analysis/DatatypeRecognitionTest.js](../test/cases/analysis/DatatypeRecognitionTest.js).
  Inspected in the current working tree on 2026-04-22. Essential metadata:
  integration test for current BSON-wrapper recognition, including JavaScript
  code without scope (type `13`) and JavaScript code with scope (type `15`).
- [V2] Variety local test file,
  [test/cases/analysis/BasicAnalysisTest.js](../test/cases/analysis/BasicAnalysisTest.js).
  Inspected in the current working tree on 2026-04-22. Essential metadata:
  integration test for common seed-data type recognition and value examples.
- [V3] Variety local fixture file,
  [test/fixtures/seed-data.js](../test/fixtures/seed-data.js). Inspected in the
  current working tree on 2026-04-22. Essential metadata: seed data used by
  common analysis, formatter, persistence, and plugin tests.
- [V4] Variety local test file,
  [test/cases/analysis/ShowArrayElementsTest.js](../test/cases/analysis/ShowArrayElementsTest.js).
  Inspected in the current working tree on 2026-04-22. Essential metadata:
  array element and nested-array analysis tests.
- [V5] Variety local source file, [core/analyzer.js](../core/analyzer.js).
  Inspected in the current working tree on 2026-04-22. Essential metadata:
  current Variety type-detection and binary-subtype mapping implementation.
- [V6] Variety local test file,
  [test/cases/analysis/BinarySubtypeTest.js](../test/cases/analysis/BinarySubtypeTest.js).
  Added 2026-04-21; updated and inspected in the current working tree on
  2026-04-23. Essential metadata: integration and analyzer-level tests for
  every standard BSON binary subtype, user-defined subtypes `0x80` and `0x81`
  (integration) and `0xff` (analyzer-level), spec-reserved subtype `0x0a`
  (analyzer-level), and vector dtype-specific labels: generic, function, old,
  UUID-old, UUID, MD5, encrypted, compressed column, sensitive, and vector
  binary with dtype labels for INT8, PACKED_BIT, and FLOAT32, unknown dtype
  fallback, and malformed payload handling.
- [V7] Variety local test file,
  [test/cases/analysis/DeprecatedBsonTypesTest.js](../test/cases/analysis/DeprecatedBsonTypesTest.js).
  Added 2026-04-21 and inspected in the current working tree on 2026-04-22.
  Essential metadata: analyzer-level test proving the Variety label for each
  deprecated top-level BSON type: Undefined/type 6, DBPointer/type 12,
  Symbol/type 14, and JavaScript code with scope/type 15.
