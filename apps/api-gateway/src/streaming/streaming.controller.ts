import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreamingService } from './streaming.service';
import { UserSession } from '@app/common/decorators';

@ApiTags('Streaming')
@ApiBearerAuth('access-token')
@Controller('stream')
export class StreamingController {
  constructor(private readonly streamingService: StreamingService) {}

  @Get(':contentId/url')
  @ApiOperation({ summary: 'Get streaming URL for content (requires active subscription)' })
  getStreamUrl(
    @UserSession('id') userId: string,
    @Param('contentId') contentId: string,
  ) {
    return this.streamingService.getStreamUrl(userId, contentId);
  }
}
