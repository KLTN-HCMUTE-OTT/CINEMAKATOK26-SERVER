import { AxiosService } from '@app/core/axios/axios.service';
import { Injectable } from '@nestjs/common';

interface SocialUserInfo {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

@Injectable()
export class SocialAuthService {
  constructor(private readonly axiosService: AxiosService) {}

  /**
   * Verify Google access token and get user info
   */
  async verifyGoogleToken(accessToken: string): Promise<SocialUserInfo> {
    try {
      const response = await this.axiosService.get(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`,
      );
      const userData = response as any;

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        picture: userData.picture,
      };
    } catch (error) {
      console.error('Google login error:', error);
      throw new Error('Invalid Google access token');
    }
  }
}
