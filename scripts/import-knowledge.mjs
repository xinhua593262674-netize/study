import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourceDir = process.env.ECONOMY_SOURCE_DIR;
if (!sourceDir) throw new Error("请设置 ECONOMY_SOURCE_DIR，指向经济科目原始资料目录");
const source = `${sourceDir}/知识体系.xlsx`;
const output = new URL("../data/economy-knowledge.json", import.meta.url);
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const allRows = [];

for (let start = 1; start <= 632; start += 40) {
  const end = Math.min(start + 39, 632);
  const left = JSON.parse((await workbook.inspect({
    kind: "table", range: `A${start}:J${end}`, include: "values", tableMaxRows: 40, tableMaxCols: 10,
  })).ndjson).values;
  const right = JSON.parse((await workbook.inspect({
    kind: "table", range: `K${start}:V${end}`, include: "values", tableMaxRows: 40, tableMaxCols: 12,
  })).ndjson).values;
  for (let index = 0; index < left.length; index += 1) allRows.push([...left[index], ...right[index]]);
}

const [headers, ...rows] = allRows;
const records = rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
await fs.writeFile(output, JSON.stringify(records, null, 2));
console.log(`已导入 ${records.length} 条知识考点`);
