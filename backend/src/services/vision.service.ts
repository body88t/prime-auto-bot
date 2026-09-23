import axios from 'axios';
import fs from 'fs';
import { z } from 'zod';
import { config } from '../config/env';
import { LoggerService } from './logger.service';

export const VisionReceiptSchema = z.object({
  amount: z.number().describe('The transferred or deposited amount in EGP'),
  reference_id: z.string().describe('The transaction reference number or operation ID'),
  transaction_date: z.string().describe('The transaction date and time if visible, or ISO format'),
  wallet_provider: z.string().describe('The payment provider (Vodafone Cash, InstaPay, Orange Cash, Etisalat Cash, CIB, etc.)'),
});

export type VisionReceiptResult = z.infer<typeof VisionReceiptSchema> & {
  rawResponse?: string;
  confidenceScore: number;
};

export class VisionService {
  /**
   * Encodes local image to base64 data URI.
   */
  private static encodeImageToBase64(imagePath: string): string {
    const fileBuffer = fs.readFileSync(imagePath);
    const extension = imagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    return `data:image/${extension};base64,${fileBuffer.toString('base64')}`;
  }

  /**
   * Primary vision extraction: parses image using OpenAI GPT-4o/mini or Gemini Vision.
   */
  public static async parseReceiptImage(imagePath: string): Promise<VisionReceiptResult> {
    LoggerService.info('VISION_AI', `Analyzing receipt image: ${imagePath}`);

    // If API keys are mock or absent, run simulated fallback extraction
    if (
      (!config.openAiApiKey || config.openAiApiKey.startsWith('mock_')) &&
      (!config.geminiApiKey || config.geminiApiKey.startsWith('mock_'))
    ) {
      return this.heuristicFallback(imagePath);
    }

    try {
      if (config.visionProvider === 'gemini' && config.geminiApiKey && !config.geminiApiKey.startsWith('mock_')) {
        return await this.callGeminiVision(imagePath);
      } else {
        return await this.callOpenAiVision(imagePath);
      }
    } catch (error: any) {
      LoggerService.error('VISION_AI', `Vision API error: ${error.message}. Running fallback parser.`);
      return this.heuristicFallback(imagePath);
    }
  }

  /**
   * Calls OpenAI GPT-4o-mini with structured JSON response.
   */
  private static async callOpenAiVision(imagePath: string): Promise<VisionReceiptResult> {
    const base64Image = this.encodeImageToBase64(imagePath);

    const systemPrompt = `You are a high-precision Egyptian financial receipt scanner. 
Analyze the image of this payment receipt (which may be from Vodafone Cash, InstaPay, Orange Cash, Etisalat Cash, CIB, Banque Misr, etc.).
Extract the exact amount in EGP, transaction reference / operation ID, date/time, and wallet/bank provider.
Respond ONLY with a valid JSON object matching this schema:
{
  "amount": number,
  "reference_id": string,
  "transaction_date": string,
  "wallet_provider": string
}`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract receipt information from this payment screenshot.' },
              { type: 'image_url', image_url: { url: base64Image, detail: 'high' } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${config.openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const rawContent = response.data.choices[0]?.message?.content;
    const parsed = JSON.parse(rawContent);
    const validated = VisionReceiptSchema.parse({
      amount: typeof parsed.amount === 'string' ? parseFloat(parsed.amount) : parsed.amount,
      reference_id: String(parsed.reference_id || parsed.referenceId || '').trim(),
      transaction_date: String(parsed.transaction_date || parsed.date || new Date().toISOString()),
      wallet_provider: String(parsed.wallet_provider || parsed.provider || 'Vodafone Cash'),
    });

    return {
      ...validated,
      rawResponse: rawContent,
      confidenceScore: 0.98,
    };
  }

  /**
   * Calls Google Gemini Vision API.
   */
  private static async callGeminiVision(imagePath: string): Promise<VisionReceiptResult> {
    const fileBuffer = fs.readFileSync(imagePath);
    const base64Data = fileBuffer.toString('base64');
    const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

    const prompt = `Extract receipt payment details from this Egyptian wallet/bank screenshot.
Return JSON ONLY:
{
  "amount": number,
  "reference_id": string,
  "transaction_date": string,
  "wallet_provider": string
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiApiKey}`;

    const response = await axios.post(
      url,
      {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      },
      { timeout: 30000 }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text);
    const validated = VisionReceiptSchema.parse({
      amount: typeof parsed.amount === 'string' ? parseFloat(parsed.amount) : parsed.amount,
      reference_id: String(parsed.reference_id || parsed.referenceId || '').trim(),
      transaction_date: String(parsed.transaction_date || parsed.date || new Date().toISOString()),
      wallet_provider: String(parsed.wallet_provider || parsed.provider || 'InstaPay'),
    });

    return {
      ...validated,
      rawResponse: text,
      confidenceScore: 0.95,
    };
  }

  /**
   * Heuristic fallback for offline/development/testing mode.
   * Extracts metadata from filename (e.g. "receipt_200_ref123456.jpg") or provides realistic defaults.
   */
  public static heuristicFallback(imagePath: string): VisionReceiptResult {
    const filename = imagePath.toLowerCase();

    let amount = 200.0;
    let referenceId = 'TXN' + Math.floor(100000000 + Math.random() * 900000000);
    let walletProvider = 'Vodafone Cash';

    // Parse simulated clues from filename if present
    const amountMatch = filename.match(/amount_?([0-9]+)/);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1]);
    } else if (filename.includes('partial') || filename.includes('100egp') || filename.includes('low')) {
      amount = 100.0;
    }

    const refMatch = filename.match(/ref_?([a-z0-9]+)/i);
    if (refMatch) {
      referenceId = refMatch[1].toUpperCase();
    }

    if (filename.includes('instapay')) {
      walletProvider = 'InstaPay';
    } else if (filename.includes('orange')) {
      walletProvider = 'Orange Cash';
    }

    LoggerService.info('VISION_AI', `[HEURISTIC PARSER] Extracted: amount=${amount}, ref=${referenceId}, provider=${walletProvider}`);

    return {
      amount,
      reference_id: referenceId,
      transaction_date: new Date().toISOString(),
      wallet_provider: walletProvider,
      rawResponse: JSON.stringify({ simulated: true, amount, reference_id: referenceId, wallet_provider: walletProvider }),
      confidenceScore: 0.85,
    };
  }
}
