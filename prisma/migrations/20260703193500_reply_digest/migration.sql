-- CreateTable
CREATE TABLE "ReplyDigest" (
    "id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplyDigest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReplyDigest_tier_generatedAt_idx" ON "ReplyDigest"("tier", "generatedAt");
