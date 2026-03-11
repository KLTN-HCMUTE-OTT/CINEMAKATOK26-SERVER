/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggingCacheInterceptor extends CacheInterceptor {
  private readonly logger = new Logger(LoggingCacheInterceptor.name);
  async intercept(context: ExecutionContext, next: any): Promise<any> {
    const request = context.switchToHttp().getRequest();
    this.logger.debug(`Handling request for ${request.url}`);
    const cachedResponse = await super.intercept(context, next);
    if (cachedResponse) {
      this.logger.debug(`Cache hit for ${request.url}`);
    } else {
      this.logger.debug(`Cache miss for ${request.url}`);
    }
    return super.intercept(context, next);
  }
}
