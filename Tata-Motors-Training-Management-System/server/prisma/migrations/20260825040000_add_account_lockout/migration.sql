-- Adds brute-force protection fields to User: a running count of consecutive
-- failed login attempts, and a timestamp until which the account is locked
-- out after too many failures.
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" DATETIME;
