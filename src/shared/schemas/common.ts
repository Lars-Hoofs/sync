// Common response schemas for Fastify
export const ErrorResponseSchema = {
  $id: 'ErrorResponse',
  type: 'object',
  properties: {
    success: { type: 'boolean', const: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'object' }
      },
      required: ['code', 'message']
    },
    timestamp: { type: 'string', format: 'date-time' },
    path: { type: 'string' },
    requestId: { type: 'string' }
  },
  required: ['success', 'error']
};

export const SuccessResponseSchema = {
  $id: 'SuccessResponse',
  type: 'object',
  properties: {
    success: { type: 'boolean', const: true },
    data: { type: 'object' },
    message: { type: 'string' },
    meta: { type: 'object' },
    timestamp: { type: 'string', format: 'date-time' },
    requestId: { type: 'string' }
  },
  required: ['success']
};

export const ValidationErrorResponseSchema = {
  $id: 'ValidationErrorResponse',
  type: 'object',
  properties: {
    success: { type: 'boolean', const: false },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          message: { type: 'string' },
          code: { type: 'string' }
        },
        required: ['field', 'message']
      }
    },
    timestamp: { type: 'string', format: 'date-time' },
    path: { type: 'string' },
    requestId: { type: 'string' }
  },
  required: ['success', 'errors']
};

export const PaginationMetaSchema = {
  $id: 'PaginationMeta',
  type: 'object',
  properties: {
    page: { type: 'number', minimum: 1 },
    limit: { type: 'number', minimum: 1 },
    total: { type: 'number', minimum: 0 },
    totalPages: { type: 'number', minimum: 0 },
    hasNext: { type: 'boolean' },
    hasPrev: { type: 'boolean' }
  },
  required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev']
};

export const PaginatedResponseSchema = {
  $id: 'PaginatedResponse',
  type: 'object',
  properties: {
    success: { type: 'boolean', const: true },
    data: {
      type: 'array',
      items: { type: 'object' }
    },
    meta: { $ref: 'PaginationMeta' },
    timestamp: { type: 'string', format: 'date-time' },
    requestId: { type: 'string' }
  },
  required: ['success', 'data', 'meta']
};

// Export all schemas as an array for easy registration
export const commonSchemas = [
  ErrorResponseSchema,
  SuccessResponseSchema,
  ValidationErrorResponseSchema,
  PaginationMetaSchema,
  PaginatedResponseSchema
];
