-- Extend Car with fields required by the public car page.
ALTER TABLE "Car" ADD COLUMN "fuel" TEXT;
ALTER TABLE "Car" ADD COLUMN "bodyType" TEXT;
ALTER TABLE "Car" ADD COLUMN "seats" INTEGER;
ALTER TABLE "Car" ADD COLUMN "features" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Car" ADD COLUMN "minRentalDays" INTEGER NOT NULL DEFAULT 1;
