import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { LoggerService } from './logger.service';

export interface ProcessWaybillResult {
  success: boolean;
  awbNumber?: string;
  pngPath?: string;
  pdfPath?: string;
  error?: string;
}

export class WuiltAutomationService {
  private static waybillsDir = path.resolve(__dirname, '../../storage/waybills');

  /**
   * Calculates the next eligible pickup date at 2:00 PM.
   * Rules:
   * - Sunday (0): Closed (Store off).
   * - Friday (5): Closed (Aramex off).
   * - Time must be 2:00 PM (14:00).
   */
  public static calculateNextPickupDate(from: Date = new Date()): Date {
    const target = new Date(from);

    // If current time is past 12:00 PM (noon), advance to next day
    if (target.getHours() >= 12) {
      target.setDate(target.getDate() + 1);
    }

    // Skip Fridays (5) and Sundays (0)
    while (target.getDay() === 0 || target.getDay() === 5) {
      target.setDate(target.getDate() + 1);
    }

    target.setHours(14, 0, 0, 0); // 2:00 PM
    return target;
  }

  /**
   * Connects to active Chrome via DevToolsActivePort or fallback WebSocket.
   */
  public static async getBrowser(): Promise<Browser> {
    const activePortPath = path.join(
      process.env.LOCALAPPDATA || 'C:\\Users\\Owner\\AppData\\Local',
      'Google',
      'Chrome',
      'User Data',
      'DevToolsActivePort'
    );

    if (fs.existsSync(activePortPath)) {
      try {
        const lines = fs.readFileSync(activePortPath, 'utf8').trim().split('\n');
        const port = lines[0].trim();
        const wsPath = lines[1].trim();
        const wsUrl = `ws://127.0.0.1:${port}${wsPath}`;

        LoggerService.info('WUILT_AUTOMATION', `Connecting to active Chrome session at ${wsUrl}`);
        const browser = await puppeteer.connect({
          browserWSEndpoint: wsUrl,
          defaultViewport: null,
        });
        return browser;
      } catch (err: any) {
        LoggerService.warn('WUILT_AUTOMATION', `Could not connect to DevToolsActivePort: ${err.message}. Launching fresh browser.`);
      }
    }

    // Fallback: launch browser
    const isProduction = process.env.NODE_ENV === 'production' || !process.env.LOCALAPPDATA;
    LoggerService.info('WUILT_AUTOMATION', `Launching Chrome (headless: ${isProduction}) with saved user data`);
    const userDataDir = path.resolve(__dirname, '../../storage/chrome_profile');
    const launchOptions: any = {
      headless: isProduction ? true : false,
      userDataDir,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      defaultViewport: null,
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    return await puppeteer.launch(launchOptions);
  }

  /**
   * Finds existing Wuilt tab or opens a new tab.
   */
  public static async getWuiltPage(browser: Browser, targetUrl?: string): Promise<Page> {
    const pages = await browser.pages();
    let page = pages.find((p) => p.url().includes('wuilt.com'));

    if (!page) {
      page = await browser.newPage();
      if (targetUrl) {
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      }
    } else if (targetUrl && !page.url().includes(targetUrl)) {
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    }

    return page;
  }

  /**
   * Automates the full Wuilt workflow for an order:
   * 1. Navigates to the order details page.
   * 2. Marks payment as Partially Paid or Fully Paid based on amount.
   * 3. Requests Aramex Airway Bill scheduled for 2:00 PM (excluding Friday & Sunday).
   * 4. Downloads PDF and captures PNG screenshot.
   */
  public static async processOrderAirwayBill(params: {
    wuiltOrderId: string;
    orderNumber?: string;
    depositPaid: number;
    remainingTotal: number;
  }): Promise<ProcessWaybillResult> {
    if (!fs.existsSync(this.waybillsDir)) {
      fs.mkdirSync(this.waybillsDir, { recursive: true });
    }

    const { wuiltOrderId, orderNumber, depositPaid, remainingTotal } = params;
    LoggerService.info('WUILT_AUTOMATION', `Starting Wuilt automation for order #${wuiltOrderId} (deposit: ${depositPaid}, remaining: ${remainingTotal})`);

    let browser: Browser | null = null;
    let shouldDisconnect = true;

    try {
      browser = await this.getBrowser();
      const orderUrl = `https://app.wuilt.com/store/Store_cmdnj9m3u06p301ki8jsb7zw2/ar/orders/${wuiltOrderId}`;
      const page = await this.getWuiltPage(browser, orderUrl);

      await page.bringToFront();
      await new Promise((r) => setTimeout(r, 2000));

      // -----------------------------------------------------------------------
      // Step 1: Handle Payment (Mark as Partially paid OR Fully paid)
      // -----------------------------------------------------------------------
      if (remainingTotal === 0) {
        // Customer paid in full
        LoggerService.info('WUILT_AUTOMATION', 'Order is paid in full. Looking for "Mark as Fully paid" button...');
        const fullyPaidBtn = await page.evaluateHandle(() => {
          return Array.from(document.querySelectorAll('button')).find((b) =>
            b.innerText.includes('Mark as Fully paid') || b.innerText.includes('مدفوع بالكامل')
          );
        });

        if (fullyPaidBtn && (await fullyPaidBtn.asElement())) {
          await (fullyPaidBtn.asElement() as any).click();
          await new Promise((r) => setTimeout(r, 1500));
          // Confirm if modal appears
          const confirmBtn = await page.evaluateHandle(() => {
            return Array.from(document.querySelectorAll('button')).find((b) =>
              b.innerText.includes('Confirm') || b.innerText.includes('تأكيد')
            );
          });
          if (confirmBtn && (await confirmBtn.asElement())) {
            await (confirmBtn.asElement() as any).click();
            await new Promise((r) => setTimeout(r, 1500));
          }
          LoggerService.info('WUILT_AUTOMATION', 'Marked order as Fully paid.');
        }
      } else if (depositPaid > 0) {
        // Partial deposit paid
        LoggerService.info('WUILT_AUTOMATION', `Marking order as Partially paid (${depositPaid} EGP)...`);
        const partiallyPaidBtn = await page.evaluateHandle(() => {
          return Array.from(document.querySelectorAll('button')).find((b) =>
            b.innerText.includes('Mark as Partially paid') || b.innerText.includes('مدفوع جزئياً')
          );
        });

        if (partiallyPaidBtn && (await partiallyPaidBtn.asElement())) {
          await (partiallyPaidBtn.asElement() as any).click();
          await new Promise((r) => setTimeout(r, 1500));

          // Enter deposit amount into input[name="amount"]
          const amountInput = await page.$('input[name="amount"]');
          if (amountInput) {
            await amountInput.click({ clickCount: 3 });
            await amountInput.type(depositPaid.toString());
            await new Promise((r) => setTimeout(r, 500));
          }

          // Click Confirm Payment button
          const confirmPaymentBtn = await page.evaluateHandle(() => {
            return Array.from(document.querySelectorAll('button')).find((b) =>
              b.innerText.includes('Confirm Payment') || b.innerText.includes('تأكيد الدفع')
            );
          });
          if (confirmPaymentBtn && (await confirmPaymentBtn.asElement())) {
            await (confirmPaymentBtn.asElement() as any).click();
            await new Promise((r) => setTimeout(r, 2000));
            LoggerService.info('WUILT_AUTOMATION', `Confirmed partial payment of ${depositPaid} EGP on Wuilt.`);
          }
        }
      }

      // -----------------------------------------------------------------------
      // Step 2: Request Airway Bill (Aramex)
      // -----------------------------------------------------------------------
      LoggerService.info('WUILT_AUTOMATION', 'Looking for "Request Airway Bill" button...');
      const requestAwbBtn = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll('button')).find((b) =>
          b.innerText.includes('Request Airway Bill') || b.innerText.includes('طلب بوليصة')
        );
      });

      if (!requestAwbBtn || !(await requestAwbBtn.asElement())) {
        LoggerService.warn('WUILT_AUTOMATION', '"Request Airway Bill" button not found. Maybe already requested.');
      } else {
        await (requestAwbBtn.asElement() as any).click();
        await new Promise((r) => setTimeout(r, 2000));

        // ---------------------------------------------------------------------
        // Step 3: Schedule Pickup Date (2:00 PM, skipping Friday & Sunday)
        // ---------------------------------------------------------------------
        const nextDate = this.calculateNextPickupDate();
        const dayOfMonth = nextDate.getDate().toString();
        LoggerService.info('WUILT_AUTOMATION', `Target pickup date: ${nextDate.toDateString()} at 2:00 PM (Day: ${dayOfMonth})`);

        const dateInput = await page.$('input[placeholder="Select date"]');
        if (dateInput) {
          await dateInput.click();
          await new Promise((r) => setTimeout(r, 1000));

          // 1. Click target day inside react-datepicker
          await page.evaluate((targetDay) => {
            const days = Array.from(document.querySelectorAll('.react-datepicker__day:not(.react-datepicker__day--disabled)'));
            const match = days.find((d) => (d as HTMLElement).innerText.trim() === targetDay);
            if (match) {
              (match as HTMLElement).click();
            }
          }, dayOfMonth);

          await new Promise((r) => setTimeout(r, 500));

          // 2. Select 2:00 PM from the time list
          await page.evaluate(() => {
            const times = Array.from(document.querySelectorAll('.react-datepicker__time-list-item'));
            const match = times.find((t) => (t as HTMLElement).innerText.trim() === '2:00 PM');
            if (match) {
              (match as HTMLElement).click();
            }
          });

          await new Promise((r) => setTimeout(r, 1000));
          LoggerService.info('WUILT_AUTOMATION', `Selected pickup date at 2:00 PM.`);
        }

        // Click the green "Request" button in the modal
        const submitRequestBtn = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns.find((b) => b.innerText.trim() === 'Request' || b.innerText.trim() === 'طلب');
        });

        if (submitRequestBtn && (await submitRequestBtn.asElement())) {
          LoggerService.info('WUILT_AUTOMATION', 'Submitting Airway Bill request...');
          await (submitRequestBtn.asElement() as any).click();
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      // -----------------------------------------------------------------------
      // Step 4: Capture Screenshot and Locate AWB Waybill
      // -----------------------------------------------------------------------
      const filePrefix = `aramex_${orderNumber || wuiltOrderId}_${Date.now()}`;
      const pngPath = path.join(this.waybillsDir, `${filePrefix}.png`);
      const pdfPath = path.join(this.waybillsDir, `${filePrefix}.pdf`);

      // 1. Take a clean screenshot of the Shipping/Waybill section
      const shippingSection = await page.$('[class*="shipping"], [class*="card"]');
      if (shippingSection) {
        await shippingSection.screenshot({ path: pngPath });
      } else {
        await page.screenshot({ path: pngPath, fullPage: false });
      }
      LoggerService.info('WUILT_AUTOMATION', `Saved waybill screenshot at: ${pngPath}`);

      // 2. Look for print/download waybill PDF link
      const pdfUrl = await page.evaluate(() => {
        const link = Array.from(document.querySelectorAll('a, button')).find((el) => {
          const text = (el as HTMLElement).innerText || '';
          return text.includes('Print Airway Bill') || text.includes('طباعة البوليصة') || text.includes('AWB');
        });
        if (link && (link as HTMLAnchorElement).href) {
          return (link as HTMLAnchorElement).href;
        }
        return null;
      });

      if (pdfUrl && pdfUrl.startsWith('http')) {
        try {
          const resp = await axios.get(pdfUrl, { responseType: 'arraybuffer', timeout: 15000 });
          fs.writeFileSync(pdfPath, Buffer.from(resp.data));
          LoggerService.info('WUILT_AUTOMATION', `Downloaded official Aramex PDF to: ${pdfPath}`);
        } catch (downloadErr: any) {
          LoggerService.warn('WUILT_AUTOMATION', `Could not download PDF from ${pdfUrl}: ${downloadErr.message}`);
          await page.pdf({ path: pdfPath, format: 'A5', printBackground: true });
        }
      } else {
        // Fallback: render current order/waybill view as PDF
        await page.pdf({ path: pdfPath, format: 'A5', printBackground: true });
      }

      return {
        success: true,
        pngPath,
        pdfPath,
      };
    } catch (error: any) {
      LoggerService.error('WUILT_AUTOMATION', `Automation error on Wuilt order ${wuiltOrderId}`, error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      if (browser && shouldDisconnect) {
        try {
          await browser.disconnect();
        } catch {}
      }
    }
  }
}
