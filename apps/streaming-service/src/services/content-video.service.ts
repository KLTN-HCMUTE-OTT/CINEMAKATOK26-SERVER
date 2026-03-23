import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import {
  CreateVideoDto,
  UpdateVideoDto,
} from '@app/common/dtos/content/video.dto';

@Injectable()
export class ContentVideoService {
  constructor(
    @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
  ) {}

  async createVideo(data: CreateVideoDto) {
    return firstValueFrom(
      this.contentClient.send({ cmd: 'content.createVideo' }, data),
    );
  }

  async updateVideo(videoId: string, data: Partial<UpdateVideoDto>) {
    return firstValueFrom(
      this.contentClient.send(
        { cmd: 'content.updateVideo' },
        { id: videoId, data },
      ),
    );
  }
}
