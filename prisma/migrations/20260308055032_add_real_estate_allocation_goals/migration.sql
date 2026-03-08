-- AlterTable
ALTER TABLE "Account" ADD COLUMN "alternativesPercent" REAL;
ALTER TABLE "Account" ADD COLUMN "cashPercent" REAL;
ALTER TABLE "Account" ADD COLUMN "equityPercent" REAL;
ALTER TABLE "Account" ADD COLUMN "fixedIncomePercent" REAL;

-- CreateTable
CREATE TABLE "RealEstate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "currentValue" REAL NOT NULL,
    "purchasePrice" REAL NOT NULL DEFAULT 0,
    "annualAppreciation" REAL NOT NULL DEFAULT 0.03,
    "grossRentalIncome" REAL,
    "rentalExpenses" REAL,
    "sellAtAge" INTEGER,
    "netProceedsPercent" REAL NOT NULL DEFAULT 1.0,
    "householdId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RealEstate_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetAmount" REAL NOT NULL,
    "targetAge" INTEGER,
    "priority" TEXT NOT NULL DEFAULT 'essential',
    "category" TEXT NOT NULL DEFAULT 'retirement',
    "householdId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Goal_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
