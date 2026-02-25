-- AlterTable
ALTER TABLE "Account" ADD COLUMN "ynabAccountId" TEXT;
ALTER TABLE "Account" ADD COLUMN "ynabAccountName" TEXT;

-- CreateTable
CREATE TABLE "YnabConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "budgetId" TEXT,
    "budgetName" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "YnabConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "YnabCategoryMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ynabCategoryId" TEXT NOT NULL,
    "ynabCategoryName" TEXT NOT NULL,
    "localCategory" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "YnabCategoryMapping_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "YnabConnection_userId_key" ON "YnabConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "YnabCategoryMapping_householdId_ynabCategoryId_key" ON "YnabCategoryMapping"("householdId", "ynabCategoryId");
