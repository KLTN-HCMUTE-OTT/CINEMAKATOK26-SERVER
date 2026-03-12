import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';

@Injectable()
export class StreamingService {
  constructor(
    @Inject('STREAMING_SERVICE') private readonly streamingClient: ClientProxy,
  ) {}

  getStreamUrl(userId: string, contentId: string): Observable<any> {
    return this.streamingClient.send(
      { cmd: 'streaming.getUrl' },
      { userId, contentId },
    );
  }
}
