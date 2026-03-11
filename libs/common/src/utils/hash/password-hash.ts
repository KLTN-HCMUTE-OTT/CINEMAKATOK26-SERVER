import * as bcrypt from 'bcryptjs';

export class PasswordHash {
  static hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
  }
  static comparePassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
  }
}
