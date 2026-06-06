const { openDatabase, synchronizeAssociations } = require("../server/database");

const db = openDatabase();
synchronizeAssociations(db);
const associations = db.prepare("SELECT COUNT(*) AS count FROM associations").get().count;
const coveredQuestions = db.prepare("SELECT COUNT(DISTINCT question_id) AS count FROM associations").get().count;
db.close();
console.log(`已生成 ${associations} 条知识关联，覆盖 ${coveredQuestions} 道真题`);
