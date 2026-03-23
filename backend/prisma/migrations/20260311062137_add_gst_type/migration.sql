-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "gstType" TEXT NOT NULL DEFAULT 'IGST';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "gstType" TEXT NOT NULL DEFAULT 'IGST';
