DO $$ BEGIN
  ALTER TYPE "marketplace"."KycRole" ADD VALUE IF NOT EXISTS 'GP_CARRIER';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "marketplace"."KycRole" ADD VALUE IF NOT EXISTS 'TIAK_COURIER';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "marketplace"."KycRole" ADD VALUE IF NOT EXISTS 'IMMO_AGENCY';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "marketplace"."KycRole" ADD VALUE IF NOT EXISTS 'CAR_DEALER';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."KycType" AS ENUM ('INDIVIDUAL', 'BUSINESS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace"."KycLevel" AS ENUM ('BASIC', 'ENHANCED', 'PROFESSIONAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "marketplace"."KycSubmission"
  ADD COLUMN IF NOT EXISTS "kycType" "marketplace"."KycType" NOT NULL DEFAULT 'INDIVIDUAL',
  ADD COLUMN IF NOT EXISTS "kycLevel" "marketplace"."KycLevel" NOT NULL DEFAULT 'BASIC',
  ADD COLUMN IF NOT EXISTS "passportUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "proofTravelUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "businessRegistrationUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "companyName" TEXT,
  ADD COLUMN IF NOT EXISTS "companyAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "companyRibUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "legalRepIdUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "legalRepSelfieUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "professionalLicenseUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "addressCity" TEXT,
  ADD COLUMN IF NOT EXISTS "addressCountry" TEXT;
