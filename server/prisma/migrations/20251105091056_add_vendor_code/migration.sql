-- Ensure sequence exists for vendor codes
CREATE SEQUENCE IF NOT EXISTS vendor_code_seq START 1 INCREMENT 1;

-- Add vendorCode column with default from the sequence
ALTER TABLE "Vendor" ADD COLUMN "vendorCode" VARCHAR(10) NOT NULL DEFAULT (concat('VEN', lpad(nextval('vendor_code_seq')::text, 5, '0')));

-- Unique constraint on vendorCode
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");
