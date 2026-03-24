import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { StreamingService } from './services';

@Controller()
export class StreamingController {
  constructor(private readonly streamingService: StreamingService) {}

  @MessagePattern({ cmd: 'streaming.uploadVideo' })
  uploadVideo(@Payload() payload: { inputPath: string }) {
    return this.streamingService.uploadVideo(payload);
  }

  @MessagePattern({ cmd: 'streaming.getFileAccess' })
  getFileAccess(@Payload() payload: { s3Key: string }) {
    return this.streamingService.getFileAccess(payload.s3Key);
  }
}
