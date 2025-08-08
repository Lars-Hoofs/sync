import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { createLogger } from '../shared/utils/logger.js';
import { ServiceResult } from '../shared/types/index.js';
import { CustomError } from '../shared/utils/errors.js';

const logger = createLogger('EmailService');

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailData {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface VerificationEmailData {
  to: string;
  name: string;
  verificationToken: string;
  baseUrl: string;
}

export interface InvitationEmailData {
  to: string;
  inviterName: string;
  organizationName: string;
  invitationToken: string;
  baseUrl: string;
}

export interface PasswordResetEmailData {
  to: string;
  name: string;
  resetToken: string;
  baseUrl: string;
}

export interface WelcomeEmailData {
  to: string;
  name: string;
  organizationName?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    try {
      if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
        logger.warn('Email service not configured - missing SMTP settings');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: env.NODE_ENV === 'production',
        },
      });

      // Test connection
      await this.transporter.verify();
      this.isConfigured = true;
      logger.info('Email service configured successfully');
    } catch (error) {
      logger.error('Failed to configure email service:', error);
      this.transporter = null;
      this.isConfigured = false;
    }
  }

  private generateVerificationEmailTemplate(data: VerificationEmailData): EmailTemplate {
    const verificationUrl = `${data.baseUrl}/verify-email?token=${data.verificationToken}`;
    
    return {
      subject: 'Verifieer je email adres',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Email Verificatie</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welkom bij Sync API!</h1>
            </div>
            <div class="content">
              <h2>Hallo ${data.name},</h2>
              <p>Bedankt voor je registratie! Om je account te activeren, moet je eerst je email adres verifiëren.</p>
              <p>Klik op de onderstaande knop om je email adres te verifiëren:</p>
              <a href="${verificationUrl}" class="button">Verifieer Email Adres</a>
              <p>Of kopieer deze link naar je browser:</p>
              <p><a href="${verificationUrl}">${verificationUrl}</a></p>
              <p>Deze link is 24 uur geldig.</p>
            </div>
            <div class="footer">
              <p>© 2024 Sync API. Alle rechten voorbehouden.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welkom bij Sync API!
        
        Hallo ${data.name},
        
        Bedankt voor je registratie! Om je account te activeren, moet je eerst je email adres verifiëren.
        
        Bezoek deze link om je email adres te verifiëren:
        ${verificationUrl}
        
        Deze link is 24 uur geldig.
        
        © 2024 Sync API. Alle rechten voorbehouden.
      `
    };
  }

  private generateInvitationEmailTemplate(data: InvitationEmailData): EmailTemplate {
    const acceptUrl = `${data.baseUrl}/invitation/accept?token=${data.invitationToken}`;
    
    return {
      subject: `Uitnodiging voor ${data.organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Organisatie Uitnodiging</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Je bent uitgenodigd!</h1>
            </div>
            <div class="content">
              <h2>Hallo,</h2>
              <p>${data.inviterName} heeft je uitgenodigd om lid te worden van <strong>${data.organizationName}</strong>.</p>
              <p>Klik op de onderstaande knop om de uitnodiging te accepteren:</p>
              <a href="${acceptUrl}" class="button">Accepteer Uitnodiging</a>
              <p>Of kopieer deze link naar je browser:</p>
              <p><a href="${acceptUrl}">${acceptUrl}</a></p>
              <p>Deze uitnodiging is 7 dagen geldig.</p>
            </div>
            <div class="footer">
              <p>© 2024 Sync API. Alle rechten voorbehouden.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Je bent uitgenodigd!
        
        Hallo,
        
        ${data.inviterName} heeft je uitgenodigd om lid te worden van ${data.organizationName}.
        
        Bezoek deze link om de uitnodiging te accepteren:
        ${acceptUrl}
        
        Deze uitnodiging is 7 dagen geldig.
        
        © 2024 Sync API. Alle rechten voorbehouden.
      `
    };
  }

  private generatePasswordResetEmailTemplate(data: PasswordResetEmailData): EmailTemplate {
    const resetUrl = `${data.baseUrl}/reset-password?token=${data.resetToken}`;
    
    return {
      subject: 'Wachtwoord reset verzoek',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Wachtwoord Reset</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Wachtwoord Reset</h1>
            </div>
            <div class="content">
              <h2>Hallo ${data.name},</h2>
              <p>We hebben een verzoek ontvangen om je wachtwoord te resetten.</p>
              <p>Klik op de onderstaande knop om je wachtwoord te resetten:</p>
              <a href="${resetUrl}" class="button">Reset Wachtwoord</a>
              <p>Of kopieer deze link naar je browser:</p>
              <p><a href="${resetUrl}">${resetUrl}</a></p>
              <div class="warning">
                <strong>⚠️ Belangrijk:</strong> Deze link is slechts 1 uur geldig. Als je dit verzoek niet hebt gedaan, kun je deze email negeren.
              </div>
            </div>
            <div class="footer">
              <p>© 2024 Sync API. Alle rechten voorbehouden.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Wachtwoord Reset
        
        Hallo ${data.name},
        
        We hebben een verzoek ontvangen om je wachtwoord te resetten.
        
        Bezoek deze link om je wachtwoord te resetten:
        ${resetUrl}
        
        ⚠️ Belangrijk: Deze link is slechts 1 uur geldig. Als je dit verzoek niet hebt gedaan, kun je deze email negeren.
        
        © 2024 Sync API. Alle rechten voorbehouden.
      `
    };
  }

  private generateWelcomeEmailTemplate(data: WelcomeEmailData): EmailTemplate {
    return {
      subject: 'Welkom bij Sync API!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Welkom</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welkom!</h1>
            </div>
            <div class="content">
              <h2>Hallo ${data.name},</h2>
              <p>Je account is succesvol geactiveerd! ${data.organizationName ? `Je bent nu lid van <strong>${data.organizationName}</strong>.` : ''}</p>
              <p>Je kunt nu alle functies van het platform gebruiken:</p>
              <ul>
                <li>✅ ChatBot widgets maken en beheren</li>
                <li>✅ Datasources uploaden en verwerken</li>
                <li>✅ Teamleden uitnodigen</li>
                <li>✅ Gesprekken analyseren en statistieken bekijken</li>
              </ul>
              <p>Veel plezier met het platform!</p>
            </div>
            <div class="footer">
              <p>© 2024 Sync API. Alle rechten voorbehouden.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        🎉 Welkom!
        
        Hallo ${data.name},
        
        Je account is succesvol geactiveerd! ${data.organizationName ? `Je bent nu lid van ${data.organizationName}.` : ''}
        
        Je kunt nu alle functies van het platform gebruiken:
        ✅ ChatBot widgets maken en beheren
        ✅ Datasources uploaden en verwerken  
        ✅ Teamleden uitnodigen
        ✅ Gesprekken analyseren en statistieken bekijken
        
        Veel plezier met het platform!
        
        © 2024 Sync API. Alle rechten voorbehouden.
      `
    };
  }

  async sendEmail(data: EmailData): Promise<ServiceResult<boolean>> {
    try {
      if (!this.isConfigured || !this.transporter) {
        return {
          success: false,
          error: new CustomError('Email service not configured', 'EMAIL_NOT_CONFIGURED', 500, 'EmailService')
        };
      }

      const mailOptions = {
        from: `"Sync API" <${env.SMTP_FROM || env.SMTP_USER}>`,
        to: Array.isArray(data.to) ? data.to.join(', ') : data.to,
        cc: data.cc ? (Array.isArray(data.cc) ? data.cc.join(', ') : data.cc) : undefined,
        bcc: data.bcc ? (Array.isArray(data.bcc) ? data.bcc.join(', ') : data.bcc) : undefined,
        subject: data.subject,
        html: data.html,
        text: data.text,
        attachments: data.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${data.to}`, { messageId: result.messageId });

      return { success: true, data: true };
    } catch (error) {
      logger.error('Failed to send email:', error);
      return {
        success: false,
        error: new CustomError('Failed to send email', 'EMAIL_SEND_FAILED', 500, 'EmailService')
      };
    }
  }

  async sendVerificationEmail(data: VerificationEmailData): Promise<ServiceResult<boolean>> {
    const template = this.generateVerificationEmailTemplate(data);
    return this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendInvitationEmail(data: InvitationEmailData): Promise<ServiceResult<boolean>> {
    const template = this.generateInvitationEmailTemplate(data);
    return this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<ServiceResult<boolean>> {
    const template = this.generatePasswordResetEmailTemplate(data);
    return this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<ServiceResult<boolean>> {
    const template = this.generateWelcomeEmailTemplate(data);
    return this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async testConnection(): Promise<ServiceResult<boolean>> {
    try {
      if (!this.isConfigured || !this.transporter) {
        return {
          success: false,
          error: new CustomError('Email service not configured', 'EMAIL_NOT_CONFIGURED', 500, 'EmailService')
        };
      }

      await this.transporter.verify();
      return { success: true, data: true };
    } catch (error) {
      logger.error('Email connection test failed:', error);
      return {
        success: false,
        error: new CustomError('Email connection failed', 'EMAIL_CONNECTION_FAILED', 500, 'EmailService')
      };
    }
  }

  get configured(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();
