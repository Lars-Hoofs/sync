import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FileProcessingController } from './file-processing.controller.js';
import { authenticate } from '../../shared/middlewares/auth.js';

export default async function fileProcessingRoutes(fastify: FastifyInstance) {
  const fileProcessingController = new FileProcessingController(fastify.prisma);

  // Middleware voor alle file processing routes
  fastify.addHook('onRequest', authenticate);

  // Upload and process file
  fastify.post('/chatbots/:chatbotId/files/upload', {
    schema: {
      tags: ['FileProcessing'],
      summary: 'Upload and process file',
      description: 'Upload en verwerk een bestand voor chatbot data',
      params: {
        type: 'object',
        required: ['chatbotId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' }
        }
      },
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'object',
            description: 'Het te uploaden bestand (PDF, CSV, TXT, DOC, DOCX)'
          },
          chunkSize: { 
            type: 'integer', 
            minimum: 100, 
            maximum: 2000, 
            default: 500,
            description: 'Grootte van text chunks voor processing'
          },
          extractMetadata: { 
            type: 'boolean', 
            default: true,
            description: 'Of metadata moet worden geëxtraheerd'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                fileId: { type: 'string' },
                filename: { type: 'string' },
                fileType: { type: 'string' },
                fileSize: { type: 'integer' },
                status: { type: 'string' },
                chunksCreated: { type: 'integer' },
                metadata: { type: 'object' },
                processedAt: { type: 'string', format: 'date-time' },
                message: { type: 'string' }
              }
            }
          }
        },
        400: { $ref: 'ErrorResponse' },
        401: { $ref: 'ErrorResponse' },
        403: { $ref: 'ErrorResponse' }
      }
    }
  }, fileProcessingController.uploadFile.bind(fileProcessingController));

  // Get processed files
  fastify.get('/chatbots/:chatbotId/files', {
    schema: {
      tags: ['FileProcessing'],
      summary: 'Get processed files',
      description: 'Haal alle verwerkte bestanden op voor een chatbot',
      params: {
        type: 'object',
        required: ['chatbotId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          fileType: { 
            type: 'string',
            enum: ['PDF', 'CSV', 'TXT', 'DOC', 'DOCX']
          },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      filename: { type: 'string' },
                      fileType: { type: 'string' },
                      fileSize: { type: 'integer' },
                      status: { type: 'string' },
                      chunksCount: { type: 'integer' },
                      uploadedAt: { type: 'string', format: 'date-time' },
                      processedAt: { type: 'string', format: 'date-time' }
                    }
                  }
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    total: { type: 'integer' },
                    pages: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, fileProcessingController.getFiles.bind(fileProcessingController));

  // Get file details
  fastify.get('/chatbots/:chatbotId/files/:fileId', {
    schema: {
      tags: ['FileProcessing'],
      summary: 'Get file details',
      description: 'Haal details op van een specifiek verwerkt bestand',
      params: {
        type: 'object',
        required: ['chatbotId', 'fileId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' },
          fileId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                filename: { type: 'string' },
                fileType: { type: 'string' },
                fileSize: { type: 'integer' },
                status: { type: 'string' },
                metadata: { type: 'object' },
                chunks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      chunkIndex: { type: 'integer' },
                      content: { type: 'string' },
                      wordCount: { type: 'integer' }
                    }
                  }
                },
                uploadedAt: { type: 'string', format: 'date-time' },
                processedAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }, fileProcessingController.getFileDetails.bind(fileProcessingController));

  // Delete file
  fastify.delete('/chatbots/:chatbotId/files/:fileId', {
    schema: {
      tags: ['FileProcessing'],
      summary: 'Delete file',
      description: 'Verwijder een verwerkt bestand en alle gerelateerde data',
      params: {
        type: 'object',
        required: ['chatbotId', 'fileId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' },
          fileId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, fileProcessingController.deleteFile.bind(fileProcessingController));

  // Reprocess file
  fastify.post('/chatbots/:chatbotId/files/:fileId/reprocess', {
    schema: {
      tags: ['FileProcessing'],
      summary: 'Reprocess file',
      description: 'Verwerk een bestand opnieuw met nieuwe instellingen',
      params: {
        type: 'object',
        required: ['chatbotId', 'fileId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' },
          fileId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          chunkSize: { 
            type: 'integer', 
            minimum: 100, 
            maximum: 2000, 
            default: 500 
          },
          extractMetadata: { 
            type: 'boolean', 
            default: true 
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                fileId: { type: 'string' },
                status: { type: 'string' },
                chunksCreated: { type: 'integer' },
                processedAt: { type: 'string', format: 'date-time' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, fileProcessingController.reprocessFile.bind(fileProcessingController));
}
