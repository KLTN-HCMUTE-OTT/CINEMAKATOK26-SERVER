import * as bcrypt from 'bcryptjs';

export class OTPHash {
  private static readonly SALT_ROUNDS = 10;

  static hashOtp(otp: string): string {
    return bcrypt.hashSync(otp, this.SALT_ROUNDS);
  }

  static compareOtp(otp: string, hash: string): boolean {
    return bcrypt.compareSync(otp, hash);
  }
}
