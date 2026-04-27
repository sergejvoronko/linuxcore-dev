import { test } from '@playwright/test';
test('check overflow on ollama post mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4321/homelab/ollama-linux-setup');
  await page.waitForLoadState('networkidle');
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  console.log(`Body scrollWidth: ${bodyWidth}, Viewport: ${viewportWidth}, Overflow: ${bodyWidth - viewportWidth}px`);
  const widest = await page.evaluate(() => {
    let maxRight = 0, result = '';
    document.querySelectorAll('*').forEach(e => {
      const r = e.getBoundingClientRect().right;
      if (r > maxRight) {
        maxRight = r;
        result = e.tagName + (e.className ? '.' + [...e.classList].slice(0,2).join('.') : '') + ' | ' + e.textContent?.trim().slice(0,60);
      }
    });
    return { maxRight, result };
  });
  console.log(`Widest element (right: ${widest.maxRight}px): ${widest.result}`);
});
