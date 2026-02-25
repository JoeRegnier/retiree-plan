-- AlterTable: add source, ticker, fetchedAt columns to HistoricalReturn
ALTER TABLE "HistoricalReturn" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'SEED';
ALTER TABLE "HistoricalReturn" ADD COLUMN "ticker" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HistoricalReturn" ADD COLUMN "fetchedAt" DATETIME;

-- CreateIndex: unique constraint on (year, asset)
CREATE UNIQUE INDEX "HistoricalReturn_year_asset_key" ON "HistoricalReturn"("year", "asset");
