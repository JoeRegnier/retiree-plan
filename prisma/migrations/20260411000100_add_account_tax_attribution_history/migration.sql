CREATE TABLE "AccountTaxAttributionHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "effectiveYear" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'JOINT_UNSPECIFIED',
    "primaryMemberId" TEXT,
    "secondaryMemberId" TEXT,
    "primaryPercentage" REAL,
    "secondaryPercentage" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccountTaxAttributionHistory_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountTaxAttributionHistory_accountId_effectiveYear_key"
  ON "AccountTaxAttributionHistory"("accountId", "effectiveYear");
