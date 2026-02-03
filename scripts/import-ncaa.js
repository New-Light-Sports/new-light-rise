import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};

const inputPath = getArg("--input");
const outputPath = getArg("--output") || "./data/ncaa-data.json";

if (!inputPath) {
  console.error("Usage: node scripts/import-ncaa.js --input /path/to/file.csv --output ./data/ncaa-data.json");
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf-8");
const ext = path.extname(inputPath).toLowerCase();

let records;
if (ext === ".json") {
  records = JSON.parse(raw);
} else {
  records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
  });
}

const normalized = records
  .map((row) => {
    const school = row.school || row.School || row.institution || row.name;
    const division = row.division || row.Division || row.level;
    if (!school || !division) return null;
    return {
      school: String(school).trim(),
      division: String(division).trim(),
    };
  })
  .filter(Boolean);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2));

console.log(`Wrote ${normalized.length} NCAA records to ${outputPath}`);
