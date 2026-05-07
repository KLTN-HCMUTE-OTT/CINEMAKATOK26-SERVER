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
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';


import { StreamingGatewayService } from './streaming.service';

/**
 * DRM License endpoint.
 *
 * This is the endpoint that Shaka Player calls to obtain decryption keys.
 * It must be separate from the /videos controller because the player
 * sends requests in ClearKey format to a specific license URL.
 */
@ApiTags('DRM')
@ApiBearerAuth()
@Controller('drm')
export class DrmController {
  constructor(private readonly streamingService: StreamingGatewayService) {}

  /**
   * ClearKey License endpoint.
   *
   * Shaka Player sends a license request containing the keyId(s) it needs.
   * This endpoint validates the user's JWT + subscription, then returns
   * the Content Encryption Key(s) in ClearKey JSON Web Key Set (JWKS) format.
   *
   * Rate limited to prevent abuse.
   */
  @Post('license/clearkey')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Issue ClearKey DRM license' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        kids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of Key IDs (base64url or hex) from the manifest',
        },
      },
      required: ['kids'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'ClearKey license issued',
    schema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kty: { type: 'string', example: 'oct' },
              kid: { type: 'string', example: 'base64url-encoded-key-id' },
              k: { type: 'string', example: 'base64url-encoded-key' },
            },
          },
        },
        type: { type: 'string', example: 'temporary' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'No active subscription' })
  async issueClearKeyLicense(
    @Body() body: { kids: string[] },
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;

    // ClearKey spec: player sends kids in base64url format
    // Convert base64url → hex for our backend lookup
    const keyIds = (body.kids || []).map((kid: string) =>
      base64urlToHex(kid),
    );

    const result = await firstValueFrom(
      this.streamingService.issueClearKeyLicense({
        keyIds,
        userId,
      }),
    );

    // Return raw ClearKey JSON (not wrapped in ResponseBuilder)
    // because Shaka Player expects the exact ClearKey format
    return result;
  }
}

/**
 * Convert base64url string to hex string.
 * ClearKey players send Key IDs in base64url; our DB stores hex.
 */
function base64urlToHex(base64url: string): string {
  // If it's already hex (32 chars, valid hex), return as-is
  if (/^[0-9a-f]{32}$/i.test(base64url)) {
    return base64url.toLowerCase();
  }

  // Convert base64url → base64 → buffer → hex
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('hex');
}
