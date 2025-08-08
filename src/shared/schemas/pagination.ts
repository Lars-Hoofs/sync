import { z } from 'zod';
import { PAGINATION } from '../../config/constants.js';

export const paginationQuerySchema = z.object({
  page: z.string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 1)
    .pipe(z.number().min(1))
    .default('1'),
  limit: z.string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : PAGINATION.DEFAULT_LIMIT)
    .pipe(z.number().min(1).max(PAGINATION.MAX_LIMIT))
    .default(PAGINATION.DEFAULT_LIMIT.toString()),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
});

export const paginationResponseSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginationResponse = z.infer<typeof paginationResponseSchema>;
