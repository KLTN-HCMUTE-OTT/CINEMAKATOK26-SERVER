import { plainToInstance } from 'class-transformer';
import type { Response, Request } from 'express';
import { firstValueFrom } from 'rxjs';

import { Public, UserSession } from '@app/common/decorators';
import { IsAdminGuard, JwtAuthGuard } from '@app/common/guards';
import { ResponseBuilder } from '@app/common/utils/dto';
import { VideoDto } from '@app/common/dtos/content/video.dto';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { multerConfig } from './config/upload.config';
import { StreamingGatewayService } from './streaming.service';

import { EntitlementGuard } from './guards/entitlement.guard';

@ApiTags('Streaming')
@ApiBearerAuth()
@Controller('videos')
export class StreamingController {
  constructor(private readonly streamingService: StreamingGatewayService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @ApiOperation({ summary: '[ADMIN] Upload video for HLS encoding' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Video file to upload (MP4, MPEG, MOV, AVI, MKV, WebM)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Video uploaded successfully' })
  @ApiBadRequestResponse({
    description: 'Invalid file or file type not supported',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - User does not have admin privileges',
  })
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return ResponseBuilder.createResponse({
        data: null,
        message: 'No file uploaded. Please provide a video file.',
      });
    }

    const result = (await firstValueFrom(
      this.streamingService.uploadVideo({ inputPath: file.path }),
    )) as any;

    const videoData = result?.video
      ? plainToInstance(VideoDto, result.video, {
          excludeExtraneousValues: true,
        })
      : null;

    return ResponseBuilder.createResponse({
      data: {
        ...result,
        video: videoData,
      },
      statusCode: 201,
      message: result?.queued
        ? 'Video uploaded successfully, encoding in background'
        : 'Video uploaded and processed successfully',
    });
  }

  @Public()
  @Get(':s3Key/access')
  @ApiOperation({
    summary: 'Generate CloudFront signed cookies for video access',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed cookies generated successfully',
  })
  async getFileAccess(
    @Param('s3Key') s3Key: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = (await firstValueFrom(
      this.streamingService.getFileAccess(s3Key),
    )) as any;

    Object.keys(result.cookies || {}).forEach((key) => {
      const cookie = result.cookies[key];
      response.cookie(key, cookie.value, cookie.options ?? {});
    });

    return ResponseBuilder.createResponse({
      data: { fileUrl: result.fileUrl },
      message: 'Signed cookies generated successfully',
    });
  }

  // ─── DRM Endpoints ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, EntitlementGuard)
  @Get(':videoId/manifest')
  @ApiOperation({
    summary: 'Get signed DASH manifest URL for DRM-protected video',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed manifest URL generated',
  })
  async getManifestUrl(
    @UserSession('id') userId: string,
    @Param('videoId') videoId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = (await firstValueFrom(
      this.streamingService.getManifestUrl(videoId, userId),
    )) as any;

    // Also set signed cookies for segment access
    const cookieResult = (await firstValueFrom(
      this.streamingService.getFileAccess(`videos/${videoId}/dash/manifest.mpd`),
    )) as any;

    Object.keys(cookieResult.cookies || {}).forEach((key) => {
      const cookie = cookieResult.cookies[key];
      response.cookie(key, cookie.value, cookie.options ?? {});
    });

    return ResponseBuilder.createResponse({
      data: result,
      message: 'Manifest URL generated successfully',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':videoId/drm-info')
  @ApiOperation({
    summary: 'Get DRM key info (keyId) for a video',
  })
  @ApiResponse({
    status: 200,
    description: 'DRM key info returned',
  })
  async getDrmKeyInfo(@Param('videoId') videoId: string) {
    const result = (await firstValueFrom(
      this.streamingService.getDrmKeyInfo(videoId),
    )) as any;

    return ResponseBuilder.createResponse({
      data: result,
      message: result
        ? 'DRM key info retrieved successfully'
        : 'No DRM key found for this video',
    });
  }
}
