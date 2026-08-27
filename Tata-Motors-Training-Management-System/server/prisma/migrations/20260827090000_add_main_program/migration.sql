-- Manually-added main programs for the Scheduling calendar "Create Program"
-- flow, on top of the four built-in ones (SHE / Induction / F&T / C&B).
-- Lets a user record a brand-new main program directly from Scheduling and
-- have it persist and appear in the Main Program selector immediately and
-- on future visits, mirroring the existing Training table added in the
-- previous migration.
CREATE TABLE "MainProgram" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "MainProgram_value_key" ON "MainProgram"("value");
