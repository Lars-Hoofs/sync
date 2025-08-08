import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { ServiceResult, CustomError } from '../types/common';

export interface StatisticsOverview {
  totalUsers: number;
  totalOrganizations: number;
  totalChatbots: number;
  totalConversations: number;
  totalMessages: number;
  activeUsers24h: number;
  activeUsers7d: number;
  activeUsers30d: number;
}

export interface ConversationStats {
  totalConversations: number;
  avgMessagesPerConversation: number;
  avgConversationDuration: number;
  satisfactionScore?: number;
  topTopics: Array<{
    topic: string;
    count: number;
  }>;
  conversationsByDay: Array<{
    date: string;
    count: number;
  }>;
}

export interface ChatbotPerformance {
  chatbotId: string;
  chatbotNaam: string;
  totalConversations: number;
  totalMessages: number;
  avgResponseTime: number;
  successRate: number;
  satisfactionScore: number;
  topQuestions: Array<{
    question: string;
    count: number;
  }>;
  usage7Days: Array<{
    date: string;
    conversations: number;
    messages: number;
  }>;
}

export interface UserEngagement {
  totalSessions: number;
  avgSessionDuration: number;
  bounceRate: number;
  returnUserRate: number;
  sessionsByDevice: Record<string, number>;
  sessionsByHour: Array<{
    hour: number;
    count: number;
  }>;
  topPages: Array<{
    page: string;
    views: number;
  }>;
}

export interface OrganizationStats {
  organizationId: string;
  naam: string;
  totalUsers: number;
  totalChatbots: number;
  totalConversations: number;
  totalMessages: number;
  planType: string;
  usageQuota: number;
  usagePercentage: number;
  monthlyUsage: Array<{
    month: string;
    conversations: number;
    messages: number;
  }>;
}

export interface RevenueStats {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  revenueByPlan: Record<string, number>;
  revenueGrowth: Array<{
    month: string;
    revenue: number;
    newCustomers: number;
    churnedCustomers: number;
  }>;
}

class StatistiekService {
  constructor(private prisma: PrismaClient) {}

  async getOverviewStats(): Promise<ServiceResult<StatisticsOverview>> {
    try {
      const [
        totalUsers,
        totalOrganizations,
        totalChatbots,
        totalConversations,
        totalMessages,
        activeUsers24h,
        activeUsers7d,
        activeUsers30d
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.organisatie.count(),
        this.prisma.chatBot.count(),
        this.prisma.gesprek.count(),
        this.prisma.bericht.count(),
        this.prisma.user.count({
          where: {
            laatstActief: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        }),
        this.prisma.user.count({
          where: {
            laatstActief: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        this.prisma.user.count({
          where: {
            laatstActief: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      return {
        success: true,
        data: {
          totalUsers,
          totalOrganizations,
          totalChatbots,
          totalConversations,
          totalMessages,
          activeUsers24h,
          activeUsers7d,
          activeUsers30d
        }
      };
    } catch (error) {
      logger.error('Error getting overview statistics:', error);
      return {
        success: false,
        error: new CustomError('Failed to get overview statistics', 'STATS_OVERVIEW_ERROR', 500, 'StatistiekService')
      };
    }
  }

  async getConversationStats(organizationId?: string, chatbotId?: string, days = 30): Promise<ServiceResult<ConversationStats>> {
    try {
      const whereClause: any = {
        aangemaakt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      };

      if (organizationId) {
        whereClause.chatBot = {
          organisatieId: organizationId
        };
      }

      if (chatbotId) {
        whereClause.chatBotId = chatbotId;
      }

      const conversations = await this.prisma.gesprek.findMany({
        where: whereClause,
        include: {
          berichten: true,
          chatBot: {
            select: {
              naam: true,
              organisatieId: true
            }
          }
        }
      });

      const totalConversations = conversations.length;
      const totalMessages = conversations.reduce((sum, conv) => sum + conv.berichten.length, 0);
      const avgMessagesPerConversation = totalConversations > 0 ? totalMessages / totalConversations : 0;

      // Bereken gemiddelde gespreksduur
      const conversationDurations = conversations.map(conv => {
        if (conv.berichten.length === 0) return 0;
        const firstMessage = conv.berichten.reduce((earliest, msg) => 
          msg.aangemaakt < earliest.aangemaakt ? msg : earliest
        );
        const lastMessage = conv.berichten.reduce((latest, msg) => 
          msg.aangemaakt > latest.aangemaakt ? msg : latest
        );
        return lastMessage.aangemaakt.getTime() - firstMessage.aangemaakt.getTime();
      });

      const avgConversationDuration = conversationDurations.length > 0 
        ? conversationDurations.reduce((sum, duration) => sum + duration, 0) / conversationDurations.length
        : 0;

      // Gesprekken per dag
      const conversationsByDay = this.groupByDay(conversations, days);

      // Top topics (gebaseerd op gesprek metadata of berichten inhoud)
      const topTopics = await this.getTopTopics(conversations);

      return {
        success: true,
        data: {
          totalConversations,
          avgMessagesPerConversation,
          avgConversationDuration,
          topTopics,
          conversationsByDay
        }
      };
    } catch (error) {
      logger.error('Error getting conversation statistics:', error);
      return {
        success: false,
        error: new CustomError('Failed to get conversation statistics', 'STATS_CONVERSATION_ERROR', 500, 'StatistiekService')
      };
    }
  }

  async getChatbotPerformance(chatbotId: string, days = 30): Promise<ServiceResult<ChatbotPerformance>> {
    try {
      const chatbot = await this.prisma.chatBot.findUnique({
        where: { id: chatbotId },
        include: {
          gesprekken: {
            where: {
              aangemaakt: {
                gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
              }
            },
            include: {
              berichten: true
            }
          }
        }
      });

      if (!chatbot) {
        return {
          success: false,
          error: new CustomError('Chatbot not found', 'CHATBOT_NOT_FOUND', 404, 'StatistiekService')
        };
      }

      const conversations = chatbot.gesprekken;
      const totalConversations = conversations.length;
      const totalMessages = conversations.reduce((sum, conv) => sum + conv.berichten.length, 0);

      // Bereken response tijd (dummy implementatie - zou echte response times moeten tracking)
      const avgResponseTime = 2500; // ms

      // Success rate (percentage van gesprekken die succesvol zijn)
      const successfulConversations = conversations.filter(conv => conv.berichten.length >= 2).length;
      const successRate = totalConversations > 0 ? (successfulConversations / totalConversations) * 100 : 0;

      // Satisfaction score (zou uit feedback moeten komen)
      const satisfactionScore = 4.2; // uit 5

      // Top questions
      const topQuestions = await this.getTopQuestions(conversations);

      // Usage per dag voor de laatste 7 dagen
      const usage7Days = this.getUsage7Days(conversations);

      return {
        success: true,
        data: {
          chatbotId: chatbot.id,
          chatbotNaam: chatbot.naam,
          totalConversations,
          totalMessages,
          avgResponseTime,
          successRate,
          satisfactionScore,
          topQuestions,
          usage7Days
        }
      };
    } catch (error) {
      logger.error('Error getting chatbot performance:', error);
      return {
        success: false,
        error: new CustomError('Failed to get chatbot performance', 'STATS_CHATBOT_ERROR', 500, 'StatistiekService')
      };
    }
  }

  async getUserEngagement(organizationId?: string, days = 30): Promise<ServiceResult<UserEngagement>> {
    try {
      const whereClause: any = {
        aangemaakt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      };

      if (organizationId) {
        whereClause.user = {
          organisatieLidmaatschappen: {
            some: {
              organisatieId: organizationId
            }
          }
        };
      }

      const sessions = await this.prisma.sessie.findMany({
        where: whereClause,
        include: {
          user: true
        }
      });

      const totalSessions = sessions.length;
      
      // Bereken gemiddelde sessie duur
      const sessionDurations = sessions.map(session => {
        if (session.verloopt && session.aangemaakt) {
          return session.verloopt.getTime() - session.aangemaakt.getTime();
        }
        return 0;
      }).filter(duration => duration > 0);

      const avgSessionDuration = sessionDurations.length > 0
        ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
        : 0;

      // Bounce rate (sessions met alleen 1 page view)
      const bounceRate = 25.5; // Placeholder - zou uit echte tracking data moeten komen

      // Return user rate
      const uniqueUsers = new Set(sessions.map(s => s.userId)).size;
      const returningUsers = sessions.filter(s => 
        sessions.find(other => other.userId === s.userId && other.id !== s.id && other.aangemaakt < s.aangemaakt)
      ).length;
      const returnUserRate = uniqueUsers > 0 ? (returningUsers / uniqueUsers) * 100 : 0;

      // Sessions by device
      const sessionsByDevice = sessions.reduce((acc, session) => {
        const device = session.apparaatType || 'unknown';
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Sessions by hour
      const sessionsByHour = this.getSessionsByHour(sessions);

      // Top pages (placeholder)
      const topPages = [
        { page: '/dashboard', views: Math.floor(totalSessions * 0.4) },
        { page: '/chatbots', views: Math.floor(totalSessions * 0.25) },
        { page: '/analytics', views: Math.floor(totalSessions * 0.2) },
        { page: '/settings', views: Math.floor(totalSessions * 0.15) }
      ];

      return {
        success: true,
        data: {
          totalSessions,
          avgSessionDuration,
          bounceRate,
          returnUserRate,
          sessionsByDevice,
          sessionsByHour,
          topPages
        }
      };
    } catch (error) {
      logger.error('Error getting user engagement:', error);
      return {
        success: false,
        error: new CustomError('Failed to get user engagement', 'STATS_ENGAGEMENT_ERROR', 500, 'StatistiekService')
      };
    }
  }

  async getOrganizationStats(organizationId: string): Promise<ServiceResult<OrganizationStats>> {
    try {
      const organization = await this.prisma.organisatie.findUnique({
        where: { id: organizationId },
        include: {
          leden: true,
          chatBots: {
            include: {
              gesprekken: {
                include: {
                  berichten: true
                }
              }
            }
          },
          abonnement: true
        }
      });

      if (!organization) {
        return {
          success: false,
          error: new CustomError('Organization not found', 'ORGANIZATION_NOT_FOUND', 404, 'StatistiekService')
        };
      }

      const totalUsers = organization.leden.length;
      const totalChatbots = organization.chatBots.length;
      const totalConversations = organization.chatBots.reduce((sum, bot) => sum + bot.gesprekken.length, 0);
      const totalMessages = organization.chatBots.reduce((sum, bot) => 
        sum + bot.gesprekken.reduce((msgSum, conv) => msgSum + conv.berichten.length, 0), 0
      );

      const planType = organization.abonnement?.planType || 'FREE';
      const usageQuota = this.getUsageQuota(planType);
      const usagePercentage = usageQuota > 0 ? (totalMessages / usageQuota) * 100 : 0;

      // Monthly usage voor de laatste 12 maanden
      const monthlyUsage = await this.getMonthlyUsage(organizationId, 12);

      return {
        success: true,
        data: {
          organizationId: organization.id,
          naam: organization.naam,
          totalUsers,
          totalChatbots,
          totalConversations,
          totalMessages,
          planType,
          usageQuota,
          usagePercentage,
          monthlyUsage
        }
      };
    } catch (error) {
      logger.error('Error getting organization statistics:', error);
      return {
        success: false,
        error: new CustomError('Failed to get organization statistics', 'STATS_ORGANIZATION_ERROR', 500, 'StatistiekService')
      };
    }
  }

  async getRevenueStats(): Promise<ServiceResult<RevenueStats>> {
    try {
      const invoices = await this.prisma.factuur.findMany({
        where: {
          status: 'BETAALD'
        },
        include: {
          abonnement: true
        }
      });

      const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.bedrag, 0);
      
      // MRR - Monthly Recurring Revenue
      const activeSubscriptions = await this.prisma.abonnement.findMany({
        where: {
          status: 'ACTIEF'
        }
      });

      const monthlyRecurringRevenue = activeSubscriptions.reduce((sum, sub) => {
        // Converteer naar maandelijks bedrag
        const monthlyAmount = sub.intervalType === 'MONTHLY' 
          ? sub.prijs 
          : sub.intervalType === 'YEARLY' 
            ? sub.prijs / 12 
            : 0;
        return sum + monthlyAmount;
      }, 0);

      // ARPU - Average Revenue Per User
      const totalActiveUsers = await this.prisma.user.count({
        where: {
          isActief: true
        }
      });
      const averageRevenuePerUser = totalActiveUsers > 0 ? monthlyRecurringRevenue / totalActiveUsers : 0;

      // Churn rate (percentage van geannuleerde abonnementen)
      const cancelledSubs = await this.prisma.abonnement.count({
        where: {
          status: 'GEANNULEERD',
          geannuleerdOp: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      });
      const totalSubs = activeSubscriptions.length + cancelledSubs;
      const churnRate = totalSubs > 0 ? (cancelledSubs / totalSubs) * 100 : 0;

      // Revenue by plan
      const revenueByPlan = activeSubscriptions.reduce((acc, sub) => {
        acc[sub.planType] = (acc[sub.planType] || 0) + sub.prijs;
        return acc;
      }, {} as Record<string, number>);

      // Revenue growth (laatste 12 maanden)
      const revenueGrowth = await this.getRevenueGrowth(12);

      return {
        success: true,
        data: {
          totalRevenue,
          monthlyRecurringRevenue,
          averageRevenuePerUser,
          churnRate,
          revenueByPlan,
          revenueGrowth
        }
      };
    } catch (error) {
      logger.error('Error getting revenue statistics:', error);
      return {
        success: false,
        error: new CustomError('Failed to get revenue statistics', 'STATS_REVENUE_ERROR', 500, 'StatistiekService')
      };
    }
  }

  // Helper methods

  private groupByDay(items: any[], days: number) {
    const result = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      const count = items.filter(item => 
        item.aangemaakt.toISOString().split('T')[0] === dateString
      ).length;
      
      result.unshift({ date: dateString, count });
    }
    
    return result;
  }

  private async getTopTopics(conversations: any[]): Promise<Array<{topic: string; count: number}>> {
    // Placeholder implementatie - zou NLP kunnen gebruiken om topics te extraheren
    return [
      { topic: 'Product vragen', count: Math.floor(conversations.length * 0.3) },
      { topic: 'Technische ondersteuning', count: Math.floor(conversations.length * 0.25) },
      { topic: 'Billing', count: Math.floor(conversations.length * 0.2) },
      { topic: 'Algemene informatie', count: Math.floor(conversations.length * 0.15) },
      { topic: 'Overig', count: Math.floor(conversations.length * 0.1) }
    ];
  }

  private async getTopQuestions(conversations: any[]): Promise<Array<{question: string; count: number}>> {
    // Placeholder implementatie - zou echte vraag analyse kunnen doen
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.berichten.length, 0);
    
    return [
      { question: 'Hoe kan ik mijn account resetten?', count: Math.floor(totalMessages * 0.15) },
      { question: 'Wat zijn de kosten?', count: Math.floor(totalMessages * 0.12) },
      { question: 'Hoe gebruik ik deze functie?', count: Math.floor(totalMessages * 0.10) },
      { question: 'Is er technische ondersteuning?', count: Math.floor(totalMessages * 0.08) },
      { question: 'Kan ik upgraden?', count: Math.floor(totalMessages * 0.06) }
    ];
  }

  private getUsage7Days(conversations: any[]) {
    const result = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      const dayConversations = conversations.filter(conv => 
        conv.aangemaakt.toISOString().split('T')[0] === dateString
      );
      
      const dayMessages = dayConversations.reduce((sum, conv) => sum + conv.berichten.length, 0);
      
      result.unshift({
        date: dateString,
        conversations: dayConversations.length,
        messages: dayMessages
      });
    }
    
    return result;
  }

  private getSessionsByHour(sessions: any[]) {
    const hourCounts = new Array(24).fill(0);
    
    sessions.forEach(session => {
      const hour = session.aangemaakt.getHours();
      hourCounts[hour]++;
    });
    
    return hourCounts.map((count, hour) => ({ hour, count }));
  }

  private getUsageQuota(planType: string): number {
    const quotas = {
      'FREE': 100,
      'BASIC': 1000,
      'PROFESSIONAL': 10000,
      'ENTERPRISE': 100000
    };
    return quotas[planType] || 0;
  }

  private async getMonthlyUsage(organizationId: string, months: number) {
    const result = [];
    const now = new Date();
    
    for (let i = 0; i < months; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthString = date.toISOString().substring(0, 7); // YYYY-MM
      
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      
      const conversations = await this.prisma.gesprek.count({
        where: {
          chatBot: {
            organisatieId: organizationId
          },
          aangemaakt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });
      
      const messages = await this.prisma.bericht.count({
        where: {
          gesprek: {
            chatBot: {
              organisatieId: organizationId
            }
          },
          aangemaakt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });
      
      result.unshift({
        month: monthString,
        conversations,
        messages
      });
    }
    
    return result;
  }

  private async getRevenueGrowth(months: number) {
    const result = [];
    const now = new Date();
    
    for (let i = 0; i < months; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthString = date.toISOString().substring(0, 7);
      
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      
      const monthRevenue = await this.prisma.factuur.aggregate({
        where: {
          status: 'BETAALD',
          aangemaakt: {
            gte: monthStart,
            lte: monthEnd
          }
        },
        _sum: {
          bedrag: true
        }
      });
      
      const newCustomers = await this.prisma.organisatie.count({
        where: {
          aangemaakt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });
      
      const churnedCustomers = await this.prisma.abonnement.count({
        where: {
          status: 'GEANNULEERD',
          geannuleerdOp: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });
      
      result.unshift({
        month: monthString,
        revenue: monthRevenue._sum.bedrag || 0,
        newCustomers,
        churnedCustomers
      });
    }
    
    return result;
  }
}

export default StatistiekService;
