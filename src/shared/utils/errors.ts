export class CustomError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly service?: string;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    service?: string,
    details?: any
  ) {
    super(message);
    this.name = 'CustomError';
    this.statusCode = statusCode;
    this.code = code;
    this.service = service;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      service: this.service,
      details: this.details,
      stack: this.stack
    };
  }
}

export class ValidationError extends CustomError {
  constructor(message: string, details?: any, service?: string) {
    super(message, 'VALIDATION_ERROR', 400, service, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string, service?: string) {
    super(message, 'NOT_FOUND', 404, service);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string = 'Unauthorized', service?: string) {
    super(message, 'UNAUTHORIZED', 401, service);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string = 'Forbidden', service?: string) {
    super(message, 'FORBIDDEN', 403, service);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends CustomError {
  constructor(message: string, service?: string) {
    super(message, 'CONFLICT', 409, service);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Rate limit exceeded', service?: string) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, service);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends CustomError {
  constructor(message: string = 'Service unavailable', service?: string) {
    super(message, 'SERVICE_UNAVAILABLE', 503, service);
    this.name = 'ServiceUnavailableError';
  }
}

// Service result type
export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: CustomError;
}

// Helper function to create service results
export const createSuccessResult = <T>(data: T): ServiceResult<T> => ({
  success: true,
  data
});

export const createErrorResult = <T>(error: CustomError): ServiceResult<T> => ({
  success: false,
  error
});
