import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../shared/utils/logger.js';

const logger = createLogger('FileProcessingService');
import { ServiceResult } from '../shared/types/index.js';
import { CustomError } from '../shared/utils/errors.js';
import { createReadStream } from 'fs';

export interface FileProcessingOptions {
  extractMetadata?: boolean;
  chunkSize?: number;
  maxFileSize?: number; // in bytes
  allowedTypes?: string[];
}

export interface ProcessedFile {
  filename: string;
  originalName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  extractedText: string;
  metadata: {
    title?: string;
    author?: string;
    createdDate?: Date;
    modifiedDate?: Date;
    pageCount?: number;
    encoding?: string;
  };
  chunks: Array<{
    id: string;
    content: string;
    chunkIndex: number;
    wordCount: number;
  }>;
  processedAt: Date;
}

export interface UploadedFile {
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

class FileProcessingService {
  private prisma: PrismaClient;
  private uploadDir: string;

  constructor(prisma: PrismaClient, uploadDir = './uploads') {
    this.prisma = prisma;
    this.uploadDir = uploadDir;
  }

  async processFile(
    file: UploadedFile,
    chatbotId: string,
    options: FileProcessingOptions = {}
  ): Promise<ServiceResult<ProcessedFile>> {
    try {
      // Validate chatbot exists
      const chatbot = await this.prisma.chatBot.findUnique({
        where: { id: chatbotId },
        select: { id: true, organisatieId: true }
      });

      if (!chatbot) {
        return {
          success: false,
          error: new CustomError('ChatBot not found', 'CHATBOT_NOT_FOUND', 404, 'FileProcessingService')
        };
      }

      // Validate file
      const validation = this.validateFile(file, options);
      if (!validation.success) {
        return validation;
      }

      // Create upload directory if it doesn't exist
      await this.ensureUploadDirectory();

      // Save file to disk
      const savedFile = await this.saveFile(file);

      // Process file based on type
      let processedFile: ProcessedFile;
      
      switch (file.mimetype) {
        case 'application/pdf':
          processedFile = await this.processPDF(savedFile, file, options);
          break;
        case 'text/csv':
        case 'application/csv':
          processedFile = await this.processCSV(savedFile, file, options);
          break;
        case 'text/plain':
        case 'text/txt':
          processedFile = await this.processTXT(savedFile, file, options);
          break;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          processedFile = await this.processDOC(savedFile, file, options);
          break;
        default:
          // Try to process as text
          processedFile = await this.processAsText(savedFile, file, options);
      }

      // Save to database
      await this.saveToDatabase(chatbotId, processedFile);

      return {
        success: true,
        data: processedFile
      };

    } catch (error) {
      logger.error('Error processing file:', error);
      return {
        success: false,
        error: new CustomError('Failed to process file', 'FILE_PROCESS_ERROR', 500, 'FileProcessingService')
      };
    }
  }

  private validateFile(file: UploadedFile, options: FileProcessingOptions): ServiceResult<boolean> {
    const {
      maxFileSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = [
        'application/pdf',
        'text/csv',
        'application/csv',
        'text/plain',
        'text/txt',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ]
    } = options;

    // Check file size
    if (file.size > maxFileSize) {
      return {
        success: false,
        error: new CustomError(
          `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxFileSize / 1024 / 1024)}MB)`,
          'FILE_TOO_LARGE',
          400,
          'FileProcessingService'
        )
      };
    }

    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      return {
        success: false,
        error: new CustomError(
          `File type '${file.mimetype}' is not supported`,
          'UNSUPPORTED_FILE_TYPE',
          400,
          'FileProcessingService'
        )
      };
    }

    return { success: true, data: true };
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  private async saveFile(file: UploadedFile): Promise<string> {
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2)}-${file.filename}`;
    const filePath = path.join(this.uploadDir, filename);
    
    await fs.writeFile(filePath, file.buffer);
    
    return filePath;
  }

  private async processPDF(
    filePath: string,
    file: UploadedFile,
    options: FileProcessingOptions
  ): Promise<ProcessedFile> {
    // Note: In een echte implementatie zou je pdf-parse of een gelijkaardige library gebruiken
    // Voor nu implementeren we een placeholder
    
    try {
      // Placeholder PDF processing - in realiteit zou je pdf-parse gebruiken
      const extractedText = await this.extractPDFText(filePath);
      
      const metadata = {
        title: path.basename(file.filename, '.pdf'),
        createdDate: new Date(),
        modifiedDate: new Date(),
        pageCount: 1 // Placeholder
      };

      const chunks = this.chunkText(extractedText, options.chunkSize || 1000);

      return {
        filename: path.basename(filePath),
        originalName: file.filename,
        filePath,
        fileType: 'PDF',
        fileSize: file.size,
        extractedText,
        metadata,
        chunks,
        processedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  private async processCSV(
    filePath: string,
    file: UploadedFile,
    options: FileProcessingOptions
  ): Promise<ProcessedFile> {
    try {
      const csvContent = await fs.readFile(filePath, 'utf8');
      
      // Parse CSV
      const lines = csvContent.split('\n').filter(line => line.trim());
      const headers = lines[0]?.split(',').map(h => h.trim().replace(/"/g, ''));
      
      // Convert to structured text
      let extractedText = `CSV Data from ${file.filename}\n\n`;
      extractedText += `Headers: ${headers?.join(', ')}\n\n`;
      
      // Add first few rows as examples
      const sampleRows = lines.slice(1, 6);
      sampleRows.forEach((row, index) => {
        const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
        extractedText += `Row ${index + 1}:\n`;
        headers?.forEach((header, i) => {
          extractedText += `  ${header}: ${values[i] || ''}\n`;
        });
        extractedText += '\n';
      });

      if (lines.length > 6) {
        extractedText += `... and ${lines.length - 6} more rows\n`;
      }

      const metadata = {
        title: path.basename(file.filename, '.csv'),
        createdDate: new Date(),
        encoding: 'utf8'
      };

      const chunks = this.chunkText(extractedText, options.chunkSize || 1000);

      return {
        filename: path.basename(filePath),
        originalName: file.filename,
        filePath,
        fileType: 'CSV',
        fileSize: file.size,
        extractedText,
        metadata,
        chunks,
        processedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to process CSV: ${error.message}`);
    }
  }

  private async processTXT(
    filePath: string,
    file: UploadedFile,
    options: FileProcessingOptions
  ): Promise<ProcessedFile> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      const metadata = {
        title: path.basename(file.filename, '.txt'),
        createdDate: new Date(),
        encoding: 'utf8'
      };

      const chunks = this.chunkText(content, options.chunkSize || 1000);

      return {
        filename: path.basename(filePath),
        originalName: file.filename,
        filePath,
        fileType: 'TEXT',
        fileSize: file.size,
        extractedText: content,
        metadata,
        chunks,
        processedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to process TXT: ${error.message}`);
    }
  }

  private async processDOC(
    filePath: string,
    file: UploadedFile,
    options: FileProcessingOptions
  ): Promise<ProcessedFile> {
    // Placeholder voor Word document processing
    // In een echte implementatie zou je mammoth of een gelijkaardige library gebruiken
    
    try {
      // Voor nu behandelen we het als text
      const extractedText = `Document: ${file.filename}\n\n[Word document content would be extracted here]`;
      
      const metadata = {
        title: path.basename(file.filename, '.docx'),
        createdDate: new Date()
      };

      const chunks = this.chunkText(extractedText, options.chunkSize || 1000);

      return {
        filename: path.basename(filePath),
        originalName: file.filename,
        filePath,
        fileType: 'DOCUMENT',
        fileSize: file.size,
        extractedText,
        metadata,
        chunks,
        processedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to process DOC: ${error.message}`);
    }
  }

  private async processAsText(
    filePath: string,
    file: UploadedFile,
    options: FileProcessingOptions
  ): Promise<ProcessedFile> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      const metadata = {
        title: file.filename,
        createdDate: new Date(),
        encoding: 'utf8'
      };

      const chunks = this.chunkText(content, options.chunkSize || 1000);

      return {
        filename: path.basename(filePath),
        originalName: file.filename,
        filePath,
        fileType: 'TEXT',
        fileSize: file.size,
        extractedText: content,
        metadata,
        chunks,
        processedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to process as text: ${error.message}`);
    }
  }

  private async extractPDFText(filePath: string): Promise<string> {
    try {
      const pdf = await import('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdf.default(dataBuffer);
      
      return pdfData.text || '';
    } catch (error) {
      logger.error(`Error extracting PDF text from ${filePath}:`, error);
      // Fallback: return basic info if PDF parsing fails
      return `PDF file: ${path.basename(filePath)}\n\n[PDF content could not be extracted - file may be encrypted or corrupted]`;
    }
  }

  private chunkText(text: string, chunkSize: number): Array<{
    id: string;
    content: string;
    chunkIndex: number;
    wordCount: number;
  }> {
    const words = text.split(/\s+/);
    const chunks = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      chunks.push({
        id: `chunk_${i / chunkSize}`,
        content: chunk,
        chunkIndex: i / chunkSize,
        wordCount: Math.min(chunkSize, words.length - i)
      });
    }
    
    return chunks;
  }

  private async saveToDatabase(chatbotId: string, processedFile: ProcessedFile): Promise<void> {
    try {
      // Create databron record
      const databron = await this.prisma.chatbotDatabron.create({
        data: {
          chatbotId: chatbotId,
          type: processedFile.fileType as any,
          bestandsUrl: processedFile.filePath,
          aangemaaktOp: new Date(),
          bijgewerktOp: new Date()
        }
      });

      // Save chunks as separate text records
      for (const chunk of processedFile.chunks) {
        await this.prisma.chatbotTekst.create({
          data: {
            databronId: databron.id,
            onderwerp: `${processedFile.metadata.title} - Part ${chunk.chunkIndex + 1}`,
            inhoud: chunk.content,
            aangemaaktOp: new Date(),
            bijgewerktOp: new Date()
          }
        });
      }

      logger.info(`Saved ${processedFile.chunks.length} text chunks for file ${processedFile.filename}`);
    } catch (error) {
      logger.error(`Failed to save file to database:`, error);
      throw error;
    }
  }

  async deleteFile(fileId: string, chatbotId: string): Promise<ServiceResult<boolean>> {
    try {
      // Find the databron
      const databron = await this.prisma.chatbotDatabron.findFirst({
        where: {
          id: fileId,
          chatbotId: chatbotId
        },
        include: {
          teksten: true
        }
      });

      if (!databron) {
        return {
          success: false,
          error: new CustomError('File not found', 'FILE_NOT_FOUND', 404, 'FileProcessingService')
        };
      }

      // Delete file from disk
      if (databron.bestandsUrl) {
        try {
          await fs.unlink(databron.bestandsUrl);
        } catch (error) {
          logger.warn(`Failed to delete file from disk: ${databron.bestandsUrl}`);
        }
      }

      // Delete from database
      await this.prisma.chatbotTekst.deleteMany({
        where: { databronId: databron.id }
      });

      await this.prisma.chatbotDatabron.delete({
        where: { id: databron.id }
      });

      return {
        success: true,
        data: true
      };

    } catch (error) {
      logger.error('Error deleting file:', error);
      return {
        success: false,
        error: new CustomError('Failed to delete file', 'FILE_DELETE_ERROR', 500, 'FileProcessingService')
      };
    }
  }

  async getProcessedFiles(chatbotId: string): Promise<ServiceResult<Array<{
    id: string;
    filename: string;
    fileType: string;
    fileSize: number;
    textChunks: number;
    processedAt: Date;
  }>>> {
    try {
      const databronnen = await this.prisma.chatbotDatabron.findMany({
        where: {
          chatbotId: chatbotId,
          type: { in: ['PDF', 'CSV', 'TEXT', 'DOCUMENT'] }
        },
        include: {
          _count: {
            select: { teksten: true }
          }
        },
        orderBy: {
          aangemaaktOp: 'desc'
        }
      });

      const files = databronnen.map(databron => ({
        id: databron.id,
        filename: path.basename(databron.bestandsUrl || ''),
        fileType: databron.type,
        fileSize: 0, // Would need to store this separately
        textChunks: databron._count.teksten,
        processedAt: databron.aangemaaktOp
      }));

      return {
        success: true,
        data: files
      };

    } catch (error) {
      logger.error('Error getting processed files:', error);
      return {
        success: false,
        error: new CustomError('Failed to get processed files', 'FILES_GET_ERROR', 500, 'FileProcessingService')
      };
    }
  }

  async reprocessFile(fileId: string, options: FileProcessingOptions = {}): Promise<ServiceResult<ProcessedFile>> {
    try {
      const databron = await this.prisma.chatbotDatabron.findUnique({
        where: { id: fileId },
        include: { teksten: true }
      });

      if (!databron || !databron.bestandsUrl) {
        return {
          success: false,
          error: new CustomError('File not found', 'FILE_NOT_FOUND', 404, 'FileProcessingService')
        };
      }

      // Check if file still exists on disk
      try {
        await fs.access(databron.bestandsUrl);
      } catch {
        return {
          success: false,
          error: new CustomError('File no longer exists on disk', 'FILE_NOT_ON_DISK', 404, 'FileProcessingService')
        };
      }

      // Remove existing text chunks
      await this.prisma.chatbotTekst.deleteMany({
        where: { databronId: databron.id }
      });

      // Reprocess the file
      const file: UploadedFile = {
        filename: path.basename(databron.bestandsUrl),
        mimetype: this.getMimeTypeFromExtension(databron.bestandsUrl),
        size: (await fs.stat(databron.bestandsUrl)).size,
        buffer: await fs.readFile(databron.bestandsUrl)
      };

      const processedFile = await this.processFile(file, databron.chatbotId, options);

      return processedFile;

    } catch (error) {
      logger.error('Error reprocessing file:', error);
      return {
        success: false,
        error: new CustomError('Failed to reprocess file', 'FILE_REPROCESS_ERROR', 500, 'FileProcessingService')
      };
    }
  }

  private getMimeTypeFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

export default FileProcessingService;
