DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationKind') THEN
    CREATE TYPE "NotificationKind" AS ENUM ('TRANSACTIONAL', 'MARKETING');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailOutboxStatus') THEN
    CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationVertical') THEN
    CREATE TYPE "NotificationVertical" AS ENUM ('GENERIC', 'SHOP', 'PRESTA', 'GP', 'TIAK', 'IMMO', 'CARS');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "transactionalEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "marketingEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "priceDropEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "dealsEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "messageAutoEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'NotificationPreference_userId_fkey'
  ) THEN
    ALTER TABLE "NotificationPreference"
      ADD CONSTRAINT "NotificationPreference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "EmailOutbox" (
  "id" TEXT NOT NULL,
  "toEmail" TEXT NOT NULL,
  "userId" TEXT,
  "kind" "NotificationKind" NOT NULL,
  "templateKey" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lockedAt" TIMESTAMP(3),
  "lockId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");
CREATE INDEX IF NOT EXISTS "EmailOutbox_status_scheduledAt_idx" ON "EmailOutbox"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "EmailOutbox_userId_status_createdAt_idx" ON "EmailOutbox"("userId", "status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'EmailOutbox_userId_fkey'
  ) THEN
    ALTER TABLE "EmailOutbox"
      ADD CONSTRAINT "EmailOutbox_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MessageTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "vertical" "NotificationVertical" NOT NULL DEFAULT 'GENERIC',
  "subjectDefault" TEXT NOT NULL,
  "bodyDefault" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageTemplate_key_key" ON "MessageTemplate"("key");

CREATE TABLE IF NOT EXISTS "MessageAutoRule" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "vertical" "NotificationVertical" NOT NULL DEFAULT 'GENERIC',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "templateKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageAutoRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageAutoRule_eventKey_key" ON "MessageAutoRule"("eventKey");
CREATE INDEX IF NOT EXISTS "MessageAutoRule_vertical_enabled_createdAt_idx" ON "MessageAutoRule"("vertical", "enabled", "createdAt");

INSERT INTO "MessageTemplate" ("id", "key", "vertical", "subjectDefault", "bodyDefault", "createdAt", "updatedAt")
VALUES
  ('ntpl_shop_contact_seller', 'SHOP_CONTACT_SELLER', 'SHOP', 'Question sur {{productTitle}}', 'Bonjour, je vous contacte au sujet de {{productTitle}}.\nRef: {{orderRef}}\nMerci.', NOW(), NOW()),
  ('ntpl_presta_contact_provider', 'PRESTA_CONTACT_PROVIDER', 'PRESTA', 'Demande de service: {{serviceTitle}}', 'Bonjour, je souhaite discuter de {{serviceTitle}}.\nDate proposee: {{proposedDates}}', NOW(), NOW()),
  ('ntpl_gp_contact_transporter', 'GP_CONTACT_TRANSPORTER', 'GP', 'Question transport {{orderRef}}', 'Bonjour, je vous contacte pour le transport {{orderRef}}.', NOW(), NOW()),
  ('ntpl_tiak_contact_courier', 'TIAK_CONTACT_COURIER', 'TIAK', 'Course {{orderRef}}', 'Bonjour, je vous contacte au sujet de la course {{orderRef}}.', NOW(), NOW()),
  ('ntpl_immo_contact_agency', 'IMMO_CONTACT_AGENCY', 'IMMO', 'Interet pour {{listingTitle}}', 'Bonjour, je suis interesse par {{listingTitle}}.', NOW(), NOW()),
  ('ntpl_cars_contact_dealer', 'CARS_CONTACT_DEALER', 'CARS', 'Question sur {{listingTitle}}', 'Bonjour, je souhaite plus d''infos sur {{listingTitle}}.', NOW(), NOW()),
  ('ntpl_generic_contact', 'GENERIC_CONTACT', 'GENERIC', 'Nouveau contact JONTAADO', 'Bonjour, je vous contacte via JONTAADO.', NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "MessageAutoRule" ("id", "eventKey", "vertical", "enabled", "templateKey", "createdAt", "updatedAt")
VALUES
  ('nrule_order_created', 'ORDER_CREATED', 'SHOP', true, 'GENERIC_CONTACT', NOW(), NOW()),
  ('nrule_delivery_status_changed', 'DELIVERY_STATUS_CHANGED', 'TIAK', true, 'GENERIC_CONTACT', NOW(), NOW())
ON CONFLICT ("eventKey") DO NOTHING;
