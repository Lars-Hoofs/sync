-- CreateEnum
CREATE TYPE "public"."DataBronType" AS ENUM ('PDF', 'CSV', 'TXT', 'WEBSITE', 'BESTAND');

-- CreateEnum
CREATE TYPE "public"."CrawlStatus" AS ENUM ('IN_WACHT', 'BEZIG', 'KLAAR', 'MISLUKT');

-- CreateEnum
CREATE TYPE "public"."OrganisatieRol" AS ENUM ('EIGENAAR', 'BEHEERDER', 'MANAGER', 'LID');

-- CreateEnum
CREATE TYPE "public"."AbonnementStatus" AS ENUM ('PROEFPERIODE', 'ACTIEF', 'VERLOPEN', 'GEANNULEERD', 'ONBETAALD');

-- CreateEnum
CREATE TYPE "public"."UitnodigingStatus" AS ENUM ('IN_BEHANDELING', 'GEACCEPTEERD', 'VERLOPEN', 'INGETROKKEN');

-- CreateEnum
CREATE TYPE "public"."TweeFAType" AS ENUM ('TOTP', 'SMS', 'EMAIL', 'BACKUP_CODE');

-- CreateEnum
CREATE TYPE "public"."DataGevoeligheidsNiveau" AS ENUM ('OPENBAAR', 'INTERN', 'VERTROUWELIJK', 'STRIKT_VERTROUWELIJK');

-- CreateEnum
CREATE TYPE "public"."FactuurStatus" AS ENUM ('CONCEPT', 'VERZONDEN', 'BETAALD', 'ACHTERSTALLIG', 'GEANNULEERD');

-- CreateTable
CREATE TABLE "public"."gebruikers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "voornaam" TEXT NOT NULL,
    "tussenvoegsel" TEXT,
    "achternaam" TEXT NOT NULL,
    "wachtwoord" TEXT NOT NULL,
    "emailGeverifieerd" BOOLEAN NOT NULL DEFAULT false,
    "emailGeverifieerdOp" TIMESTAMP(3),
    "isActief" BOOLEAN NOT NULL DEFAULT true,
    "isGeblokkeerd" BOOLEAN NOT NULL DEFAULT false,
    "aantalMisluktLogins" INTEGER NOT NULL DEFAULT 0,
    "laatsteMisluktLoginOp" TIMESTAMP(3),
    "geblokkeerTot" TIMESTAMP(3),
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" TIMESTAMP(3) NOT NULL,
    "laatsteLogin" TIMESTAMP(3),
    "laatsteWachtwoordWijziging" TIMESTAMP(3),
    "tweeFAIngeschakeld" BOOLEAN NOT NULL DEFAULT false,
    "tweeFAGeheim" TEXT,
    "tweeFABackupCodes" TEXT[],
    "gdprToestemmingOp" TIMESTAMP(3),
    "gdprGegevensExportAangevraagd" BOOLEAN NOT NULL DEFAULT false,
    "gdprVerwijderAangevraagdOp" TIMESTAMP(3),

    CONSTRAINT "gebruikers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organisaties" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domein" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" TIMESTAMP(3) NOT NULL,
    "tweeFAVerplicht" BOOLEAN NOT NULL DEFAULT false,
    "ipWhitelist" TEXT[],
    "maxAantalLeden" INTEGER,
    "sessieTimeoutMinuten" INTEGER NOT NULL DEFAULT 480,
    "dataIsolatieId" TEXT NOT NULL,
    "maxOpslag" INTEGER,
    "maxApiCalls" INTEGER,
    "maxProjecten" INTEGER,
    "eigenaarId" TEXT NOT NULL,
    "stripeKlantId" TEXT,
    "stripeAbonnementId" TEXT,
    "abonnementStatus" "public"."AbonnementStatus" NOT NULL DEFAULT 'PROEFPERIODE',
    "abonnementPlan" TEXT,
    "abonnementEindigtOp" TIMESTAMP(3),
    "proefperiodeEindigtOp" TIMESTAMP(3),

    CONSTRAINT "organisaties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organisatie_lidmaatschappen" (
    "id" TEXT NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" TIMESTAMP(3) NOT NULL,
    "isActief" BOOLEAN NOT NULL DEFAULT true,
    "laatsteActiviteit" TIMESTAMP(3),
    "ipAdresLaatsteActiviteit" TEXT,
    "gebruikerId" TEXT NOT NULL,
    "organisatieId" TEXT NOT NULL,
    "rol" "public"."OrganisatieRol" NOT NULL DEFAULT 'LID',

    CONSTRAINT "organisatie_lidmaatschappen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gebruikers_groepen" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "beschrijving" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" TIMESTAMP(3) NOT NULL,
    "organisatieId" TEXT NOT NULL,

    CONSTRAINT "gebruikers_groepen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gebruikers_groep_lidmaatschappen" (
    "id" TEXT NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gebruikerId" TEXT NOT NULL,
    "groepId" TEXT NOT NULL,

    CONSTRAINT "gebruikers_groep_lidmaatschappen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gebruikers_groep_rechten" (
    "id" TEXT NOT NULL,
    "groepId" TEXT NOT NULL,
    "rechtId" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "toegekend" BOOLEAN NOT NULL DEFAULT true,
    "toegekendOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toegekendDoor" TEXT,

    CONSTRAINT "gebruikers_groep_rechten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organisatie_lid_rechten" (
    "id" TEXT NOT NULL,
    "lidmaatschapId" TEXT NOT NULL,
    "rechtId" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "toegekend" BOOLEAN NOT NULL DEFAULT true,
    "toegekendOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toegekendDoor" TEXT,

    CONSTRAINT "organisatie_lid_rechten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rechten" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "beschrijving" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "organisatieId" TEXT NOT NULL,

    CONSTRAINT "rechten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."data_classificaties" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "niveau" "public"."DataGevoeligheidsNiveau" NOT NULL,
    "beschrijving" TEXT NOT NULL,
    "kleurCode" TEXT,
    "organisatieId" TEXT NOT NULL,

    CONSTRAINT "data_classificaties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rate_limits" (
    "id" TEXT NOT NULL,
    "ipAdres" TEXT,
    "endpoint" TEXT NOT NULL,
    "aantalCalls" INTEGER NOT NULL DEFAULT 0,
    "resetTijd" TIMESTAMP(3) NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" TIMESTAMP(3) NOT NULL,
    "gebruikerId" TEXT,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."facturatie_geschiedenis" (
    "id" TEXT NOT NULL,
    "factuurNummer" TEXT NOT NULL,
    "bedrag" DECIMAL(10,2) NOT NULL,
    "valuta" TEXT NOT NULL DEFAULT 'EUR',
    "status" "public"."FactuurStatus" NOT NULL,
    "factuurDatum" TIMESTAMP(3) NOT NULL,
    "vervaldatum" TIMESTAMP(3) NOT NULL,
    "betaaldOp" TIMESTAMP(3),
    "stripeFactuurId" TEXT,
    "organisatieId" TEXT NOT NULL,

    CONSTRAINT "facturatie_geschiedenis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gebruiks_statistieken" (
    "id" TEXT NOT NULL,
    "datum" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricNaam" TEXT NOT NULL,
    "waarde" DECIMAL(15,2) NOT NULL,
    "eenheid" TEXT,
    "organisatieId" TEXT NOT NULL,

    CONSTRAINT "gebruiks_statistieken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."uitnodigingen" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "public"."OrganisatieRol" NOT NULL DEFAULT 'LID',
    "token" TEXT NOT NULL,
    "status" "public"."UitnodigingStatus" NOT NULL DEFAULT 'IN_BEHANDELING',
    "verlooptOp" TIMESTAMP(3) NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geaccepteerdOp" TIMESTAMP(3),
    "bericht" TEXT,
    "ipAdresUitnodiging" TEXT,
    "ipAdresAcceptatie" TEXT,
    "organisatieId" TEXT NOT NULL,
    "uitgenodidgDoorId" TEXT NOT NULL,
    "voorafGedefinieerdeRechten" JSONB,

    CONSTRAINT "uitnodigingen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_verificatie_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "verlooptOp" TIMESTAMP(3) NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gebruiktOp" TIMESTAMP(3),
    "ipAdresGebruikt" TEXT,
    "gebruikerId" TEXT NOT NULL,

    CONSTRAINT "email_verificatie_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wachtwoord_reset_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "verlooptOp" TIMESTAMP(3) NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gebruiktOp" TIMESTAMP(3),
    "ipAdresAanvraag" TEXT,
    "ipAdresGebruikt" TEXT,
    "gebruikerId" TEXT NOT NULL,

    CONSTRAINT "wachtwoord_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."twee_fa_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" "public"."TweeFAType" NOT NULL,
    "verlooptOp" TIMESTAMP(3) NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gebruiktOp" TIMESTAMP(3),
    "ipAdresGebruikt" TEXT,
    "gebruikerId" TEXT NOT NULL,

    CONSTRAINT "twee_fa_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessies" (
    "id" TEXT NOT NULL,
    "sessieId" TEXT NOT NULL,
    "verlooptOp" TIMESTAMP(3) NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAdres" TEXT,
    "gebruikersAgent" TEXT,
    "isActief" BOOLEAN NOT NULL DEFAULT true,
    "uitgelogdOp" TIMESTAMP(3),
    "laatsteActiviteit" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gebruikerId" TEXT NOT NULL,

    CONSTRAINT "sessies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."login_logs" (
    "id" TEXT NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSuccesvol" BOOLEAN NOT NULL,
    "ipAdres" TEXT NOT NULL,
    "gebruikersAgent" TEXT,
    "foutmelding" TEXT,
    "locatie" TEXT,
    "gebruikerId" TEXT NOT NULL,

    CONSTRAINT "login_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activiteits_logs" (
    "id" TEXT NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actie" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "ipAdres" TEXT,
    "gebruikersAgent" TEXT,
    "metadata" JSONB,
    "gebruikerId" TEXT,
    "organisatieId" TEXT NOT NULL,

    CONSTRAINT "activiteits_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatBot" (
    "id" TEXT NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" TIMESTAMP(3) NOT NULL,
    "organisatieId" TEXT NOT NULL,
    "botNaam" TEXT NOT NULL,
    "widgetNaam" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "klantenServiceEmail" TEXT,
    "basisPrompt" TEXT NOT NULL,
    "toon" TEXT NOT NULL,
    "startBericht" TEXT NOT NULL,
    "mainKleur" TEXT NOT NULL,
    "secundaireKleur" TEXT,
    "achtergrondKleur" TEXT,
    "tekstKleur" TEXT,
    "knopKleur" TEXT,
    "knopTekstKleur" TEXT,
    "knopHoverKleur" TEXT,
    "knopHoverTekstKleur" TEXT,
    "fontGrootte" INTEGER NOT NULL DEFAULT 16,
    "fontFamilie" TEXT NOT NULL DEFAULT 'Arial, sans-serif',

    CONSTRAINT "ChatBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatbotDatabron" (
    "id" TEXT NOT NULL,
    "type" "public"."DataBronType" NOT NULL,
    "bestandsUrl" TEXT,
    "websiteUrl" TEXT,
    "chatbotId" TEXT NOT NULL,

    CONSTRAINT "ChatbotDatabron_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."website_crawls" (
    "id" TEXT NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."CrawlStatus" NOT NULL DEFAULT 'IN_WACHT',
    "startUrl" TEXT NOT NULL,
    "siteMapUrl" TEXT,
    "diepte" INTEGER NOT NULL DEFAULT 3,
    "paginaAantal" INTEGER,
    "chatbotId" TEXT NOT NULL,

    CONSTRAINT "website_crawls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chatbot_teksten" (
    "id" TEXT NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" TIMESTAMP(3) NOT NULL,
    "onderwerp" TEXT NOT NULL,
    "inhoud" TEXT NOT NULL,
    "databronId" TEXT NOT NULL,

    CONSTRAINT "chatbot_teksten_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gebruikers_email_key" ON "public"."gebruikers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organisaties_slug_key" ON "public"."organisaties"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organisaties_domein_key" ON "public"."organisaties"("domein");

-- CreateIndex
CREATE UNIQUE INDEX "organisaties_dataIsolatieId_key" ON "public"."organisaties"("dataIsolatieId");

-- CreateIndex
CREATE UNIQUE INDEX "organisaties_stripeKlantId_key" ON "public"."organisaties"("stripeKlantId");

-- CreateIndex
CREATE UNIQUE INDEX "organisaties_stripeAbonnementId_key" ON "public"."organisaties"("stripeAbonnementId");

-- CreateIndex
CREATE UNIQUE INDEX "organisatie_lidmaatschappen_gebruikerId_organisatieId_key" ON "public"."organisatie_lidmaatschappen"("gebruikerId", "organisatieId");

-- CreateIndex
CREATE UNIQUE INDEX "gebruikers_groepen_organisatieId_naam_key" ON "public"."gebruikers_groepen"("organisatieId", "naam");

-- CreateIndex
CREATE UNIQUE INDEX "gebruikers_groep_lidmaatschappen_gebruikerId_groepId_key" ON "public"."gebruikers_groep_lidmaatschappen"("gebruikerId", "groepId");

-- CreateIndex
CREATE UNIQUE INDEX "gebruikers_groep_rechten_groepId_rechtId_resourceType_resou_key" ON "public"."gebruikers_groep_rechten"("groepId", "rechtId", "resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "organisatie_lid_rechten_lidmaatschapId_rechtId_resourceType_key" ON "public"."organisatie_lid_rechten"("lidmaatschapId", "rechtId", "resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "rechten_organisatieId_naam_key" ON "public"."rechten"("organisatieId", "naam");

-- CreateIndex
CREATE UNIQUE INDEX "data_classificaties_organisatieId_naam_key" ON "public"."data_classificaties"("organisatieId", "naam");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_ipAdres_gebruikerId_endpoint_key" ON "public"."rate_limits"("ipAdres", "gebruikerId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "facturatie_geschiedenis_factuurNummer_key" ON "public"."facturatie_geschiedenis"("factuurNummer");

-- CreateIndex
CREATE UNIQUE INDEX "facturatie_geschiedenis_stripeFactuurId_key" ON "public"."facturatie_geschiedenis"("stripeFactuurId");

-- CreateIndex
CREATE UNIQUE INDEX "gebruiks_statistieken_organisatieId_datum_metricNaam_key" ON "public"."gebruiks_statistieken"("organisatieId", "datum", "metricNaam");

-- CreateIndex
CREATE UNIQUE INDEX "uitnodigingen_token_key" ON "public"."uitnodigingen"("token");

-- CreateIndex
CREATE UNIQUE INDEX "uitnodigingen_organisatieId_email_key" ON "public"."uitnodigingen"("organisatieId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "email_verificatie_tokens_token_key" ON "public"."email_verificatie_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "wachtwoord_reset_tokens_token_key" ON "public"."wachtwoord_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "twee_fa_tokens_token_key" ON "public"."twee_fa_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "sessies_sessieId_key" ON "public"."sessies"("sessieId");

-- AddForeignKey
ALTER TABLE "public"."organisaties" ADD CONSTRAINT "organisaties_eigenaarId_fkey" FOREIGN KEY ("eigenaarId") REFERENCES "public"."gebruikers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."organisatie_lidmaatschappen" ADD CONSTRAINT "organisatie_lidmaatschappen_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "public"."gebruikers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."organisatie_lidmaatschappen" ADD CONSTRAINT "organisatie_lidmaatschappen_organisatieId_fkey" FOREIGN KEY ("organisatieId") REFERENCES "public"."organisaties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gebruikers_groepen" ADD CONSTRAINT "gebruikers_groepen_organisatieId_fkey" FOREIGN KEY ("organisatieId") REFERENCES "public"."organisaties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gebruikers_groep_lidmaatschappen" ADD CONSTRAINT "gebruikers_groep_lidmaatschappen_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "public"."gebruikers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gebruikers_groep_lidmaatschappen" ADD CONSTRAINT "gebruikers_groep_lidmaatschappen_groepId_fkey" FOREIGN KEY ("groepId") REFERENCES "public"."gebruikers_groepen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gebruikers_groep_rechten" ADD CONSTRAINT "gebruikers_groep_rechten_groepId_fkey" FOREIGN KEY ("groepId") REFERENCES "public"."gebruikers_groepen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gebruikers_groep_rechten" ADD CONSTRAINT "gebruikers_groep_rechten_rechtId_fkey" FOREIGN KEY ("rechtId") REFERENCES "public"."rechten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."organisatie_lid_rechten" ADD CONSTRAINT "organisatie_lid_rechten_lidmaatschapId_fkey" FOREIGN KEY ("lidmaatschapId") REFERENCES "public"."organisatie_lidmaatschappen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."organisatie_lid_rechten" ADD CONSTRAINT "organisatie_lid_rechten_rechtId_fkey" FOREIGN KEY ("rechtId") REFERENCES "public"."rechten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rechten" ADD CONSTRAINT "rechten_organisatieId_fkey" FOREIGN KEY ("organisatieId") REFERENCES "public"."organisaties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."data_classificaties" ADD CONSTRAINT "data_classificaties_organisatieId_fkey" FOREIGN KEY ("organisatieId") REFERENCES "public"."organisaties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rate_limits" ADD CONSTRAINT "rate_limits_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "public"."gebruikers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."facturatie_geschiedenis" ADD CONSTRAINT "facturatie_geschiedenis_organisatieId_fkey" FOREIGN KEY ("organisatieId") REFERENCES "public"."organisaties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gebruiks_statistieken" ADD CONSTRAINT "gebruiks_statistieken_organisatieId_fkey" FOREIGN KEY ("organisatieId") REFERENCES "public"."organisaties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."uitnodigingen" ADD CONSTRAINT "uitnodigingen_organisatieId_fkey" FOREIGN KEY ("organisatieId") REFERENCES "public"."organisaties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."uitnodigingen" ADD CONSTRAINT "uitnodigingen_uitgenodidgDoorId_fkey" FOREIGN KEY ("uitgenodidgDoorId") REFERENCES "public"."gebruikers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_verificatie_tokens" ADD CONSTRAINT "email_verificatie_tokens_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "public"."gebruikers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."wachtwoord_reset_tokens" ADD CONSTRAINT "wachtwoord_reset_tokens_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "public"."gebruikers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."twee_fa_tokens" ADD CONSTRAINT "twee_fa_tokens_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "public"."gebruikers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessies" ADD CONSTRAINT "sessies_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "public"."gebruikers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."login_logs" ADD CONSTRAINT "login_logs_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "public"."gebruikers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activiteits_logs" ADD CONSTRAINT "activiteits_logs_organisatieId_fkey" FOREIGN KEY ("organisatieId") REFERENCES "public"."organisaties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatBot" ADD CONSTRAINT "ChatBot_organisatieId_fkey" FOREIGN KEY ("organisatieId") REFERENCES "public"."organisaties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatbotDatabron" ADD CONSTRAINT "ChatbotDatabron_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."ChatBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."website_crawls" ADD CONSTRAINT "website_crawls_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."ChatBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chatbot_teksten" ADD CONSTRAINT "chatbot_teksten_databronId_fkey" FOREIGN KEY ("databronId") REFERENCES "public"."ChatbotDatabron"("id") ON DELETE CASCADE ON UPDATE CASCADE;
