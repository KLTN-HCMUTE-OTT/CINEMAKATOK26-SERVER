import { HttpStatus } from '@nestjs/common';
import { ERROR_CODE } from '../constants/global.constants';

/**
 * Base class for all domain-specific errors.
 * Transport-agnostic — never imports RpcException directly.
 *
 * @param retryable   Whether the caller can safely retry the operation.
 * @param httpStatus  The HTTP status code the gateway should return.
 */
export abstract class DomainError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(
    message: string,
    code: string,
    httpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── User ────────────────────────────────────────────────────────────────────

export class UserNotFoundError extends DomainError {
  constructor(message = 'User not found.') {
    super(message, ERROR_CODE.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
  }
}

export class EmailAlreadyExistsError extends DomainError {
  constructor(message = 'Email already exists.') {
    super(message, ERROR_CODE.EMAIL_ALREADY_EXISTS, HttpStatus.CONFLICT);
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor(message = 'Invalid credentials provided.') {
    super(
      message,
      ERROR_CODE.INVALID_CREDENTIALS,

      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class UserBannedError extends DomainError {
  constructor(message = 'User is currently banned.') {
    super(message, ERROR_CODE.USER_BANNED, HttpStatus.FORBIDDEN);
  }
}

// ─── Auth / Token ─────────────────────────────────────────────────────────────

export class InvalidTokenError extends DomainError {
  constructor(message = 'Token is invalid or has expired.') {
    super(message, ERROR_CODE.INVALID_TOKEN, HttpStatus.UNAUTHORIZED);
  }
}

// ─── OTP ──────────────────────────────────────────────────────────────────────

export class InvalidOtpError extends DomainError {
  constructor(message = 'Invalid or expired OTP, please try again.') {
    super(message, ERROR_CODE.INVALID_OTP, HttpStatus.BAD_REQUEST);
  }
}

export class OtpRateLimitExceededError extends DomainError {
  constructor(
    message = 'Maximum OTP attempts exceeded. Please request a new OTP.',
  ) {
    super(
      message,
      ERROR_CODE.OTP_REQUEST_LIMIT_EXCEEDED,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

// ─── Content ─────────────────────────────────────────────────────────────────

export class ContentNotAvailableError extends DomainError {
  constructor(message = 'Content is not available.') {
    super(message, ERROR_CODE.CONTENT_NOT_AVAILABLE, HttpStatus.FORBIDDEN);
  }
}

export class ContentNotFoundError extends DomainError {
  constructor(message = 'Content not found.') {
    super(message, ERROR_CODE.CONTENT_NOT_FOUND, HttpStatus.NOT_FOUND);
  }
}

export class VideoProcessingFailedError extends DomainError {
  /** retryable=true because video processing failures are often transient */
  constructor(message = 'Video processing failed, please try again later.') {
    super(
      message,
      ERROR_CODE.VIDEO_PROCESSING_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export class PaymentDeclinedError extends DomainError {
  constructor(message = 'Payment was declined.') {
    super(message, ERROR_CODE.PAYMENT_DECLINED, HttpStatus.PAYMENT_REQUIRED);
  }
}
