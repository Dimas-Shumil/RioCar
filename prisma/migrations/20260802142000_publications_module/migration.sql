-- Add publication display settings and cover accessibility fields.
ALTER TABLE "Publication" ADD COLUMN "coverAlt" TEXT;
ALTER TABLE "Publication" ADD COLUMN "showOnHome" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Publication" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Publication" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Publication_showOnHome_isActive_sortOrder_idx"
ON "Publication"("showOnHome", "isActive", "sortOrder");
