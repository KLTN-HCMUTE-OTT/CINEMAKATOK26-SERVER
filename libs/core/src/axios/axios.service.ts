import * as https from 'https';

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as config from 'config';
import * as crypto from 'crypto';

import { getConfig } from '@app/common/utils/get-config';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AxiosService {
  private axiosInstance: AxiosInstance;
  private readonly logger = new Logger(AxiosService.name);

  constructor() {
    const agent = new https.Agent({
      rejectUnauthorized: false,
      secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    });
    this.axiosInstance = axios.create({
      timeout: getConfig('core.axios.timeout', 3000),
      headers: {
        'Content-Type': 'application/json',
      },
      httpsAgent: agent,
    });
  }
  async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.get(endpoint, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }
  async getCustom<T>(endpoint: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.get(endpoint, config);
      return response;
    } catch (error) {
      return error.response;
    }
  }
  async post<T>(endpoint: string, data: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.post(endpoint, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }
  async postCustom<T>(
    endpoint: string,
    data: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.post(endpoint, data, config);
      return response;
    } catch (error) {
      return error.response ?? error;
    }
  }

  async put<T>(endpoint: string, data: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.put(endpoint, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }
  async putCustom<T>(
    endpoint: string,
    data: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.put(endpoint, data, config);
      return response;
    } catch (error) {
      return error.response;
    }
  }
  async delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.delete(endpoint, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: any): never {
    this.logger.error('Axios error:', error.response?.data || error.message || error);
    throw new BadRequestException(error.response?.data || error.message || 'unknown error');
  }
}
