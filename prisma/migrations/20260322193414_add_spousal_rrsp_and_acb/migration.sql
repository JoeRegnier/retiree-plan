-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "annualContribution" REAL NOT NULL DEFAULT 0,
    "estimatedReturnRate" REAL,
    "householdId" TEXT NOT NULL,
    "ynabAccountId" TEXT,
    "ynabAccountName" TEXT,
    "brokerageAccountId" TEXT,
    "brokerageProvider" TEXT,
    "brokerageAccountName" TEXT,
    "equityPercent" REAL,
    "fixedIncomePercent" REAL,
    "alternativesPercent" REAL,
    "cashPercent" REAL,
    "costBasis" REAL,
    "isSpousalRrsp" BOOLEAN NOT NULL DEFAULT false,
    "contributorMemberId" TEXT,
    "annuitantMemberId" TEXT,
    "lastContributionYear" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("alternativesPercent", "annualContribution", "balance", "brokerageAccountId", "brokerageAccountName", "brokerageProvider", "cashPercent", "createdAt", "currency", "equityPercent", "estimatedReturnRate", "fixedIncomePercent", "householdId", "id", "name", "type", "updatedAt", "ynabAccountId", "ynabAccountName") SELECT "alternativesPercent", "annualContribution", "balance", "brokerageAccountId", "brokerageAccountName", "brokerageProvider", "cashPercent", "createdAt", "currency", "equityPercent", "estimatedReturnRate", "fixedIncomePercent", "householdId", "id", "name", "type", "updatedAt", "ynabAccountId", "ynabAccountName" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
