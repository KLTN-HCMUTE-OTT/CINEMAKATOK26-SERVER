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

export const ERROR_CODE = {
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  INVALID_BODY: 'INVALID_BODY',
  INVALID_TOKEN: 'INVALID_TOKEN',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  BANNED: 'BANNED',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  INVALID_OTP: 'INVALID_OTP',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_REQUEST_LIMIT_EXCEEDED: 'OTP_REQUEST_LIMIT_EXCEEDED',

  FASTAPI_RECOMMENDATION_ERROR: 'FASTAPI_RECOMMENDATION_ERROR',
};

export const operationsMap = new Map<string, Type<ICommand>>();
export const clientsMap = new Map<string, ClientProxy>();
export const sseClients = new Map<string, SseClientConnection[]>();
