-- 1) New Training table: lets a user record a training that isn't yet in
--    the built-in calendar catalog, scoped per main program (SHE /
--    Induction / F&T / C&B), from the Scheduling screen.
CREATE TABLE "Training" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mainProgram" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Training_mainProgram_name_key" ON "Training"("mainProgram", "name");

-- 2) Link Employee -> Upload so an employee record knows which Excel
--    import (Upload row) most recently created/updated it. Deleting that
--    Upload record (category "employee") cascades and removes the
--    employees that came from it, keeping the Employee tab in sync with
--    the uploaded Excel data instead of leaving stale rows behind.
--    SQLite requires a full table rebuild to add a column with a foreign
--    key constraint, matching what `prisma migrate dev` generates.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "category" TEXT,
    "grade" TEXT,
    "rawData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadId" INTEGER,
    CONSTRAINT "Employee_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Employee" ("id", "employeeId", "name", "department", "category", "grade", "rawData", "createdAt")
SELECT "id", "employeeId", "name", "department", "category", "grade", "rawData", "createdAt" FROM "Employee";

DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";

CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

PRAGMA foreign_keys=ON;
