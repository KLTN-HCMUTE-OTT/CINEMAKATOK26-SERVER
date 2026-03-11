import { MicroserviceOptions } from '@nestjs/microservices';

export type GatewayConfig = {
  services: GatewayServiceConfig;
};

export type GatewayServiceConfig = Record<string, MicroserviceOptions>;

export type KafkaConfig = {
  brokers: string[];
  clientId: string;
  groupId: string;
};
