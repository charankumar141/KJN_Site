-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "checkoutSnapshot" JSONB;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "advanceAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cessAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "advanceAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cessPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "allowedPaymentMethods" TEXT[] DEFAULT ARRAY['COD', 'ONLINE']::TEXT[],
ADD COLUMN     "cessPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "codAdvancePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "googleMerchantCentre" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PincodeDelivery" (
    "id" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "estimatedDays" INTEGER NOT NULL,
    "estimatedDaysMax" INTEGER,
    "isServiceable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PincodeDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkuSequence" (
    "id" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkuSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PincodeDelivery_pincode_key" ON "PincodeDelivery"("pincode");
