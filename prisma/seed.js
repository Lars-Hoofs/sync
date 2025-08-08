import { PrismaClient } from '../generated/prisma/index.js';
import { hashPassword } from '../src/shared/utils/crypto.js';
import { logger } from '../src/shared/utils/logger.js';
const prisma = new PrismaClient();
async function main() {
    logger.info('🌱 Starting database seed...');
    // Maak een test gebruiker aan
    const hashedPassword = await hashPassword('TestWachtwoord123!');
    const testUser = await prisma.gebruiker.upsert({
        where: { email: 'test@example.com' },
        update: {},
        create: {
            email: 'test@example.com',
            voornaam: 'Test',
            achternaam: 'Gebruiker',
            wachtwoord: hashedPassword,
            emailGeverifieerd: true,
            isActief: true,
        },
    });
    logger.info(`✅ Test gebruiker aangemaakt: ${testUser.email}`);
    // Maak een test organisatie aan
    const testOrganisatie = await prisma.organisatie.upsert({
        where: { slug: 'test-organisatie' },
        update: {},
        create: {
            naam: 'Test Organisatie',
            slug: 'test-organisatie',
            eigenaarId: testUser.id,
            dataIsolatieId: 'test-org-isolation',
        },
    });
    logger.info(`✅ Test organisatie aangemaakt: ${testOrganisatie.naam}`);
    // Maak organisatie lidmaatschap aan voor eigenaar
    await prisma.organisatieLidmaatschap.upsert({
        where: {
            gebruikerId_organisatieId: {
                gebruikerId: testUser.id,
                organisatieId: testOrganisatie.id,
            },
        },
        update: {},
        create: {
            gebruikerId: testUser.id,
            organisatieId: testOrganisatie.id,
            rol: 'EIGENAAR',
        },
    });
    logger.info('✅ Organisatie lidmaatschap aangemaakt');
    // Maak basis rechten aan voor de organisatie
    const basisRechten = [
        {
            naam: 'ORGANISATIE_BEKIJKEN',
            beschrijving: 'Organisatie informatie bekijken',
            categorie: 'ORGANISATIE',
        },
        {
            naam: 'ORGANISATIE_BEWERKEN',
            beschrijving: 'Organisatie informatie bewerken',
            categorie: 'ORGANISATIE',
        },
        {
            naam: 'LEDEN_BEKIJKEN',
            beschrijving: 'Organisatie leden bekijken',
            categorie: 'LEDEN',
        },
        {
            naam: 'LEDEN_BEHEREN',
            beschrijving: 'Organisatie leden beheren',
            categorie: 'LEDEN',
        },
        {
            naam: 'UITNODIGINGEN_VERSTUREN',
            beschrijving: 'Uitnodigingen versturen',
            categorie: 'LEDEN',
        },
        {
            naam: 'CHATBOT_AANMAKEN',
            beschrijving: 'ChatBot aanmaken',
            categorie: 'CHATBOT',
        },
        {
            naam: 'CHATBOT_BEWERKEN',
            beschrijving: 'ChatBot bewerken',
            categorie: 'CHATBOT',
        },
        {
            naam: 'CHATBOT_VERWIJDEREN',
            beschrijving: 'ChatBot verwijderen',
            categorie: 'CHATBOT',
        },
    ];
    for (const recht of basisRechten) {
        await prisma.recht.upsert({
            where: {
                organisatieId_naam: {
                    organisatieId: testOrganisatie.id,
                    naam: recht.naam,
                },
            },
            update: {},
            create: {
                ...recht,
                organisatieId: testOrganisatie.id,
            },
        });
    }
    logger.info(`✅ ${basisRechten.length} basis rechten aangemaakt`);
    // Maak een test chatbot aan
    const testChatBot = await prisma.chatBot.upsert({
        where: { id: 'test-chatbot-id' },
        update: {},
        create: {
            id: 'test-chatbot-id',
            organisatieId: testOrganisatie.id,
            botNaam: 'Test Assistant',
            widgetNaam: 'Test Widget',
            websiteUrl: 'https://example.com',
            klantenServiceEmail: 'support@example.com',
            basisPrompt: 'Je bent een behulpzame AI-assistent voor klantenservice.',
            toon: 'vriendelijk en professioneel',
            startBericht: 'Hallo! Hoe kan ik je vandaag helpen?',
            mainKleur: '#007bff',
            secundaireKleur: '#6c757d',
            achtergrondKleur: '#ffffff',
            tekstKleur: '#212529',
            knopKleur: '#007bff',
            knopTekstKleur: '#ffffff',
        },
    });
    logger.info(`✅ Test chatbot aangemaakt: ${testChatBot.botNaam}`);
    logger.info('🎉 Database seed completed successfully!');
}
main()
    .catch((e) => {
    logger.error(e, 'Error during seed');
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map