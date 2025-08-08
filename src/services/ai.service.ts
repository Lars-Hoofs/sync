import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../shared/utils/logger.js';
import { env } from '../config/env.js';
import { ServiceResult } from '../shared/types/index.js';
import { CustomError } from '../shared/utils/errors.js';

const logger = createLogger('AIService');

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface AIResponse {
  message: string;
  model: string;
  tokenCount?: {
    prompt: number;
    completion: number;
    total: number;
  };
  confidence?: number;
  sources?: string[];
  suggestedActions?: string[];
  metadata?: Record<string, any>;
}

export interface ChatContext {
  chatbotId: string;
  conversationHistory: AIMessage[];
  availableContent: Array<{
    id: string;
    title: string;
    content: string;
    source: string;
    relevanceScore?: number;
  }>;
  systemPrompt?: string;
}

export class AIService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize OpenAI
    if (env.OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: env.OPENAI_API_KEY
        });
        logger.info('OpenAI client initialized');
      } catch (error) {
        logger.error('Failed to initialize OpenAI client:', error);
      }
    }

    // Initialize Anthropic
    if (env.ANTHROPIC_API_KEY) {
      try {
        this.anthropic = new Anthropic({
          apiKey: env.ANTHROPIC_API_KEY
        });
        logger.info('Anthropic client initialized');
      } catch (error) {
        logger.error('Failed to initialize Anthropic client:', error);
      }
    }

    if (!this.openai && !this.anthropic) {
      logger.warn('No AI providers configured. Responses will be fallback only.');
    }
  }

  /**
   * Generate a chatbot response using available AI providers
   */
  async generateResponse(context: ChatContext): Promise<ServiceResult<AIResponse>> {
    try {
      // Get relevant content for context
      const relevantContent = await this.findRelevantContent(
        context.chatbotId,
        context.conversationHistory[context.conversationHistory.length - 1]?.content || ''
      );

      // Try OpenAI first
      if (this.openai) {
        const openaiResult = await this.generateOpenAIResponse({
          ...context,
          availableContent: relevantContent
        });
        if (openaiResult.success) {
          return openaiResult;
        }
        logger.warn('OpenAI response failed, trying Anthropic');
      }

      // Try Anthropic as fallback
      if (this.anthropic) {
        const anthropicResult = await this.generateAnthropicResponse({
          ...context,
          availableContent: relevantContent
        });
        if (anthropicResult.success) {
          return anthropicResult;
        }
        logger.warn('Anthropic response failed, using fallback');
      }

      // Fallback to rule-based response
      return this.generateFallbackResponse(context);

    } catch (error) {
      logger.error('Error generating AI response:', error);
      return {
        success: false,
        error: new CustomError('Failed to generate response', 'AI_RESPONSE_ERROR', 500, 'AIService')
      };
    }
  }

  /**
   * Generate response using OpenAI
   */
  private async generateOpenAIResponse(context: ChatContext): Promise<ServiceResult<AIResponse>> {
    try {
      if (!this.openai) {
        return {
          success: false,
          error: new CustomError('OpenAI not configured', 'OPENAI_NOT_CONFIGURED', 500, 'AIService')
        };
      }

      const systemPrompt = context.systemPrompt || this.getDefaultSystemPrompt(context.chatbotId);
      const contextualPrompt = this.buildContextualPrompt(context.availableContent, context.conversationHistory);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: contextualPrompt },
        ...context.conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))
      ];

      const completion = await this.openai.chat.completions.create({
        model: env.AI_DEFAULT_MODEL,
        messages,
        max_tokens: 1000,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const response = completion.choices[0]?.message?.content || '';
      const sources = context.availableContent
        .filter(content => response.toLowerCase().includes(content.title.toLowerCase().substring(0, 20)))
        .map(content => content.title);

      return {
        success: true,
        data: {
          message: response,
          model: completion.model,
          tokenCount: {
            prompt: completion.usage?.prompt_tokens || 0,
            completion: completion.usage?.completion_tokens || 0,
            total: completion.usage?.total_tokens || 0
          },
          confidence: 0.8,
          sources,
          suggestedActions: this.generateSuggestedActions(response),
          metadata: {
            provider: 'openai',
            finishReason: completion.choices[0]?.finish_reason
          }
        }
      };

    } catch (error) {
      logger.error('OpenAI API error:', error);
      return {
        success: false,
        error: new CustomError('OpenAI API request failed', 'OPENAI_API_ERROR', 500, 'AIService')
      };
    }
  }

  /**
   * Generate response using Anthropic Claude
   */
  private async generateAnthropicResponse(context: ChatContext): Promise<ServiceResult<AIResponse>> {
    try {
      if (!this.anthropic) {
        return {
          success: false,
          error: new CustomError('Anthropic not configured', 'ANTHROPIC_NOT_CONFIGURED', 500, 'AIService')
        };
      }

      const systemPrompt = context.systemPrompt || this.getDefaultSystemPrompt(context.chatbotId);
      const contextualPrompt = this.buildContextualPrompt(context.availableContent, context.conversationHistory);
      
      // Format conversation for Claude
      const conversationText = context.conversationHistory.map(msg => 
        `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
      ).join('\n\n');

      const fullPrompt = `${systemPrompt}\n\n${contextualPrompt}\n\nConversation:\n${conversationText}\n\nAssistant:`;

      const message = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          { role: 'user', content: fullPrompt }
        ]
      });

      const response = message.content[0]?.type === 'text' ? message.content[0].text : '';
      const sources = context.availableContent
        .filter(content => response.toLowerCase().includes(content.title.toLowerCase().substring(0, 20)))
        .map(content => content.title);

      return {
        success: true,
        data: {
          message: response,
          model: message.model,
          tokenCount: {
            prompt: message.usage.input_tokens,
            completion: message.usage.output_tokens,
            total: message.usage.input_tokens + message.usage.output_tokens
          },
          confidence: 0.85,
          sources,
          suggestedActions: this.generateSuggestedActions(response),
          metadata: {
            provider: 'anthropic',
            stopReason: message.stop_reason
          }
        }
      };

    } catch (error) {
      logger.error('Anthropic API error:', error);
      return {
        success: false,
        error: new CustomError('Anthropic API request failed', 'ANTHROPIC_API_ERROR', 500, 'AIService')
      };
    }
  }

  /**
   * Generate fallback response when AI providers are unavailable
   */
  private generateFallbackResponse(context: ChatContext): ServiceResult<AIResponse> {
    const lastMessage = context.conversationHistory[context.conversationHistory.length - 1]?.content || '';
    
    // Simple keyword-based responses
    const keywordResponses = {
      'hallo': 'Hallo! Hoe kan ik je helpen?',
      'dank je': 'Graag gedaan! Is er nog iets anders waar ik je mee kan helpen?',
      'help': 'Ik ben hier om je te helpen! Stel gerust je vraag.',
      'contact': 'Je kunt contact opnemen via de contactpagina of het contactformulier.',
      'prijs': 'Voor prijsinformatie kun je contact met ons opnemen.',
      'wanneer': 'Laat me kijken wat ik voor je kan vinden...',
      'hoe': 'Dat is een goede vraag! Laat me je daarbij helpen.',
      'wat': 'Daar kan ik je meer over vertellen!'
    };

    let response = 'Bedankt voor je vraag! ik probeer je zo goed mogelijk te helpen op basis van de beschikbare informatie.';
    
    // Check for keywords
    for (const [keyword, keywordResponse] of Object.entries(keywordResponses)) {
      if (lastMessage.toLowerCase().includes(keyword)) {
        response = keywordResponse;
        break;
      }
    }

    // Add context if available
    if (context.availableContent.length > 0) {
      const randomContent = context.availableContent[Math.floor(Math.random() * context.availableContent.length)];
      response += `\n\nTrouwens, misschien is dit ook interessant: "${randomContent.title}".`;
    }

    return {
      success: true,
      data: {
        message: response,
        model: 'fallback-v1',
        confidence: 0.3,
        sources: [],
        suggestedActions: ['Stel een andere vraag', 'Neem contact op', 'Bekijk de documentatie'],
        metadata: {
          provider: 'fallback',
          usedKeywordMatching: true
        }
      }
    };
  }

  /**
   * Find relevant content for the user's query
   */
  private async findRelevantContent(chatbotId: string, query: string): Promise<ChatContext['availableContent']> {
    try {
      // Get all available content for the chatbot
      const dataBronnen = await this.prisma.dataBron.findMany({
        where: {
          chatBotId: chatbotId,
          isActief: true
        },
        include: {
          tekstChunks: {
            select: {
              id: true,
              inhoud: true,
              metadata: true
            }
          }
        },
        take: 10 // Limit for performance
      });

      const relevantContent: ChatContext['availableContent'] = [];

      for (const dataBron of dataBronnen) {
        for (const chunk of dataBron.tekstChunks || []) {
          // Simple keyword matching (in production, use vector search)
          const relevanceScore = this.calculateSimpleRelevance(query, chunk.inhoud);
          
          if (relevanceScore > 0.1) {
            relevantContent.push({
              id: chunk.id,
              title: dataBron.naam,
              content: chunk.inhoud.substring(0, 500), // Limit content length
              source: dataBron.url || dataBron.naam,
              relevanceScore
            });
          }
        }
      }

      // Sort by relevance and return top 5
      return relevantContent
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, 5);

    } catch (error) {
      logger.error('Error finding relevant content:', error);
      return [];
    }
  }

  /**
   * Simple relevance calculation (in production, use proper vector embeddings)
   */
  private calculateSimpleRelevance(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const queryWord of queryWords) {
      if (contentWords.some(word => word.includes(queryWord) || queryWord.includes(word))) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  /**
   * Build contextual prompt with available content
   */
  private buildContextualPrompt(content: ChatContext['availableContent'], history: AIMessage[]): string {
    let prompt = 'Je hebt toegang tot de volgende informatie om de gebruiker te helpen:\n\n';
    
    content.forEach((item, index) => {
      prompt += `Bron ${index + 1}: ${item.title}\n${item.content}\n\n`;
    });

    prompt += 'Gebruik deze informatie om nauwkeurige en behulpzame antwoorden te geven. ';
    prompt += 'Als de informatie niet beschikbaar is, zeg dit eerlijk en bied alternatieve hulp aan.';
    
    return prompt;
  }

  /**
   * Get default system prompt for chatbot
   */
  private getDefaultSystemPrompt(chatbotId: string): string {
    return `Je bent een behulpzame AI-assistent voor een chatbot. 
Je taak is om gebruikers te helpen met hun vragen op een vriendelijke en professionele manier.
Geef korte, duidelijke antwoorden en verwijs naar beschikbare informatie wanneer mogelijk.
Spreek de gebruiker aan in het Nederlands, tenzij anders gevraagd.
Als je iets niet weet, zeg dit eerlijk en bied alternatieve hulp aan.`;
  }

  /**
   * Generate suggested actions based on response
   */
  private generateSuggestedActions(response: string): string[] {
    const actions = ['Stel een vervolgvraag', 'Meer informatie', 'Contact opnemen'];
    
    if (response.toLowerCase().includes('contact')) {
      actions.unshift('Bekijk contactgegevens');
    }
    if (response.toLowerCase().includes('prijs')) {
      actions.unshift('Vraag om offerte');
    }
    if (response.toLowerCase().includes('product')) {
      actions.unshift('Bekijk producten');
    }
    
    return actions.slice(0, 3);
  }

  /**
   * Test AI provider connectivity
   */
  async testProviders(): Promise<ServiceResult<{ openai: boolean; anthropic: boolean }>> {
    const results = { openai: false, anthropic: false };

    // Test OpenAI
    if (this.openai) {
      try {
        await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5
        });
        results.openai = true;
      } catch (error) {
        logger.error('OpenAI test failed:', error);
      }
    }

    // Test Anthropic
    if (this.anthropic) {
      try {
        await this.anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'test' }]
        });
        results.anthropic = true;
      } catch (error) {
        logger.error('Anthropic test failed:', error);
      }
    }

    return {
      success: true,
      data: results
    };
  }
}

// Export singleton
export const aiService = new AIService(new PrismaClient());
