ALTER TABLE "User"
ADD COLUMN "passwordResetToken" TEXT,
ADD COLUMN "passwordResetSentAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");
