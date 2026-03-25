import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { WatchProgressService } from '../services/watch-progress.service';

@Controller()
export class WatchProgressController {
  constructor(private readonly watchProgressService: WatchProgressService) {}

  @MessagePattern({ cmd: 'activity.watch-progress.upsert' })
  upsertWatchProgress(
    @Payload()
    payload: {
      userId: string;
      videoId: string;
      watchedDuration: number;
    },
  ) {
    return this.watchProgressService.upsertWatchProgress(payload);
  }

  @MessagePattern({ cmd: 'activity.watch-progress.update' })
  updateWatchProgress(
    @Payload()
    payload: {
      userId: string;
      videoId: string;
      watchedDuration?: number;
      isCompleted?: boolean;
    },
  ) {
    return this.watchProgressService.updateWatchProgress(payload);
  }

  @MessagePattern({ cmd: 'activity.watch-progress.get-one' })
  getWatchProgress(@Payload() payload: { userId: string; videoId: string }) {
    return this.watchProgressService.getWatchProgress(payload);
  }

  @MessagePattern({ cmd: 'activity.watch-progress.resume' })
  getResumeData(@Payload() payload: { userId: string; videoId: string }) {
    return this.watchProgressService.getResumeData(payload);
  }

  @MessagePattern({ cmd: 'activity.watch-progress.get-all' })
  getWatchProgressByUser(
    @Payload() payload: { userId: string; query: Record<string, any> },
  ) {
    return this.watchProgressService.getWatchProgressByUser(payload);
  }

  @MessagePattern({ cmd: 'activity.watch-progress.history' })
  getWatchHistory(
    @Payload() payload: { userId: string; query: Record<string, any> },
  ) {
    return this.watchProgressService.getWatchHistory(payload);
  }

  @MessagePattern({ cmd: 'activity.watch-progress.recent' })
  getRecentlyWatched(@Payload() payload: { userId: string; limit?: number }) {
    return this.watchProgressService.getRecentlyWatched(payload);
  }

  @MessagePattern({ cmd: 'activity.watch-progress.complete' })
  markAsCompleted(@Payload() payload: { userId: string; videoId: string }) {
    return this.watchProgressService.markAsCompleted(payload);
  }

  @MessagePattern({ cmd: 'activity.watch-progress.delete' })
  deleteWatchProgress(@Payload() payload: { userId: string; videoId: string }) {
    return this.watchProgressService.deleteWatchProgress(payload);
  }
}
