/**
 * CLI Excel import — same engine as the admin UI upload.
 * Usage: npm run import -- "/path/to/workbook.xlsx" [more files...]
 * Import the auction file before the schedule file so players resolve to teams.
 */
import { readFileSync } from "node:fs";
import { importWorkbook } from "../src/lib/excel-import";
import { prisma } from "../src/lib/prisma";

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: npm run import -- "/path/to/workbook.xlsx" [more files...]');
    process.exit(1);
  }

  for (const file of files) {
    console.log(`\n▶ Importing ${file}`);
    const result = await importWorkbook(readFileSync(file));
    console.log(`  Detected format: ${result.detected}`);
    console.log(`  Counts:`, result.counts);
    for (const w of result.warnings) console.warn(`  ⚠ ${w}`);
    for (const e of result.errors) console.error(`  ✖ ${e}`);
    if (!result.ok) process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());
