-- CreateTable
CREATE TABLE "DecisionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "context" TEXT NOT NULL,
    "decision" TEXT,
    "rationale" TEXT,
    "alternatives" TEXT,
    "consequences" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "tags" TEXT,
    "decisionDate" DATETIME,
    "reviewDate" DATETIME,
    "supersededById" TEXT,
    "linkedScenarioIds" TEXT,
    "linkedGoalIds" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DecisionRecord_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DecisionRecord_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "DecisionRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_DecisionRelations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DecisionRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "DecisionRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DecisionRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "DecisionRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_DecisionRelations_AB_unique" ON "_DecisionRelations"("A", "B");

-- CreateIndex
CREATE INDEX "_DecisionRelations_B_index" ON "_DecisionRelations"("B");
