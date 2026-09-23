const path = require('path');
const fs = require('fs');

async function generate() {
  // Use puppeteer from backend/node_modules
  const puppeteer = require(path.join(__dirname, '..', 'backend', 'node_modules', 'puppeteer'));
  
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  const htmlPath = path.resolve(__dirname, 'report.html');
  
  await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
  
  const pdfPath = path.resolve(__dirname, '..', 'PRIME_AUTO_BOT_COMPREHENSIVE_REPORT.pdf');
  
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '15mm',
      bottom: '15mm',
      left: '15mm',
      right: '15mm'
    }
  });

  await browser.close();
  console.log('SUCCESS: PDF generated at ' + pdfPath);
}

generate().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
