-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "companyId" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT,
    "shortName" TEXT,
    "serviceProfile" TEXT,
    "companyType" TEXT,
    "workSchedule" TEXT,
    "workStart" TEXT,
    "workEnd" TEXT,
    "lunchEnabled" BOOLEAN DEFAULT false,
    "lunchStart" TEXT,
    "lunchEnd" TEXT,
    "slotDuration" INTEGER,
    "urgentOrdersEnabled" BOOLEAN DEFAULT false,
    "publicDescription" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "additionalPhone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "mapsLink" TEXT,
    "contactPerson" TEXT,
    "clientNote" TEXT,
    "edrpou" TEXT,
    "ipn" TEXT,
    "iban" TEXT,
    "bankName" TEXT,
    "recipientName" TEXT,
    "legalAddress" TEXT,
    "vatPayer" BOOLEAN DEFAULT false,
    "invoiceNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");
