ALTER TABLE "Invoice" ADD COLUMN "challengeOrderId" TEXT;

UPDATE "Invoice" i
SET "challengeOrderId" = co."id"
FROM "ChallengeOrder" co
WHERE co."userId" = i."userId"
  AND co."status" = 'PAID'
  AND i."status" = 'PAID'
  AND i."challengeOrderId" IS NULL;

UPDATE "Invoice" i
SET "challengeOrderId" = co."id"
FROM "ChallengeOrder" co
WHERE co."userId" = i."userId"
  AND co."status" = 'OPEN'
  AND i."status" = 'OPEN'
  AND i."challengeOrderId" IS NULL;

ALTER TABLE "Invoice" ALTER COLUMN "challengeOrderId" SET NOT NULL;

CREATE UNIQUE INDEX "Invoice_challengeOrderId_key" ON "Invoice"("challengeOrderId");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_challengeOrderId_fkey"
FOREIGN KEY ("challengeOrderId") REFERENCES "ChallengeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
