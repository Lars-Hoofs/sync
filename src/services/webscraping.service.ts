import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { createLogger } from '../shared/utils/logger.js';

const logger = createLogger('WebScrapingService');
import { ServiceResult } from '../shared/types/index.js';
import { CustomError } from '../shared/utils/errors.js';
import { webSocketService } from './websocket.service';

export interface ScrapingOptions {
  maxDepth?: number;
  maxPages?: number;
  includePaths?: string[];
  excludePaths?: string[];
  followExternalLinks?: boolean;
  respectRobotsTxt?: boolean;
  userAgent?: string;
  delay?: number;
  timeout?: number;
}

export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  metadata?: {
    description?: string;
    keywords?: string[];
    author?: string;
    publishDate?: Date;
  };
  links: string[];
  images: string[];
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  lastScraped: Date;
  statusCode: number;
  contentType: string;
  wordCount: number;
}

export interface SitemapUrl {
  url: string;
  lastModified?: Date;
  changeFreq?: string;
  priority?: number;
}

export interface CrawlResult {
  crawlId: string;
  startUrl: string;
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  startTime: Date;
  endTime?: Date;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  pages: ScrapedPage[];
  errors: Array<{
    url: string;
    error: string;
    statusCode?: number;
  }>;
}

class WebScrapingService {
  private prisma: PrismaClient;
  private activeCrawls = new Map<string, boolean>();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async startWebsiteCrawl(
    chatbotId: string,
    startUrl: string,
    options: ScrapingOptions = {}
  ): Promise<ServiceResult<string>> {
    try {
      // Valideer URL
      try {
        new URL(startUrl);
      } catch {
        return {
          success: false,
          error: new CustomError('Invalid URL provided', 'INVALID_URL', 400, 'WebScrapingService')
        };
      }

      // Controleer of chatbot bestaat
      const chatbot = await this.prisma.chatBot.findUnique({
        where: { id: chatbotId },
        select: { id: true, organisatieId: true }
      });

      if (!chatbot) {
        return {
          success: false,
          error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'WebScrapingService')
        };
      }

      // Maak crawl record aan
      const crawl = await this.prisma.websiteCrawl.create({
        data: {
          chatbotId: chatbotId,
          startUrl: startUrl,
          status: 'IN_WACHT',
          diepte: options.maxDepth || 3,
          paginaAantal: options.maxPages
        }
      });

      // Start crawling proces asynchroon
      this.performCrawl(crawl.id, startUrl, options).catch(error => {
        logger.error(`Crawl ${crawl.id} failed:`, error);
      });

      return {
        success: true,
        data: crawl.id
      };
    } catch (error) {
      logger.error('Error starting website crawl:', error);
      return {
        success: false,
        error: new CustomError('Failed to start website crawl', 'CRAWL_START_ERROR', 500, 'WebScrapingService')
      };
    }
  }

  private async performCrawl(
    crawlId: string,
    startUrl: string,
    options: ScrapingOptions
  ): Promise<void> {
    try {
      this.activeCrawls.set(crawlId, true);

      // Update status naar BEZIG
      await this.prisma.websiteCrawl.update({
        where: { id: crawlId },
        data: { status: 'BEZIG' }
      });

      // Send initial progress update
      webSocketService.emit('crawl:progress', crawlId, {
        status: 'started',
        totalPages: 0,
        completedPages: 0,
        failedPages: 0,
        percentage: 0
      });

      const result: CrawlResult = {
        crawlId,
        startUrl,
        totalPages: 0,
        successfulPages: 0,
        failedPages: 0,
        startTime: new Date(),
        status: 'IN_PROGRESS',
        pages: [],
        errors: []
      };

      // Haal sitemap op indien beschikbaar
      let urlsToVisit = [startUrl];
      const sitemapUrls = await this.getSitemapUrls(startUrl);
      if (sitemapUrls.length > 0) {
        urlsToVisit = [...urlsToVisit, ...sitemapUrls.map(u => u.url)];
      }

      // Voer crawling uit
      await this.crawlPages(urlsToVisit, options, result);

      // Update database met resultaten
      await this.saveCrawlResults(crawlId, result);

      result.endTime = new Date();
      result.status = 'COMPLETED';

      // Update crawl status
      await this.prisma.websiteCrawl.update({
        where: { id: crawlId },
        data: { 
          status: 'KLAAR',
          paginaAantal: result.successfulPages
        }
      });

      logger.info(`Crawl ${crawlId} completed: ${result.successfulPages} pages scraped`);

      // Send completion event
      webSocketService.emit('crawl:completed', crawlId, {
        status: 'completed',
        totalPages: result.totalPages,
        completedPages: result.successfulPages,
        failedPages: result.failedPages,
        percentage: 100,
        duration: (result.endTime.getTime() - result.startTime.getTime()) / 1000,
        errors: result.errors
      });

    } catch (error) {
      logger.error(`Crawl ${crawlId} failed:`, error);
      
      await this.prisma.websiteCrawl.update({
        where: { id: crawlId },
        data: { status: 'MISLUKT' }
      });

      // Send error event
      webSocketService.emit('crawl:error', crawlId, {
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      this.activeCrawls.delete(crawlId);
    }
  }

  private async crawlPages(
    urls: string[],
    options: ScrapingOptions,
    result: CrawlResult
  ): Promise<void> {
    const {
      maxDepth = 3,
      maxPages = 50,
      delay = 1000,
      timeout = 10000,
      userAgent = 'Sync ChatBot Scraper 1.0'
    } = options;

    const visited = new Set<string>();
    const urlsToVisit = [...urls];
    let depth = 0;

    while (urlsToVisit.length > 0 && depth < maxDepth && result.successfulPages < maxPages) {
      const currentLevelUrls = urlsToVisit.splice(0);
      const nextLevelUrls: string[] = [];

      for (const url of currentLevelUrls) {
        if (visited.has(url) || result.successfulPages >= maxPages) continue;

        if (!this.activeCrawls.get(result.crawlId)) {
          break; // Crawl was cancelled
        }

        visited.add(url);
        result.totalPages++;

        try {
          const scrapedPage = await this.scrapePage(url, {
            timeout,
            userAgent
          });

          result.pages.push(scrapedPage);
          result.successfulPages++;

          // Send progress update
          const percentage = Math.round((result.successfulPages / maxPages) * 100);
          webSocketService.emit('crawl:progress', result.crawlId, {
            status: 'running',
            totalPages: result.totalPages,
            completedPages: result.successfulPages,
            failedPages: result.failedPages,
            percentage,
            currentUrl: url,
            currentDepth: depth
          });

          // Extract links voor volgende level
          if (depth < maxDepth - 1) {
            const relevantLinks = this.filterLinks(scrapedPage.links, url, options);
            nextLevelUrls.push(...relevantLinks);
          }

          // Respect delay
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

        } catch (error) {
          result.failedPages++;
          result.errors.push({
            url,
            error: error.message,
            statusCode: error.status
          });
          logger.warn(`Failed to scrape ${url}:`, error.message);
        }
      }

      urlsToVisit.push(...nextLevelUrls);
      depth++;
    }
  }

  private async scrapePage(
    url: string,
    options: { timeout: number; userAgent: string }
  ): Promise<ScrapedPage> {
    try {
      const response = await axios.get(url, {
        timeout: options.timeout,
        headers: {
          'User-Agent': options.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'nl,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache'
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });

      const $ = cheerio.load(response.data);
      const baseUrl = new URL(url);

      // Extract content
      const title = $('title').text().trim() || '';
      
      // Remove scripts, styles, nav, footer, ads
      $('script, style, nav, footer, .ads, .advertisement, .sidebar, .menu').remove();
      
      const content = $('main, article, .content, .post, .entry, body')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      // Extract metadata
      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || '';
      
      const keywords = $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()) || [];
      const author = $('meta[name="author"]').attr('content') || '';
      
      // Extract links
      const links: string[] = [];
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, baseUrl).href;
            links.push(absoluteUrl);
          } catch {
            // Ignore invalid URLs
          }
        }
      });

      // Extract images
      const images: string[] = [];
      $('img[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
          try {
            const absoluteUrl = new URL(src, baseUrl).href;
            images.push(absoluteUrl);
          } catch {
            // Ignore invalid URLs
          }
        }
      });

      // Extract headings
      const headings = {
        h1: $('h1').map((_, el) => $(el).text().trim()).get(),
        h2: $('h2').map((_, el) => $(el).text().trim()).get(),
        h3: $('h3').map((_, el) => $(el).text().trim()).get()
      };

      return {
        url,
        title,
        content,
        metadata: {
          description,
          keywords,
          author
        },
        links: [...new Set(links)], // Remove duplicates
        images: [...new Set(images)],
        headings,
        lastScraped: new Date(),
        statusCode: response.status,
        contentType: response.headers['content-type'] || 'text/html',
        wordCount: content.split(/\s+/).length
      };

    } catch (error) {
      throw new Error(`Failed to scrape ${url}: ${error.message}`);
    }
  }

  private async getSitemapUrls(baseUrl: string): Promise<SitemapUrl[]> {
    try {
      const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;
      const response = await axios.get(sitemapUrl, { timeout: 10000 });
      
      const $ = cheerio.load(response.data, { xmlMode: true });
      const urls: SitemapUrl[] = [];

      $('url').each((_, el) => {
        const loc = $(el).find('loc').text();
        const lastmod = $(el).find('lastmod').text();
        const changefreq = $(el).find('changefreq').text();
        const priority = $(el).find('priority').text();

        if (loc) {
          urls.push({
            url: loc,
            lastModified: lastmod ? new Date(lastmod) : undefined,
            changeFreq: changefreq || undefined,
            priority: priority ? parseFloat(priority) : undefined
          });
        }
      });

      logger.info(`Found ${urls.length} URLs in sitemap for ${baseUrl}`);
      return urls;

    } catch (error) {
      logger.debug(`No sitemap found for ${baseUrl}`);
      return [];
    }
  }

  private filterLinks(links: string[], baseUrl: string, options: ScrapingOptions): string[] {
    const base = new URL(baseUrl);
    const filtered = links.filter(link => {
      try {
        const url = new URL(link);
        
        // Only same domain unless external links allowed
        if (!options.followExternalLinks && url.hostname !== base.hostname) {
          return false;
        }

        // Filter out non-HTML content
        if (url.pathname.match(/\.(pdf|jpg|jpeg|png|gif|css|js|ico|svg|woff|ttf)$/i)) {
          return false;
        }

        // Include/exclude paths
        if (options.includePaths && options.includePaths.length > 0) {
          return options.includePaths.some(path => url.pathname.includes(path));
        }

        if (options.excludePaths && options.excludePaths.length > 0) {
          return !options.excludePaths.some(path => url.pathname.includes(path));
        }

        return true;
      } catch {
        return false;
      }
    });

    return [...new Set(filtered)]; // Remove duplicates
  }

  private async saveCrawlResults(crawlId: string, result: CrawlResult): Promise<void> {
    try {
      const crawl = await this.prisma.websiteCrawl.findUnique({
        where: { id: crawlId },
        include: { chatbot: true }
      });

      if (!crawl) return;

      // Save scraped content as chatbot data
      for (const page of result.pages) {
        if (page.content.length > 100) { // Only save pages with substantial content
          
          // Create databron record
          const databron = await this.prisma.chatbotDatabron.create({
            data: {
              chatbotId: crawl.chatbotId,
              type: 'WEBSITE',
              websiteUrl: page.url,
              aangemaaktOp: new Date(),
              bijgewerktOp: new Date()
            }
          });

          // Save the text content
          await this.prisma.chatbotTekst.create({
            data: {
              databronId: databron.id,
              onderwerp: page.title || new URL(page.url).pathname,
              inhoud: page.content,
              aangemaaktOp: new Date(),
              bijgewerktOp: new Date()
            }
          });
        }
      }

      logger.info(`Saved ${result.pages.length} pages for crawl ${crawlId}`);
    } catch (error) {
      logger.error(`Failed to save crawl results for ${crawlId}:`, error);
    }
  }

  async getCrawlStatus(crawlId: string): Promise<ServiceResult<any>> {
    try {
      const crawl = await this.prisma.websiteCrawl.findUnique({
        where: { id: crawlId },
        include: {
          chatbot: {
            select: { botNaam: true }
          }
        }
      });

      if (!crawl) {
        return {
          success: false,
          error: new CustomError('Crawl not found', 'CRAWL_NOT_FOUND', 404, 'WebScrapingService')
        };
      }

      return {
        success: true,
        data: {
          id: crawl.id,
          status: crawl.status,
          startUrl: crawl.startUrl,
          depth: crawl.diepte,
          pageCount: crawl.paginaAantal,
          createdAt: crawl.aangemaaktOp,
          chatbot: crawl.chatbot.botNaam,
          isActive: this.activeCrawls.has(crawlId)
        }
      };
    } catch (error) {
      logger.error('Error getting crawl status:', error);
      return {
        success: false,
        error: new CustomError('Failed to get crawl status', 'CRAWL_STATUS_ERROR', 500, 'WebScrapingService')
      };
    }
  }

  async cancelCrawl(crawlId: string): Promise<ServiceResult<boolean>> {
    try {
      // Mark crawl as inactive
      this.activeCrawls.set(crawlId, false);

      // Update database
      await this.prisma.websiteCrawl.update({
        where: { id: crawlId },
        data: { status: 'MISLUKT' }
      });

      return {
        success: true,
        data: true
      };
    } catch (error) {
      logger.error('Error cancelling crawl:', error);
      return {
        success: false,
        error: new CustomError('Failed to cancel crawl', 'CRAWL_CANCEL_ERROR', 500, 'WebScrapingService')
      };
    }
  }

  async scrapeIndividualPage(url: string, chatbotId: string): Promise<ServiceResult<ScrapedPage>> {
    try {
      // Verify chatbot exists
      const chatbot = await this.prisma.chatBot.findUnique({
        where: { id: chatbotId },
        select: { id: true }
      });

      if (!chatbot) {
        return {
          success: false,
          error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'WebScrapingService')
        };
      }

      const scrapedPage = await this.scrapePage(url, {
        timeout: 10000,
        userAgent: 'Sync ChatBot Scraper 1.0'
      });

      // Save to database
      const databron = await this.prisma.chatbotDatabron.create({
        data: {
          chatbotId: chatbotId,
          type: 'WEBSITE',
          websiteUrl: url,
          aangemaaktOp: new Date(),
          bijgewerktOp: new Date()
        }
      });

      await this.prisma.chatbotTekst.create({
        data: {
          databronId: databron.id,
          onderwerp: scrapedPage.title || new URL(url).pathname,
          inhoud: scrapedPage.content,
          aangemaaktOp: new Date(),
          bijgewerktOp: new Date()
        }
      });

      return {
        success: true,
        data: scrapedPage
      };

    } catch (error) {
      logger.error('Error scraping individual page:', error);
      return {
        success: false,
        error: new CustomError('Failed to scrape page', 'PAGE_SCRAPE_ERROR', 500, 'WebScrapingService')
      };
    }
  }

  async getAvailableContent(chatbotId: string): Promise<ServiceResult<Array<{ id: string; title: string; url: string; wordCount: number }>>> {
    try {
      const databronnen = await this.prisma.chatbotDatabron.findMany({
        where: {
          chatbotId: chatbotId,
          type: 'WEBSITE'
        },
        include: {
          teksten: {
            select: {
              id: true,
              onderwerp: true,
              inhoud: true
            }
          }
        }
      });

      const content = databronnen.flatMap(databron =>
        databron.teksten.map(tekst => ({
          id: tekst.id,
          title: tekst.onderwerp,
          url: databron.websiteUrl || '',
          wordCount: tekst.inhoud.split(/\s+/).length
        }))
      );

      return {
        success: true,
        data: content
      };
    } catch (error) {
      logger.error('Error getting available content:', error);
      return {
        success: false,
        error: new CustomError('Failed to get available content', 'CONTENT_GET_ERROR', 500, 'WebScrapingService')
      };
    }
  }
}

export default WebScrapingService;
