-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RealEstate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "currentValue" REAL NOT NULL,
    "purchasePrice" REAL NOT NULL DEFAULT 0,
    "annualAppreciation" REAL NOT NULL DEFAULT 0.03,
    "grossRentalIncome" REAL,
    "rentalExpenses" REAL,
    "sellAtAge" INTEGER,
    "netProceedsPercent" REAL NOT NULL DEFAULT 0.95,
    "householdId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RealEstate_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RealEstate" ("annualAppreciation", "createdAt", "currentValue", "grossRentalIncome", "householdId", "id", "name", "netProceedsPercent", "propertyType", "purchasePrice", "rentalExpenses", "sellAtAge", "updatedAt") SELECT "annualAppreciation", "createdAt", "currentValue", "grossRentalIncome", "householdId", "id", "name", "netProceedsPercent", "propertyType", "purchasePrice", "rentalExpenses", "sellAtAge", "updatedAt" FROM "RealEstate";
DROP TABLE "RealEstate";
ALTER TABLE "new_RealEstate" RENAME TO "RealEstate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
