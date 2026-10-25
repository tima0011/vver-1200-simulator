const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const filePath = path.resolve(__dirname, 'index.html');
  const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');

  await page.goto(fileUrl, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // 1. Cross view
  await page.click('#btnSubCross');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.resolve(__dirname, 'test_cross.png') });

  // 2. Loops view
  await page.click('#btnSubLoops');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.resolve(__dirname, 'test_loops.png') });

  // 3. Core view
  await page.click('#tabCore');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.resolve(__dirname, 'test_core.png') });

  // 4. 3D view
  await page.click('#tab3D');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.resolve(__dirname, 'test_3d.png') });

  await browser.close();
  console.log('Inspect screenshots generated!');
})();
