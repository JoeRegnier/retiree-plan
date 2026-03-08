-- AlterTable
ALTER TABLE "Account" ADD COLUMN "brokerageAccountId" TEXT;
ALTER TABLE "Account" ADD COLUMN "brokerageAccountName" TEXT;
ALTER TABLE "Account" ADD COLUMN "brokerageProvider" TEXT;

-- CreateTable
CREATE TABLE "BrokerageConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "apiServer" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BrokerageConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerageConnection_userId_provider_key" ON "BrokerageConnection"("userId", "provider");
