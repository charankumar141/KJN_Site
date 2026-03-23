-- CreateEnum
CREATE TYPE "CoinTransactionType" AS ENUM ('EARN', 'REDEEM', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CoinTransactionSource" AS ENUM ('NEW_USER', 'FESTIVAL', 'ADMIN_GRANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "CoinSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "newUserCoins" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinFestivalPromo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coinsAmount" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinFestivalPromo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCoinWallet" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "CoinTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CoinTransactionType" NOT NULL,
    "source" "CoinTransactionSource" NOT NULL,
    "reason" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoinFestivalPromo_isActive_startAt_endAt_idx" ON "CoinFestivalPromo"("isActive", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCoinWallet_userId_key" ON "UserCoinWallet"("userId");

-- CreateIndex
CREATE INDEX "CoinTransaction_userId_createdAt_idx" ON "CoinTransaction"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserCoinWallet" ADD CONSTRAINT "UserCoinWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
