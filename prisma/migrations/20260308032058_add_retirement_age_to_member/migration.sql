-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HouseholdMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "dateOfBirth" DATETIME NOT NULL,
    "province" TEXT NOT NULL,
    "retirementAge" INTEGER NOT NULL DEFAULT 65,
    "rrspContributionRoom" REAL,
    "tfsaContributionRoom" REAL,
    "priorYearIncome" REAL,
    "cppExpectedBenefit" REAL,
    "householdId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_HouseholdMember" ("cppExpectedBenefit", "createdAt", "dateOfBirth", "householdId", "id", "name", "priorYearIncome", "province", "rrspContributionRoom", "tfsaContributionRoom", "updatedAt") SELECT "cppExpectedBenefit", "createdAt", "dateOfBirth", "householdId", "id", "name", "priorYearIncome", "province", "rrspContributionRoom", "tfsaContributionRoom", "updatedAt" FROM "HouseholdMember";
DROP TABLE "HouseholdMember";
ALTER TABLE "new_HouseholdMember" RENAME TO "HouseholdMember";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
