import * as config from 'config';

export const getConfig = <T>(configPath: string, defaultValue: T) => {
  return config.has(configPath) ? (config.get(configPath) as T) : defaultValue;
};
