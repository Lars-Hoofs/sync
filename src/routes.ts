import { FastifyInstance } from 'fastify';
import { API_VERSION } from './config/constants.js';

// Import route modules
import gebruikerRoutes from './modules/gebruiker/gebruiker.route.js';
import { organisatieRoutes, gebruikerOrganisatieRoutes } from './modules/organisatie/organisatie.routes.js';
import { 
  uitnodigingRoutes, 
  organisatieUitnodigingRoutes, 
  gebruikerUitnodigingRoutes 
} from './modules/uitnodiging/uitnodiging.routes.js';
import sessieRoutes from './modules/sessie/sessie.route.js';
import chatbotRoutes from './modules/chatbot/chatbot.route.js';
import webScrapingRoutes from './modules/chatbot/webscraping.route.js';
import fileProcessingRoutes from './modules/chatbot/file-processing.route.js';
import rechtRoutes from './modules/recht/recht.route.js';
import groepRoutes from './modules/groep/groep.route.js';
import tweeFARoutes from './modules/beveiliging/tweeFA.route.js';
import facturatieRoutes from './modules/facturatie/facturatie.route.js';
import statistiekenRoutes from './modules/statistieken/statistieken.route.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  const prefix = `/api/${API_VERSION}`;

  app.get('/api', async (request, reply) => {
    return {
      name: 'Sync API',
      version: API_VERSION,
      description: 'Multi-tenant API voor chatbot widget management',
      documentation: `${request.protocol}://${request.hostname}/docs`,
      health: `${request.protocol}://${request.hostname}/health`,
      timestamp: new Date().toISOString(),
    };
  });

  await app.register(gebruikerRoutes, { prefix });
  
  await app.register(organisatieRoutes, { prefix: `${prefix}/organisaties` });
  
  await app.register(gebruikerOrganisatieRoutes, { prefix: `${prefix}/gebruikers` });
  
  await app.register(uitnodigingRoutes, { prefix: `${prefix}/uitnodigingen` });
  
  await app.register(organisatieUitnodigingRoutes, { prefix: `${prefix}/organisaties/:organisatieId/uitnodigingen` });
  
  await app.register(gebruikerUitnodigingRoutes, { prefix: `${prefix}/gebruikers` });
  
  await app.register(sessieRoutes, { prefix: `${prefix}/gebruikers` });
  
  // await app.register(chatbotRoutes, { prefix });
  
  await app.register(webScrapingRoutes, { prefix });
  await app.register(fileProcessingRoutes, { prefix });
  
  // Register other module routes (commented out temporarily due to build issues)
  // await app.register(rechtRoutes, { prefix });
  // await app.register(groepRoutes, { prefix });
  // await app.register(tweeFARoutes, { prefix });
  // await app.register(facturatieRoutes, { prefix });
  // await app.register(statistiekenRoutes, { prefix });

  // Placeholder endpoint voor nu
  app.get(`${prefix}/test`, async (request, reply) => {
    return {
      success: true,
      message: 'API is werkend! Routes worden nog geïmplementeerd.',
      timestamp: new Date().toISOString(),
    };
  });
}
