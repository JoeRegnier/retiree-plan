-- AddUniqueConstraint: Expense(householdId, name)
-- Prevents duplicate expense category rows per household, enabling safe upsert
-- on Monarch Money CSV re-imports.
CREATE UNIQUE INDEX "Expense_householdId_name_key" ON "Expense"("householdId", "name");
