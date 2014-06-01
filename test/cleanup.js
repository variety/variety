// clean all resources created in init.js and during Variety execution and tests.
use test;
db.users.drop();

use varietyResults;
db.usersKeys.drop();