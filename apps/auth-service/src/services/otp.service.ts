import * as crypto from 'crypto';
import { MoreThan, Repository } from 'typeorm';

import { ERROR_CODE } from '@app/common/constants/global.constants';
import { OTP_PURPOSE } from '@app/common/enums/global.enum';
import { OTPHash } from '@app/common/utils/hash';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { EntityUserOtp } from '../entities/otp.entity';

@Injectable()
export class OtpService {
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    @InjectRepository(EntityUserOtp)
    private readonly otpRepository: Repository<EntityUserOtp>,
  ) {}

  /** Generate random 6-digit OTP */
  private generateRandomOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /** Generate and save OTP */
  async generateOtp(email: string, purpose: OTP_PURPOSE): Promise<string> {
    await this.invalidateExistingOtps(email, purpose);

    const otp = this.generateRandomOtp();
    const hashedOtp = OTPHash.hashOtp(otp);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    const otpEntity = this.otpRepository.create({
      email: email.toLowerCase(),
      otp: hashedOtp,
      purpose,
      expiresAt,
      isUsed: false,
      attemptCount: 0,
    });

    await this.otpRepository.save(otpEntity);

    return otp;
  }

  /** Verify OTP */
  async verifyOtp(email: string, otpInput: string, purpose: OTP_PURPOSE): Promise<boolean> {
    const otpEntities = await this.otpRepository.find({
      where: {
        email: email.toLowerCase(),
        purpose,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    let matchedEntity: EntityUserOtp | undefined;
    for (const entity of otpEntities) {
      if (OTPHash.compareOtp(otpInput, entity.otp)) {
        matchedEntity = entity;
        break;
      }
    }

    if (!matchedEntity) {
      await this.incrementAttemptCount(email, purpose);
      throw new BadRequestException({
        code: ERROR_CODE.INVALID_TOKEN,
        message: 'Invalid or expired OTP, please try again.',
      });
    }

    if (matchedEntity.attemptCount >= this.MAX_ATTEMPTS) {
      await this.invalidateOtp(matchedEntity.id);
      throw new BadRequestException({
        code: ERROR_CODE.UNAUTHORIZED,
        message: 'Maximum OTP attempts exceeded. Please request a new OTP.',
      });
    }
    matchedEntity.isUsed = true;
    await this.otpRepository.save(matchedEntity);

    return true;
  }

  /** Check if OTP exists and is valid */
  async isOtpValid(email: string, otpInput: string, purpose: OTP_PURPOSE): Promise<boolean> {
    const otpEntities = await this.otpRepository.find({
      where: {
        email: email.toLowerCase(),
        purpose,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    return otpEntities.some(
      entity => entity.attemptCount < this.MAX_ATTEMPTS && OTPHash.compareOtp(otpInput, entity.otp),
    );
  }

  /** Invalidate existing active OTPs for email + purpose */
  private async invalidateExistingOtps(email: string, purpose: OTP_PURPOSE): Promise<void> {
    await this.otpRepository.update(
      { email: email.toLowerCase(), purpose, isUsed: false },
      { isUsed: true },
    );
  }

  /** Invalidate a specific OTP by ID */
  private async invalidateOtp(otpId: string): Promise<void> {
    await this.otpRepository.update(otpId, { isUsed: true });
  }

  /** Increment attempt count for all active OTPs of this email + purpose */
  private async incrementAttemptCount(email: string, purpose: OTP_PURPOSE): Promise<void> {
    await this.otpRepository
      .createQueryBuilder()
      .update(EntityUserOtp)
      .set({ attemptCount: () => 'attemptCount + 1' })
      .where('email = :email AND purpose = :purpose AND isUsed = false', {
        email: email.toLowerCase(),
        purpose,
      })
      .execute();
  }

  /** Delete all expired OTPs */
  async cleanupExpiredOtps(): Promise<void> {
    await this.otpRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .execute();
  }

  /** Delete expired OTPs for a specific email */
  async cleanupExpiredOtpsByEmail(email: string): Promise<void> {
    await this.otpRepository
      .createQueryBuilder()
      .delete()
      .where('email = :email AND expiresAt < :now', { email: email.toLowerCase(), now: new Date() })
      .execute();
  }
}
