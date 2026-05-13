import { firstValueFrom } from 'rxjs';

import { JwtAuthGuard } from '@app/common/guards';
import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  ClearKeyLicenseRequestDto,
  ClearKeyLicenseResponseDto,
} from '@app/common/dtos/streaming/stream.dto';

import { StreamingGatewayService } from './streaming.service';
import { UserSession } from '@app/common/decorators';

@ApiTags('DRM')
@ApiBearerAuth()
@Controller('drm')
export class DrmController {
  constructor(private readonly streamingService: StreamingGatewayService) {}

  /**
   * ClearKey DRM License Endpoint
   *
   * Shaka Player calls this endpoint to obtain
   * content decryption keys.
   */
  @Post('license/clearkey')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Issue ClearKey DRM license',
    description:
      'Validate user entitlement and return ClearKey JWKS response',
  })
  @ApiResponse({
    status: 200,
    description: 'ClearKey license issued successfully',
    type: ClearKeyLicenseResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have active entitlement',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async issueClearKeyLicense(
    @Body() body: ClearKeyLicenseRequestDto,
    @UserSession('id') userId: string,
  ): Promise<ClearKeyLicenseResponseDto> {

    /**
     * Convert incoming base64url Key IDs
     * into hex format for DB lookup.
     */
    const keyIds = (body.kids || []).map((kid) =>
      base64urlToHex(kid),
    );

    const result = await firstValueFrom(
      this.streamingService.issueClearKeyLicense({
        keyIds,
        userId,
        contentId: body.contentId,
      }),
    );

    /**
     * IMPORTANT:
     * Return raw ClearKey JSON response.
     *
     * Do NOT wrap using common response builder
     * because Shaka Player expects exact JWKS format.
     */
    return result as ClearKeyLicenseResponseDto;
  }
}

/**
 * Convert base64url string → hex string
 */
function base64urlToHex(base64url: string): string {
  /**
   * Already hex
   */
  if (/^[0-9a-f]{32}$/i.test(base64url)) {
    return base64url.toLowerCase();
  }

  /**
   * base64url → base64
   */
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  /**
   * Fix missing padding
   */
  const padded =
    base64 + '='.repeat((4 - (base64.length % 4)) % 4);

  return Buffer.from(padded, 'base64').toString('hex');
}