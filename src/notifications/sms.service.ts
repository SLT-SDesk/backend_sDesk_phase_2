import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as querystring from 'querystring';

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Normalizes destination mobile number to standard SMSC format (e.g. 94700000000).
   * @param rawNumber The input mobile number (e.g. +94700000000, 0700000000, 94700000000)
   */
  normalizeMobileNumber(rawNumber: string): string | null {
    if (!rawNumber || typeof rawNumber !== 'string') {
      return null;
    }

    // Remove all whitespace, dashes, brackets
    let cleaned = rawNumber.trim().replace(/[\s\-\(\)]/g, '');

    // Remove leading '+'
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    // Remove leading '00' international prefix if present (e.g. 0094700000000 -> 94700000000)
    if (cleaned.startsWith('0094')) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      // Convert local 10-digit format (e.g. 0700000000) to 94700000000
      cleaned = '94' + cleaned.substring(1);
    }

    // Validate that only digits remain and length is valid (e.g. 9 to 15 digits)
    if (!/^\d{9,15}$/.exec(cleaned)) {
      this.logger.warn(`[SMS] Invalid mobile number format: ${rawNumber}`);
      return null;
    }

    return cleaned;
  }

  /**
   * Sends an SMS using the SLT SMSC HTTP API.
   * @param destination The recipient mobile number
   * @param message The SMS body message
   */
  async sendSms(destination: string, message: string): Promise<SmsSendResult> {
    const smscUrl =
      this.configService.get<string>('SMSC_URL') ||
      'https://smsc.slt.lk:8093/api/sms';
    const username = this.configService.get<string>('SMSC_USERNAME');
    const password = this.configService.get<string>('SMSC_PASSWORD');
    const sourceAddress = this.configService.get<string>('SMSC_SOURCE_ADDRESS');

    if (!username || !password || !sourceAddress) {
      const missingConfigErr = 'SMSC credentials/source address not fully configured in environment variables.';
      this.logger.warn(`[SMS] ${missingConfigErr}`);
      return { success: false, error: missingConfigErr };
    }

    const normalizedDst = this.normalizeMobileNumber(destination);
    if (!normalizedDst) {
      const invalidNumErr = `Invalid destination mobile number: ${destination}`;
      this.logger.warn(`[SMS] ${invalidNumErr}`);
      return { success: false, error: invalidNumErr };
    }

    if (!message || message.trim().length === 0) {
      const invalidMsgErr = 'SMS message body cannot be empty.';
      this.logger.warn(`[SMS] ${invalidMsgErr}`);
      return { success: false, error: invalidMsgErr };
    }

    // Mask destination for safe logging (e.g., 9470***0000)
    const maskedDst =
      normalizedDst.length > 5
        ? `${normalizedDst.substring(0, 4)}***${normalizedDst.substring(normalizedDst.length - 4)}`
        : normalizedDst;

    this.logger.log(`[SMS] Incident SMS notification started for recipient ${maskedDst}`);

    try {
      const payload = querystring.stringify({
        user: username,
        password: password,
        src: sourceAddress,
        dst: normalizedDst,
        msg: message,
        dr: '0',
        type: '0',
      });

      const response = await axios.post(smscUrl, payload, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000, // 10s timeout
      });

      const responseData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

      // Check for known error messages from SMSC
      const knownErrors = [
        'Unauthorized IP',
        'Unauthorized User',
        'Unauthorized Password',
        'Unauthorized/Invalid Source Address',
        'Invalid Destination Address',
        'Message Length is invalid',
        'Operation fail',
      ];

      const foundError = knownErrors.find((err) =>
        responseData.toLowerCase().includes(err.toLowerCase()),
      );

      if (foundError || response.status < 200 || response.status >= 300) {
        const errorReason = foundError || `HTTP ${response.status}: ${responseData}`;
        this.logger.error(`[SMS] SMS notification failed for recipient ${maskedDst}. Reason: ${errorReason}`);
        return { success: false, error: errorReason };
      }

      this.logger.log(`[SMS] SMS submission completed for recipient ${maskedDst}. Response: ${responseData}`);
      return { success: true, messageId: responseData };
    } catch (error: any) {
      const safeErrorMessage =
        error?.response?.data || error?.message || 'Network failure / SMSC timeout';

      // Log safely without exposing credentials
      this.logger.error(
        `[SMS] SMS notification failed for recipient ${maskedDst}. Reason: ${typeof safeErrorMessage === 'object' ? JSON.stringify(safeErrorMessage) : safeErrorMessage}`,
      );

      return {
        success: false,
        error: String(safeErrorMessage),
      };
    }
  }
}
