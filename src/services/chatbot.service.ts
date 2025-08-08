import { PrismaClient, ChatBot, DataBron, DataBronType, Prisma } from '@prisma/client';
import { createLogger } from '../shared/utils/logger.js';

const logger = createLogger('ChatBotService');
import { ServiceResult } from '../shared/types/index.js';
import { CustomError } from '../shared/utils/errors.js';
import { generateSecureToken } from '../shared/utils/crypto.js';

// Create alias for backward compatibility
const generateRandomString = (length: number) => generateSecureToken(length);
import WebScrapingService from './webscraping.service';
import FileProcessingService, { UploadedFile } from './file-processing.service';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ChatBotCreateData {
  naam: string;
  beschrijving?: string;
  configuratie: {
    welkomstBericht?: string;
    kleuren?: {
      primair?: string;
      accent?: string;
      achtergrond?: string;
      tekst?: string;
    };
    positie?: 'rechtsonder' | 'linksonder' | 'rechtsboven' | 'linksboven';
    grootte?: 'klein' | 'medium' | 'groot';
    taal?: string;
    maxBerichten?: number;
    timeout?: number;
  };
  organisatieId: string;
}

export interface ChatBotUpdateData {
  naam?: string;
  beschrijving?: string;
  configuratie?: any;
  isActief?: boolean;
}

export interface DataBronCreateData {
  naam: string;
  type: DataBronType;
  url?: string;
  inhoud?: string;
  metadata?: any;
  chatBotId: string;
}

export interface ChatBotWithSources extends ChatBot {
  dataBronnen: DataBron[];
  _count?: {
    gesprekken: number;
    dataBronnen: number;
  };
}

export interface WidgetConfig {
  chatBotId: string;
  apiKey: string;
  configuratie: any;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  metadata?: any;
}

export interface ConversationResponse {
  message: string;
  suggestedActions?: string[];
  metadata?: any;
}

class ChatBotService {
  private webScrapingService: WebScrapingService;
  private fileProcessingService: FileProcessingService;

  constructor(private prisma: PrismaClient) {
    this.webScrapingService = new WebScrapingService(prisma);
    this.fileProcessingService = new FileProcessingService(prisma);
  }

  async createChatBot(data: ChatBotCreateData, userId: string): Promise<ServiceResult<ChatBot>> {
    try {
      // Verificeer of gebruiker toegang heeft tot organisatie
      const membership = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          organisatieId: data.organisatieId,
          userId: userId,
          rol: {
            in: ['EIGENAAR', 'BEHEERDER', 'EDITOR']
          }
        }
      });

      if (!membership) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten om chatbot te maken', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
        };
      }

      // Controleer limieten van het abonnement
      const organization = await this.prisma.organisatie.findUnique({
        where: { id: data.organisatieId },
        include: {
          abonnement: true,
          chatBots: true
        }
      });

      if (organization?.abonnement) {
        const currentBotCount = organization.chatBots.length;
        const maxBots = this.getMaxBotsForPlan(organization.abonnement.planType);
        
        if (currentBotCount >= maxBots) {
          return {
            success: false,
            error: new CustomError(`Maximum aantal chatbots bereikt voor ${organization.abonnement.planType} plan`, 'QUOTA_EXCEEDED', 400, 'ChatBotService')
          };
        }
      }

      // Genereer unieke API sleutel
      const apiSleutel = `cb_${generateRandomString(32)}`;

      const chatBot = await this.prisma.chatBot.create({
        data: {
          naam: data.naam,
          beschrijving: data.beschrijving,
          configuratie: data.configuratie,
          organisatieId: data.organisatieId,
          apiSleutel,
          isActief: true,
          aangemaakt: new Date(),
          bijgewerkt: new Date()
        }
      });

      logger.info(`ChatBot aangemaakt: ${chatBot.id} voor organisatie ${data.organisatieId}`);

      return {
        success: true,
        data: chatBot
      };
    } catch (error) {
      logger.error('Error creating chatbot:', error);
      return {
        success: false,
        error: new CustomError('Failed to create chatbot', 'CHATBOT_CREATE_ERROR', 500, 'ChatBotService')
      };
    }
  }

  async getChatBotById(id: string, userId?: string): Promise<ServiceResult<ChatBotWithSources>> {
    try {
      const chatBot = await this.prisma.chatBot.findUnique({
        where: { id },
        include: {
          dataBronnen: {
            orderBy: {
              aangemaakt: 'desc'
            }
          },
          organisatie: {
            select: {
              id: true,
              naam: true
            }
          },
          _count: {
            select: {
              gesprekken: true,
              dataBronnen: true
            }
          }
        }
      });

      if (!chatBot) {
        return {
          success: false,
          error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
        };
      }

      // Als userId is gegeven, controleer toegang
      if (userId) {
        const hasAccess = await this.hasAccessToChatBot(chatBot.organisatieId, userId);
        if (!hasAccess) {
          return {
            success: false,
            error: new CustomError('Onvoldoende rechten om chatbot te bekijken', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
          };
        }
      }

      return {
        success: true,
        data: chatBot
      };
    } catch (error) {
      logger.error('Error getting chatbot:', error);
      return {
        success: false,
        error: new CustomError('Failed to get chatbot', 'CHATBOT_GET_ERROR', 500, 'ChatBotService')
      };
    }
  }

  async getChatBotsByOrganization(organizationId: string, userId: string): Promise<ServiceResult<ChatBotWithSources[]>> {
    try {
      const hasAccess = await this.hasAccessToChatBot(organizationId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
        };
      }

      const chatBots = await this.prisma.chatBot.findMany({
        where: {
          organisatieId: organizationId
        },
        include: {
          dataBronnen: {
            orderBy: {
              aangemaakt: 'desc'
            }
          },
          _count: {
            select: {
              gesprekken: true,
              dataBronnen: true
            }
          }
        },
        orderBy: {
          aangemaakt: 'desc'
        }
      });

      return {
        success: true,
        data: chatBots
      };
    } catch (error) {
      logger.error('Error getting chatbots by organization:', error);
      return {
        success: false,
        error: new CustomError('Failed to get chatbots', 'CHATBOT_GET_ORGANIZATION_ERROR', 500, 'ChatBotService')
      };
    }
  }

  async updateChatBot(id: string, data: ChatBotUpdateData, userId: string): Promise<ServiceResult<ChatBot>> {
    try {
      const chatBot = await this.prisma.chatBot.findUnique({
        where: { id },
        select: { organisatieId: true }
      });

      if (!chatBot) {
        return {
          success: false,
          error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
        };
      }

      const hasAccess = await this.hasAccessToChatBot(chatBot.organisatieId, userId, ['EIGENAAR', 'BEHEERDER', 'EDITOR']);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten om chatbot te wijzigen', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
        };
      }

      const updatedChatBot = await this.prisma.chatBot.update({
        where: { id },
        data: {
          ...data,
          bijgewerkt: new Date()
        }
      });

      return {
        success: true,
        data: updatedChatBot
      };
    } catch (error) {
      logger.error('Error updating chatbot:', error);
      return {
        success: false,
        error: new CustomError('Failed to update chatbot', 'CHATBOT_UPDATE_ERROR', 500, 'ChatBotService')
      };
    }
  }

  async deleteChatBot(id: string, userId: string): Promise<ServiceResult<boolean>> {
    try {
      const chatBot = await this.prisma.chatBot.findUnique({
        where: { id },
        select: { organisatieId: true }
      });

      if (!chatBot) {
        return {
          success: false,
          error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
        };
      }

      const hasAccess = await this.hasAccessToChatBot(chatBot.organisatieId, userId, ['EIGENAAR', 'BEHEERDER']);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten om chatbot te verwijderen', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
        };
      }

      // Verwijder eerst alle gerelateerde data
      await this.prisma.$transaction([
        // Verwijder berichten van gesprekken
        this.prisma.bericht.deleteMany({
          where: {
            gesprek: {
              chatBotId: id
            }
          }
        }),
        // Verwijder gesprekken
        this.prisma.gesprek.deleteMany({
          where: {
            chatBotId: id
          }
        }),
        // Verwijder databronnen
        this.prisma.dataBron.deleteMany({
          where: {
            chatBotId: id
          }
        }),
        // Verwijder chatbot
        this.prisma.chatBot.delete({
          where: { id }
        })
      ]);

      logger.info(`ChatBot verwijderd: ${id}`);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      logger.error('Error deleting chatbot:', error);
      return {
        success: false,
        error: new CustomError('Failed to delete chatbot', 'CHATBOT_DELETE_ERROR', 500, 'ChatBotService')
      };
    }
  }

  async addDataSource(data: DataBronCreateData, userId: string): Promise<ServiceResult<DataBron>> {
    try {
      // Controleer toegang tot chatbot
      const chatBot = await this.prisma.chatBot.findUnique({
        where: { id: data.chatBotId },
        select: { 
          organisatieId: true,
          organisatie: {
            include: {
              abonnement: true
            }
          },
          _count: {
            select: {
              dataBronnen: true
            }
          }
        }
      });

      if (!chatBot) {
        return {
          success: false,
          error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
        };
      }

      const hasAccess = await this.hasAccessToChatBot(chatBot.organisatieId, userId, ['EIGENAAR', 'BEHEERDER', 'EDITOR']);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
        };
      }

      // Controleer limieten
      if (chatBot.organisatie.abonnement) {
        const currentSourceCount = chatBot._count.dataBronnen;
        const maxSources = this.getMaxDataSourcesForPlan(chatBot.organisatie.abonnement.planType);
        
        if (currentSourceCount >= maxSources) {
          return {
            success: false,
            error: new CustomError(`Maximum aantal databronnen bereikt voor ${chatBot.organisatie.abonnement.planType} plan`, 'QUOTA_EXCEEDED', 400, 'ChatBotService')
          };
        }
      }

      const dataBron = await this.prisma.dataBron.create({
        data: {
          naam: data.naam,
          type: data.type,
          url: data.url,
          inhoud: data.inhoud,
          metadata: data.metadata || {},
          chatBotId: data.chatBotId,
          isActief: true,
          aangemaakt: new Date(),
          bijgewerkt: new Date()
        }
      });

      // Process the data source content
      await this.processDataSource(dataBron);

      logger.info(`DataBron toegevoegd: ${dataBron.id} voor chatbot ${data.chatBotId}`);

      return {
        success: true,
        data: dataBron
      };
    } catch (error) {
      logger.error('Error adding data source:', error);
      return {
        success: false,
        error: new CustomError('Failed to add data source', 'DATASOURCE_ADD_ERROR', 500, 'ChatBotService')
      };
    }
  }

  async removeDataSource(id: string, userId: string): Promise<ServiceResult<boolean>> {
    try {
      const dataBron = await this.prisma.dataBron.findUnique({
        where: { id },
        include: {
          chatBot: {
            select: {
              organisatieId: true
            }
          }
        }
      });

      if (!dataBron) {
        return {
          success: false,
          error: new CustomError('DataBron not found', 'DATASOURCE_NOT_FOUND', 404, 'ChatBotService')
        };
      }

      const hasAccess = await this.hasAccessToChatBot(dataBron.chatBot.organisatieId, userId, ['EIGENAAR', 'BEHEERDER', 'EDITOR']);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
        };
      }

      await this.prisma.dataBron.delete({
        where: { id }
      });

      return {
        success: true,
        data: true
      };
    } catch (error) {
      logger.error('Error removing data source:', error);
      return {
        success: false,
        error: new CustomError('Failed to remove data source', 'DATASOURCE_REMOVE_ERROR', 500, 'ChatBotService')
      };
    }
  }

  async generateWidgetCode(chatBotId: string, userId: string): Promise<ServiceResult<string>> {
    try {
      const chatBot = await this.prisma.chatBot.findUnique({
        where: { id: chatBotId },
        select: {
          id: true,
          apiSleutel: true,
          configuratie: true,
          organisatieId: true
        }
      });

      if (!chatBot) {
        return {
          success: false,
          error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
        };
      }

      const hasAccess = await this.hasAccessToChatBot(chatBot.organisatieId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: new CustomError('Onvoldoende rechten', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
        };
      }

      const widgetCode = this.generateWidgetHTML(chatBot);

      return {
        success: true,
        data: widgetCode
      };
    } catch (error) {
      logger.error('Error generating widget code:', error);
      return {
        success: false,
        error: new CustomError('Failed to generate widget code', 'WIDGET_GENERATE_ERROR', 500, 'ChatBotService')
      };
    }
  }

  async processConversation(chatBotId: string, messages: ConversationMessage[], sessionId?: string): Promise<ServiceResult<ConversationResponse>> {
    try {
      const chatBot = await this.prisma.chatBot.findUnique({
        where: { id: chatBotId, isActief: true },
        include: {
          dataBronnen: {
            where: { isActief: true }
          }
        }
      });

      if (!chatBot) {
        return {
          success: false,
          error: new CustomError('ChatBot not found or inactive', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
        };
      }

      // Get or create conversation
      let gesprek = null;
      if (sessionId) {
        gesprek = await this.prisma.gesprek.findFirst({
          where: {
            chatBotId: chatBotId,
            sessieId: sessionId,
            isActief: true
          }
        });
      }

      if (!gesprek) {
        gesprek = await this.prisma.gesprek.create({
          data: {
            chatBotId: chatBotId,
            sessieId: sessionId || generateRandomString(16),
            isActief: true,
            aangemaakt: new Date(),
            bijgewerkt: new Date()
          }
        });
      }

      // Save user message
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        await this.prisma.bericht.create({
          data: {
            gesprekId: gesprek.id,
            inhoud: lastMessage.content,
            afzender: 'USER',
            metadata: lastMessage.metadata || {},
            aangemaakt: new Date()
          }
        });
      }

      // Generate response (placeholder AI logic)
      const response = await this.generateBotResponse(chatBot, messages);

      // Save bot response
      await this.prisma.bericht.create({
        data: {
          gesprekId: gesprek.id,
          inhoud: response.message,
          afzender: 'BOT',
          metadata: response.metadata || {},
          aangemaakt: new Date()
        }
      });

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Error processing conversation:', error);
      return {
        success: false,
        error: new CustomError('Failed to process conversation', 'CONVERSATION_PROCESS_ERROR', 500, 'ChatBotService')
      };
    }
  }

  // Website Scraping Methods

  async startWebsiteCrawl(
    chatBotId: string,
    startUrl: string,
    userId: string,
    options: {
      maxDepth?: number;
      maxPages?: number;
      includePaths?: string[];
      excludePaths?: string[];
    } = {}
  ): Promise<ServiceResult<string>> {
    // Verify access
    const chatBot = await this.prisma.chatBot.findUnique({
      where: { id: chatBotId },
      select: { organisatieId: true }
    });

    if (!chatBot) {
      return {
        success: false,
        error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
      };
    }

    const hasAccess = await this.hasAccessToChatBot(chatBot.organisatieId, userId, ['EIGENAAR', 'BEHEERDER', 'EDITOR']);
    if (!hasAccess) {
      return {
        success: false,
        error: new CustomError('Onvoldoende rechten', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
      };
    }

    return this.webScrapingService.startWebsiteCrawl(chatBotId, startUrl, options);
  }

  async getCrawlStatus(crawlId: string, userId: string): Promise<ServiceResult<any>> {
    return this.webScrapingService.getCrawlStatus(crawlId);
  }

  async cancelCrawl(crawlId: string, userId: string): Promise<ServiceResult<boolean>> {
    return this.webScrapingService.cancelCrawl(crawlId);
  }

  async scrapeIndividualPage(
    chatBotId: string,
    url: string,
    userId: string
  ): Promise<ServiceResult<any>> {
    // Verify access
    const chatBot = await this.prisma.chatBot.findUnique({
      where: { id: chatBotId },
      select: { organisatieId: true }
    });

    if (!chatBot) {
      return {
        success: false,
        error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
      };
    }

    const hasAccess = await this.hasAccessToChatBot(chatBot.organisatieId, userId, ['EIGENAAR', 'BEHEERDER', 'EDITOR']);
    if (!hasAccess) {
      return {
        success: false,
        error: new CustomError('Onvoldoende rechten', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
      };
    }

    return this.webScrapingService.scrapeIndividualPage(url, chatBotId);
  }

  // File Processing Methods

  async uploadAndProcessFile(
    chatBotId: string,
    file: UploadedFile,
    userId: string,
    options: {
      chunkSize?: number;
      extractMetadata?: boolean;
    } = {}
  ): Promise<ServiceResult<any>> {
    // Verify access
    const chatBot = await this.prisma.chatBot.findUnique({
      where: { id: chatBotId },
      select: { organisatieId: true }
    });

    if (!chatBot) {
      return {
        success: false,
        error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
      };
    }

    const hasAccess = await this.hasAccessToChatBot(chatBot.organisatieId, userId, ['EIGENAAR', 'BEHEERDER', 'EDITOR']);
    if (!hasAccess) {
      return {
        success: false,
        error: new CustomError('Onvoldoende rechten', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
      };
    }

    return this.fileProcessingService.processFile(file, chatBotId, options);
  }

  async getProcessedFiles(chatBotId: string, userId: string): Promise<ServiceResult<any>> {
    // Verify access
    const chatBot = await this.prisma.chatBot.findUnique({
      where: { id: chatBotId },
      select: { organisatieId: true }
    });

    if (!chatBot) {
      return {
        success: false,
        error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
      };
    }

    const hasAccess = await this.hasAccessToChatBot(chatBot.organisatieId, userId);
    if (!hasAccess) {
      return {
        success: false,
        error: new CustomError('Onvoldoende rechten', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
      };
    }

    return this.fileProcessingService.getProcessedFiles(chatBotId);
  }

  async deleteProcessedFile(
    chatBotId: string,
    fileId: string,
    userId: string
  ): Promise<ServiceResult<boolean>> {
    // Verify access
    const chatBot = await this.prisma.chatBot.findUnique({
      where: { id: chatBotId },
      select: { organisatieId: true }
    });

    if (!chatBot) {
      return {
        success: false,
        error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
      };
    }

    const hasAccess = await this.hasAccessToChatBot(chatBot.organisatieId, userId, ['EIGENAAR', 'BEHEERDER', 'EDITOR']);
    if (!hasAccess) {
      return {
        success: false,
        error: new CustomError('Onvoldoende rechten', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
      };
    }

    return this.fileProcessingService.deleteFile(fileId, chatBotId);
  }

  async getAvailableContent(chatBotId: string, userId: string): Promise<ServiceResult<any>> {
    // Verify access
    const chatBot = await this.prisma.chatBot.findUnique({
      where: { id: chatBotId },
      select: { organisatieId: true }
    });

    if (!chatBot) {
      return {
        success: false,
        error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'ChatBotService')
      };
    }

    const hasAccess = await this.hasAccessToChatBot(chatBot.organisatieId, userId);
    if (!hasAccess) {
      return {
        success: false,
        error: new CustomError('Onvoldoende rechten', 'INSUFFICIENT_PERMISSIONS', 403, 'ChatBotService')
      };
    }

    return this.webScrapingService.getAvailableContent(chatBotId);
  }

  // Helper methods

  private async hasAccessToChatBot(organizationId: string, userId: string, requiredRoles?: string[]): Promise<boolean> {
    const roles = requiredRoles || ['EIGENAAR', 'BEHEERDER', 'EDITOR', 'VIEWER'];
    
    const membership = await this.prisma.organisatieLidmaatschap.findFirst({
      where: {
        organisatieId: organizationId,
        userId: userId,
        rol: {
          in: roles
        }
      }
    });

    return !!membership;
  }

  private getMaxBotsForPlan(planType: string): number {
    const limits = {
      'FREE': 1,
      'BASIC': 5,
      'PROFESSIONAL': 25,
      'ENTERPRISE': 100
    };
    return limits[planType] || 1;
  }

  private getMaxDataSourcesForPlan(planType: string): number {
    const limits = {
      'FREE': 3,
      'BASIC': 10,
      'PROFESSIONAL': 50,
      'ENTERPRISE': 200
    };
    return limits[planType] || 3;
  }

  private async processDataSource(dataBron: DataBron): Promise<void> {
    try {
      switch (dataBron.type) {
        case 'PDF':
          // PDF processing logic would go here
          logger.info(`Processing PDF data source: ${dataBron.id}`);
          break;
        case 'CSV':
          // CSV processing logic would go here
          logger.info(`Processing CSV data source: ${dataBron.id}`);
          break;
        case 'WEBSITE':
          // Website crawling logic would go here
          logger.info(`Processing website data source: ${dataBron.id}`);
          break;
        case 'TEXT':
          // Text processing logic would go here
          logger.info(`Processing text data source: ${dataBron.id}`);
          break;
        default:
          logger.warn(`Unknown data source type: ${dataBron.type}`);
      }

      // Update processing status
      await this.prisma.dataBron.update({
        where: { id: dataBron.id },
        data: {
          bijgewerkt: new Date(),
          metadata: {
            ...dataBron.metadata,
            processed: true,
            processedAt: new Date()
          }
        }
      });
    } catch (error) {
      logger.error(`Error processing data source ${dataBron.id}:`, error);
      
      await this.prisma.dataBron.update({
        where: { id: dataBron.id },
        data: {
          bijgewerkt: new Date(),
          metadata: {
            ...dataBron.metadata,
            processed: false,
            error: error.message,
            processedAt: new Date()
          }
        }
      });
    }
  }

  private generateWidgetHTML(chatBot: any): string {
    const config = chatBot.configuratie || {};
    const colors = config.kleuren || {};
    
    return `
<!-- Sync ChatBot Widget -->
<div id="sync-chatbot-widget">
  <script>
    window.SyncChatBot = {
      chatBotId: '${chatBot.id}',
      apiKey: '${chatBot.apiSleutel}',
      config: {
        welkomstBericht: '${config.welkomstBericht || 'Hallo! Hoe kan ik je helpen?'}',
        kleuren: {
          primair: '${colors.primair || '#007bff'}',
          accent: '${colors.accent || '#28a745'}',
          achtergrond: '${colors.achtergrond || '#ffffff'}',
          tekst: '${colors.tekst || '#333333'}'
        },
        positie: '${config.positie || 'rechtsonder'}',
        grootte: '${config.grootte || 'medium'}',
        taal: '${config.taal || 'nl'}',
        maxBerichten: ${config.maxBerichten || 100},
        timeout: ${config.timeout || 30000}
      }
    };
    
    (function() {
      var script = document.createElement('script');
      script.src = 'https://your-domain.com/chatbot-widget.js';
      script.async = true;
      document.head.appendChild(script);
      
      var styles = document.createElement('link');
      styles.rel = 'stylesheet';
      styles.href = 'https://your-domain.com/chatbot-widget.css';
      document.head.appendChild(styles);
    })();
  </script>
</div>
<!-- End Sync ChatBot Widget -->`;
  }

  private async generateBotResponse(chatBot: any, messages: ConversationMessage[]): Promise<ConversationResponse> {
    try {
      const { aiService } = await import('./ai.service.js');
      
      // Convert messages to AI format
      const aiMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));

      // Create chat context
      const context = {
        chatbotId: chatBot.id,
        conversationHistory: aiMessages,
        availableContent: [], // Will be populated by AI service
        systemPrompt: chatBot.configuratie?.systemPrompt
      };

      // Generate AI response
      const startTime = Date.now();
      const result = await aiService.generateResponse(context);
      const processingTime = Date.now() - startTime;

      if (result.success && result.data) {
        return {
          message: result.data.message,
          suggestedActions: result.data.suggestedActions || [
            "Meer informatie",
            "Contact opnemen",
            "Andere vraag stellen"
          ],
          metadata: {
            confidence: result.data.confidence || 0.7,
            processingTime,
            model: result.data.model,
            tokenCount: result.data.tokenCount,
            sources: result.data.sources,
            provider: result.data.metadata?.provider || 'unknown'
          }
        };
      } else {
        // Fallback response if AI fails
        return {
          message: "Bedankt voor je vraag! Ik doe mijn best om je te helpen op basis van de beschikbare informatie.",
          suggestedActions: [
            "Probeer een andere vraag",
            "Contact opnemen",
            "Bekijk documentatie"
          ],
          metadata: {
            confidence: 0.3,
            processingTime,
            error: result.error?.message,
            fallback: true
          }
        };
      }
    } catch (error) {
      logger.error('Error generating AI response, using fallback:', error);
      
      // Simple fallback response
      return {
        message: "Bedankt voor je bericht! Ik help je graag. Kun je je vraag misschien anders formuleren?",
        suggestedActions: [
          "Stel een andere vraag",
          "Contact opnemen",
          "Help"
        ],
        metadata: {
          confidence: 0.2,
          processingTime: Date.now(),
          error: 'AI service unavailable',
          fallback: true
        }
      };
    }
  }
}

export default ChatBotService;
