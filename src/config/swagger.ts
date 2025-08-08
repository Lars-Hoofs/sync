import { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import { FastifySwaggerUiOptions } from '@fastify/swagger-ui';
import { env } from './env.js';

export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    openapi: '3.0.3',
    info: {
      title: 'Sync API',
      description: 'Multi-tenant API voor chatbot widget management',
      version: '1.0.0',
      contact: {
        name: 'Lars Hoofs',
        email: 'lars@example.com',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
      {
        cookieAuth: [],
      },
    ],
    tags: [
      { name: 'Authenticatie', description: 'Login, registratie en sessie management' },
      { name: 'Gebruikers', description: 'Gebruiker management endpoints' },
      { name: 'Organisaties', description: 'Organisatie management endpoints' },
      { name: 'Uitnodigingen', description: 'Uitnodiging management endpoints' },
      { name: 'ChatBots', description: 'ChatBot management endpoints' },
      { name: 'Rechten', description: 'Rechten en autorisatie endpoints' },
      { name: 'Groepen', description: 'Gebruikersgroep management endpoints' },
      { name: '2FA', description: 'Twee-factor authenticatie endpoints' },
      { name: 'Facturatie', description: 'Facturatie en abonnement endpoints' },
      { name: 'Statistieken', description: 'Statistieken en rapportage endpoints' },
    ],
  },
};

export const swaggerUiConfig: FastifySwaggerUiOptions = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
  },
  uiHooks: {
    onRequest: function (request, reply, next) {
      // Voeg hier eventuele authenticatie checks toe voor swagger UI
      next();
    },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, request, reply) => {
    return swaggerObject;
  },
  transformSpecificationClone: true,
};
