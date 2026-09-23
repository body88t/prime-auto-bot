import { Request, Response } from 'express';
import { prisma } from '../prisma/client';
import { isSenderWhitelisted, parseIncomingBankSms } from '../utils/sms-parser.util';
import { LoggerService } from '../services/logger.service';

export class SmsController {
  /**
   * Ingestion endpoint called by the Android SMS Listener app:
   * POST /api/v1/sms/incoming
   */
  public static async handleIncomingSms(req: Request, res: Response) {
    const { sender, rawMessage, amount, referenceId, timestamp } = req.body;

    if (!sender || !rawMessage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sender and rawMessage are mandatory.',
      });
    }

    // 1. Verify sender whitelist
    if (!isSenderWhitelisted(sender)) {
      LoggerService.warn('SMS_INGESTION', `Rejected SMS from non-whitelisted sender: "${sender}"`);
      return res.status(403).json({
        success: false,
        error: `Sender "${sender}" is not in the authorized banking whitelist. Personal/unknown messages are discarded.`,
      });
    }

    // 2. Parse or normalize amount & reference ID
    const parsed = parseIncomingBankSms(sender, rawMessage, timestamp ? new Date(timestamp) : undefined);
    const finalAmount = typeof amount === 'number' ? amount : parsed.amount;
    const finalRefId = referenceId ? String(referenceId).trim() : parsed.referenceId;
    const receivedAt = timestamp ? new Date(timestamp) : new Date();

    if (finalAmount === null || finalAmount <= 0) {
      LoggerService.warn('SMS_INGESTION', `Received SMS from ${sender} but could not extract a valid amount: "${rawMessage}"`);
      return res.status(422).json({
        success: false,
        error: 'Could not extract valid transaction amount from SMS content.',
      });
    }

    // 3. Deduplication check (avoid inserting the same SMS twice)
    if (finalRefId) {
      const existing = await prisma.incomingSms.findFirst({
        where: {
          referenceId: finalRefId,
          sender: sender,
        },
      });

      if (existing) {
        LoggerService.info('SMS_INGESTION', `SMS with referenceId ${finalRefId} already exists in DB. Skipping duplicate.`);
        return res.status(200).json({
          success: true,
          message: 'SMS already ingested previously.',
          sms: existing,
        });
      }
    }

    // 4. Save to IncomingSms table
    const smsRecord = await prisma.incomingSms.create({
      data: {
        sender,
        rawMessage,
        amount: finalAmount,
        referenceId: finalRefId,
        receivedAt,
        isConsumed: false,
      },
    });

    LoggerService.info('SMS_INGESTION', `Bank SMS ingested successfully: ID=${smsRecord.id}, Sender=${sender}, Amount=${finalAmount} EGP, Ref=${finalRefId || 'N/A'}`);

    return res.status(201).json({
      success: true,
      message: 'Incoming SMS successfully registered and ready for matching.',
      sms: smsRecord,
    });
  }

  /**
   * Health check / heartbeat endpoint for the mobile app
   * GET /api/v1/sms/ping
   */
  public static async ping(req: Request, res: Response) {
    return res.status(200).json({
      success: true,
      status: 'online',
      timestamp: new Date().toISOString(),
      service: 'PRIME AUTO BOT SMS INGESTION GATEWAY',
    });
  }
}
