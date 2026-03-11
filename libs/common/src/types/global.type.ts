import { SSE_EVENT_ENUM } from '../enums';

export type ErrorResponse = {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
  code: string;
};

export type PaginationMeta = {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
};

export type SseClientConnection = {
  visitedId: string;
  sendEvent: (message: string, type: SSE_EVENT_ENUM) => void;
};

export type SseClients = {
  [userId: string]: SseClientConnection[];
};
