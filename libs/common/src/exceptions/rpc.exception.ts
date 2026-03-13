import { catchError, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

/**
 * RxJS Operator that catches raw TCP Microservice errors from ClientProxy requests
 * and maps them into standard RpcExceptions so the Gateway
 * can process them using `instanceof RpcException`.
 */
export const catchRpcError = () =>
  catchError((error: string | object) => {
    // Pass the raw RPC error (which is now just {code, message} from the Domain filter)
    // forward but firmly wrapped in an RpcException instance so firstValueFrom doesn't lose it.
    return throwError(() => new RpcException(error));
  });
