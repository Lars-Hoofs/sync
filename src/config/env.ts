import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).default('3000'),
  HOST: z.string().default('0.0.0.0'),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET moet minimaal 32 karakters lang zijn'),
  JWT_ISSUER: z.string().default('sync-api'),
  JWT_AUDIENCE: z.string().default('sync-client'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET moet minimaal 32 karakters lang zijn').optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET moet minimaal 32 karakters lang zijn'),
  ARGON2_SECRET: z.string().min(16, 'ARGON2_SECRET moet minimaal 16 karakters lang zijn'),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1000)).default('900000'),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.string().transform((val) => val === 'true').default('true'),
  
  // Sentry (Optional)
  SENTRY_DSN: z.string().optional(),
  
  // Email Configuration (Optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  
  // Application Settings
  INVITATION_EXPIRY_HOURS: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('72'),
  PASSWORD_RESET_EXPIRY_HOURS: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('24'),
  EMAIL_VERIFICATION_EXPIRY_HOURS: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('24'),
  SESSION_EXPIRY_HOURS: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('8'),
  
  // 2FA Settings
  TOTP_ISSUER: z.string().default('Sync API'),
  TOTP_WINDOW: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(10)).default('2'),
  
  // File Upload
  MAX_FILE_SIZE: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('10485760'),
  
  // AI APIs
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_DEFAULT_MODEL: z.string().default('gpt-3.5-turbo'),
  
  // Frontend URL
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  
  // Email From Address
  EMAIL_FROM: z.string().email().default('noreply@sync-chatbot.com'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let env: EnvConfig;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Ongeldige environment variabelen:', error.format());
    process.exit(1);
  }
  throw error;
}

export { env };
