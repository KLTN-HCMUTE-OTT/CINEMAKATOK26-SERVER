import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import dayjs from 'dayjs';

export interface CreatePaymentUrlParams {
  amount: number;
  orderCode: string;
  returnUrl: string;
  ipAddress: string;
  orderInfo?: string;
  locale?: 'vn' | 'en';
}

@Injectable()
export class VnpayService {

  /**
   * Generates a VNPAY checkout URL for the user to proceed with payment.
   *
   * @param params Contains order details such as amount, order code, and return URL
   * @returns A fully constructed URL including the HMAC-SHA512 secure hash
   */
  createPaymentUrl(params: CreatePaymentUrlParams): string {
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const secretKey = process.env.VNPAY_HASH_SECRET;
    let vnpUrl = process.env.VNPAY_URL;

    if (!tmnCode || !secretKey || !vnpUrl) {
      throw new Error('VNPAY configuration is missing from environment variables');
    }

    const createDate = dayjs().format('YYYYMMDDHHmmss');
    const orderId = params.orderCode;
    const amount = params.amount * 100; // VNPAY requires amount * 100
    const orderInfo = params.orderInfo || `Thanh toan don hang ${orderId}`;

    const vnp_Params: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: params.locale || 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: amount,
      vnp_ReturnUrl: params.returnUrl,
      vnp_IpAddr: params.ipAddress,
      vnp_CreateDate: createDate,
    };

    const signData = this.buildQueryString(vnp_Params);

    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    vnpUrl += '?' + signData + '&vnp_SecureHash=' + signed;

    return vnpUrl;
  }

  /**
   * Verifies the IPN or return URL callback from VNPAY.
   *
   * @param query The query parameters sent by VNPAY
   * @returns true if the secure hash is valid, false otherwise
   */
  verifyCallback(query: Record<string, string>): boolean {
    const secretKey = process.env.VNPAY_HASH_SECRET;
    if (!secretKey) {
      return false;
    }

    const vnp_Params = { ...query };
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const signData = this.buildQueryString(vnp_Params);
    
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Use constant-time comparison to prevent timing attacks
    try {
      const expectedBuffer = Buffer.from(signed);
      const actualBuffer = Buffer.from(secureHash?.toString() || '');
      
      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false; // length mismatch or other buffer error
    }
  }

  /**
   * Checks if the transaction was successful based on the VNPAY response code.
   *
   * @param responseCode VNPAY response code (vnp_ResponseCode)
   * @returns true if code is '00', false otherwise
   */
  isSuccessResponse(responseCode: string): boolean {
    return responseCode === '00';
  }

  /**
   * Maps a VNPAY response code to a human-readable Vietnamese message.
   *
   * @param responseCode VNPAY response code
   * @returns Translated message
   */
  getResponseMessage(responseCode: string): string {
    const responses: Record<string, string> = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
      '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định.',
      '99': 'Lỗi không xác định. Vui lòng liên hệ bộ phận hỗ trợ.',
    };

    return responses[responseCode] || responses['99'];
  }

  /**
   * Builds a URL-encoded query string sorted alphabetically by key.
   * VNPAY requires space characters to be replaced with '+'.
   */
  private buildQueryString(params: Record<string, any>): string {
    const sortedKeys = Object.keys(params).sort((a, b) => a.localeCompare(b));
    const queryParts: string[] = [];
    
    for (const key of sortedKeys) {
      if (params[key] !== '' && params[key] !== undefined && params[key] !== null) {
        // Encode key and value, replacing %20 with + as per VNPAY documentation
        const encodedKey = encodeURIComponent(key);
        const encodedValue = encodeURIComponent(params[key].toString()).replace(/%20/g, '+');
        queryParts.push(`${encodedKey}=${encodedValue}`);
      }
    }
    
    return queryParts.join('&');
  }
}
