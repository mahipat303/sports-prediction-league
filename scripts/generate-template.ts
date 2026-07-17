/**
 * Generates sample Excel templates matching the office's real file formats:
 *   excel-template/auction-template.xlsx   (players + team purchases)
 *   excel-template/schedule-template.xlsx  (games schedule)
 * Run with: npm run template
 */
import * as XLSX from "xlsx";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = join(__dirname, "..", "excel-template");
mkdirSync(outDir, { recursive: true });

// ---------- Auction template ----------
const auction = XLSX.utils.book_new();

const playersRows = [
  ["Slide No", "Name", "Gender", "Player Category", "Available to participate", "Table Tennis", "Badminton", "Chess", "Carrom", "Volleyball", "Box-Cricket", "Pickleball"],
  [1, "Parth Shah", "Male", "Platinum", "Yes", 8, 5, 5, 6, 6, 5, 6],
  [2, "Dev Dave", "Male", "Gold", "Yes", 7, 6, 9, 5, 5, 9, 10],
  [3, "Aniket Suthar", "Male", "Gold (Captain)", "Yes", 1, 7, 0, 10, 2, 8, 4],
  [4, "Meet Jain", "Male", "Silver", "Yes", 7, 6, 5, 7, 6, 7, 0],
  [5, "Dhruvi Shah", "Female", "Gold", "Yes", 7, 4, 8, 6, 3, 5, 6],
  [6, "Rinkal Mehta", "Female", "Silver", "Yes", 4, 5, 6, 7, 4, 3, 5],
];
XLSX.utils.book_append_sheet(
  auction,
  XLSX.utils.aoa_to_sheet(playersRows),
  "Players"
);

// Four team blocks side by side: Player Purchased | Price | Purse Left | Sports Covered
const gap = [null];
const purchaseRows: (string | number | null)[][] = [
  ["Aakash & Bhoomi", null, null, null, ...gap, "Abhi & Jayswee", null, null, null, ...gap, "Aniket & Jahnavi", null, null, null, ...gap, "Kabir & Rushina", null, null, null],
  ["Player Purchased", "Price", "Purse Left", "Sports Covered", ...gap, "Player Purchased", "Price", "Purse Left", "Sports Covered", ...gap, "Player Purchased", "Price", "Purse Left", "Sports Covered", ...gap, "Player Purchased", "Price", "Purse Left", "Sports Covered"],
  ["Platinum", null, null, null, ...gap, "Platinum", null, null, null, ...gap, "Platinum", null, null, null, ...gap, "Platinum", null, null, null],
  ["Parth Shah", 20000000, 330000000, null, ...gap, null, null, null, null, ...gap, null, null, null, null, ...gap, null, null, null, null],
  ["Gold", null, null, null, ...gap, "Gold", null, null, null, ...gap, "Gold", null, null, null, ...gap, "Gold", null, null, null],
  ["Dev Dave", 31000000, 299000000, null, ...gap, "Aniket Suthar", 45000000, 305000000, null, ...gap, "Dhruvi Shah", 30000000, 320000000, null, ...gap, null, null, null, null],
  ["Silver", null, null, null, ...gap, "Silver", null, null, null, ...gap, "Silver", null, null, null, ...gap, "Silver", null, null, null],
  ["Meet Jain", 12500000, 286500000, null, ...gap, "Rinkal Mehta", 9000000, 296000000, null, ...gap, null, null, null, null, ...gap, null, null, null, null],
];
XLSX.utils.book_append_sheet(
  auction,
  XLSX.utils.aoa_to_sheet(purchaseRows),
  "Purchases"
);
XLSX.writeFile(auction, join(outDir, "auction-template.xlsx"));

// ---------- Schedule template ----------
const schedule = XLSX.utils.book_new();
const scheduleRows = [
  ["Sport", "Category", "Stage", "Player/Team 1", "Player/Team 2", "Scheduled Date", "Time", "Winner", "Runner-up", "Winner Points", "Runner-up Points"],
  ["Chess", "Male Singles", "Group A Initial", "Dev", "Parth", "Mon, Jul 20, 2026", "14:00", null, null, 0, 0],
  ["Chess", "Male Singles", "Group B Initial", "Aniket", "Meet", "Mon, Jul 20, 2026", "15:00", null, null, 0, 0],
  ["Chess", "Male Singles", "Grand Final", "Winner Group A", "Winner Group B", "Wed, Jul 22, 2026", "17:00", null, null, 20, 5],
  ["Carrom", "Female Singles", "Group A Initial", "Dhruvi", "Rinkal", "Tue, Jul 21, 2026", "11:00", null, null, 0, 0],
  ["Carrom", "Mix Double", "Initial Match 1", "Dev/Dhruvi", "Meet/Rinkal", "Tue, Jul 21, 2026", "16:00", null, null, 0, 0],
];
XLSX.utils.book_append_sheet(
  schedule,
  XLSX.utils.aoa_to_sheet(scheduleRows),
  "All"
);
XLSX.writeFile(schedule, join(outDir, "schedule-template.xlsx"));

console.log(`Templates written to ${outDir}`);
