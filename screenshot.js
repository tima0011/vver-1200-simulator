const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();

  const filePath = path.resolve(__dirname, 'index.html');
  const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
  console.log(`Opening page: ${fileUrl}`);

  await page.goto(fileUrl, { waitUntil: 'load' });

  // Allow canvas/Three.js/charts/layout scripts to settle
  await page.waitForTimeout(3000);

  const outputPath = path.resolve(__dirname, 'preview.png');
  console.log(`Capturing full page screenshot to: ${outputPath}`);
  await page.screenshot({ path: outputPath, fullPage: true });

  console.log('Done!');
  await browser.close();
})();
