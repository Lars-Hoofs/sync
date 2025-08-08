import { FastifyRequest, FastifyReply } from 'fastify';
import { GebruikerService } from './gebruiker.service.js';
import { SessieService } from '../sessie/sessie.service.js';
import { 
  registratieSchema,
  loginSchema,
  updateProfielSchema,
  wijzigWachtwoordSchema,
  emailVerificatieSchema,
  wachtwoordResetAanvraagSchema,
  wachtwoordResetSchema 
} from './gebruiker.schema.js';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import type { 
  Registratie, 
  Login, 
  UpdateProfiel, 
  WijzigWachtwoord,
  EmailVerificatie,
  WachtwoordResetAanvraag,
  WachtwoordReset
} from './gebruiker.dto.js';
import type { ApiResponse } from '../../shared/types/index.js';

const logger = createLogger('GebruikerController');

export class GebruikerController {
  constructor(private gebruikerService: GebruikerService) {}

  /**
   * POST /api/v1/auth/register
   * Registreer nieuwe gebruiker
   */
  async registreer(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const validatedData = registratieSchema.parse(request.body);
      const ipAddress = request.ip;

      const result = await this.gebruikerService.registreer(validatedData, ipAddress);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.CREATED).send({
        success: true,
        data: result.data,
        message: 'Account succesvol aangemaakt. Controleer uw email voor verificatie.'
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij registreren');
      
      if (error.name === 'ZodError') {
        return reply.code(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: 'Validatie fouten',
          errors: error.issues.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: ERROR_CODES.VALIDATION_ERROR
          }))
        });
      }

      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * POST /api/v1/auth/login
   * Login gebruiker
   */
  async login(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const validatedData = loginSchema.parse(request.body);
      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];

      const result = await this.gebruikerService.login(validatedData, ipAddress, userAgent);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      // Set session cookie indien login succesvol
      if (result.data!.requiresTwoFA) {
        return reply.code(HTTP_STATUS.OK).send({
          success: true,
          data: {
            requiresTwoFA: true,
            message: result.data!.message
          }
        });
      }

      // Set session cookie
      if (result.data!.sessionId) {
        reply.setCookie('session', result.data!.sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: result.data,
        message: 'Login succesvol'
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij login');
      
      if (error.name === 'ZodError') {
        return reply.code(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: 'Validatie fouten',
          errors: error.issues.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: ERROR_CODES.VALIDATION_ERROR
          }))
        });
      }

      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * GET /api/v1/gebruikers/profiel
   * Haal huidige gebruiker profiel op
   */
  async getProfiel(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd',
          errors: [{
            field: 'auth',
            message: 'Gebruiker niet gevonden in sessie',
            code: ERROR_CODES.INVALID_CREDENTIALS
          }]
        });
      }

      const result = await this.gebruikerService.getGebruikerById(userId);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.NOT_FOUND).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: result.data
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij ophalen profiel');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * PUT /api/v1/gebruikers/profiel
   * Update gebruiker profiel
   */
  async updateProfiel(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const userId = (request as any).user?.id;
      const validatedData = updateProfielSchema.parse(request.body);

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.gebruikerService.updateProfiel(userId, validatedData);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: result.data,
        message: 'Profiel succesvol bijgewerkt'
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij updaten profiel');
      
      if (error.name === 'ZodError') {
        return reply.code(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: 'Validatie fouten',
          errors: error.issues.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: ERROR_CODES.VALIDATION_ERROR
          }))
        });
      }

      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * POST /api/v1/gebruikers/wachtwoord-wijzigen
   * Wijzig wachtwoord
   */
  async wijzigWachtwoord(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const userId = (request as any).user?.id;
      const validatedData = wijzigWachtwoordSchema.parse(request.body);

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.gebruikerService.wijzigWachtwoord(userId, validatedData);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: result.data!.message
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij wijzigen wachtwoord');
      
      if (error.name === 'ZodError') {
        return reply.code(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: 'Validatie fouten',
          errors: error.issues.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: ERROR_CODES.VALIDATION_ERROR
          }))
        });
      }

      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * POST /api/v1/gebruikers/2fa/enable
   * Schakel 2FA in
   */
  async schakel2FAIn(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.gebruikerService.schakel2FAIn(userId);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: result.data,
        message: '2FA succesvol ingeschakeld. Bewaar de backup codes veilig!'
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij inschakelen 2FA');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * POST /api/v1/auth/logout
   * Logout gebruiker
   */
  async logout(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      // TODO: Invalidate session/token
      
      // Clear session cookie
      reply.clearCookie('session');

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: 'Succesvol uitgelogd'
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij logout');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }
}
