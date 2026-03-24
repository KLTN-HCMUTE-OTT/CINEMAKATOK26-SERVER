import { catchRpcError } from '@app/common/exceptions';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class StreamingGatewayService {
  constructor(
    @Inject('STREAMING_SERVICE')
    private readonly streamingClient: ClientProxy,
  ) {}

  uploadVideo(payload: { inputPath: string }) {
    return this.streamingClient
      .send({ cmd: 'streaming.uploadVideo' }, payload)
      .pipe(catchRpcError());
  }

  getFileAccess(s3Key: string) {
    return this.streamingClient
      .send({ cmd: 'streaming.getFileAccess' }, { s3Key })
      .pipe(catchRpcError());
  }
}
