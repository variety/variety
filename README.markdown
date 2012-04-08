# MongoDB Schema Analyzer #
It helps you get a sense of your application's schema, as well as any outliers to that schema. Particularly useful when you inherit a codebase with poor test coverage, or poor

	db.users.insert({name: "Tom", bio: "A nice guy.", pets: ["monkey", "fish"], someLegacyField: "I like Ike!"});
	db.users.insert({name: "Dick", bio: "I swordfight."});
	db.users.insert({name: "Harry", pets: ["egret"]});
	db.users.insert({name: "Geneviève", bio: "Ça va?");
