import { SetMetadata } from '@nestjs/common';
import { Type } from '@nestjs/common/interfaces';
import { ICommand } from '@nestjs/cqrs';
import { ClientProxy } from '@nestjs/microservices';

import { SseClientConnection } from '../types';

export const ADMIN_META_SKIP_AUTH = {
  SKIP_AUTH: 'skip_auth',
  UNPROTECTED: 'unprotected',
};

export const SkipAuth = () => SetMetadata(ADMIN_META_SKIP_AUTH.SKIP_AUTH, true);
export const Unprotected = () =>
  SetMetadata(ADMIN_META_SKIP_AUTH.UNPROTECTED, true);

/**
 * Centralised error code catalog shared by all microservices.
 * Add new codes here — never hard-code strings in services.
 */
export const ERROR_CODE = {
  // Email
  EMAIL_SENDING_FAILED: 'EMAIL_SENDING_FAILED',
  
  // General
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  INVALID_BODY: 'INVALID_BODY',
  UNAUTHORIZED: 'UNAUTHORIZED',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  BANNED: 'BANNED',
  PASSWORD_NOT_MATCH: 'PASSWORD_NOT_MATCH',

  // Auth / Token
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SOCIAL_LOGIN_FAILED: 'SOCIAL_LOGIN_FAILED',

  // OTP
  INVALID_OTP: 'INVALID_OTP',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_REQUEST_LIMIT_EXCEEDED: 'OTP_REQUEST_LIMIT_EXCEEDED',

  // User
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  USER_BANNED: 'USER_BANNED',
  USER_NOT_ACTIVE: 'USER_NOT_ACTIVE',

  // Content
  CONTENT_NOT_AVAILABLE: 'CONTENT_NOT_AVAILABLE',
  CONTENT_NOT_FOUND: 'CONTENT_NOT_FOUND',
  VIDEO_PROCESSING_FAILED: 'VIDEO_PROCESSING_FAILED',

  // Payment
  PAYMENT_DECLINED: 'PAYMENT_DECLINED',
  PAYMENT_ALREADY_PROCESSED: 'PAYMENT_ALREADY_PROCESSED',

  // Integration
  FASTAPI_RECOMMENDATION_ERROR: 'FASTAPI_RECOMMENDATION_ERROR',

  // User Activity
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND',
  CREATE_REVIEW_FAILED: 'CREATE_REVIEW_FAILED',
  UPDATE_REVIEW_FAILED: 'UPDATE_REVIEW_FAILED',
  DELETE_REVIEW_FAILED: 'DELETE_REVIEW_FAILED',
  GET_REVIEWS_FAILED: 'GET_REVIEWS_FAILED',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export const operationsMap = new Map<string, Type<ICommand>>();
export const clientsMap = new Map<string, ClientProxy>();
export const sseClients = new Map<string, SseClientConnection[]>();
