import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

export async function crawl(url: string, filename: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 90000 });
    await new Promise((res) => setTimeout(res, 3000));

    const tabInfo = await page.evaluate(() => ({
      radix: document.querySelectorAll('[role="tab"]').length,
      inactive: document.querySelectorAll('[role="tab"][data-state="inactive"]').length,
      ariaNotSelected: document.querySelectorAll('[role="tab"]:not([aria-selected="true"])').length,
      hidden: document.querySelectorAll('[hidden]').length,
    }));
    console.log(`[${url}] Tab info:`, tabInfo);

    await crawlSmart(page, url);
    await page.evaluate(() => {
      document.querySelectorAll('script').forEach(el => el.remove());
      document.querySelectorAll('link[as="script"]').forEach(el => el.remove());
    });

    const html = await page.content();
    const baseUrl = new URL(url).origin;
    const fixedHtml = fixNextJsHtml(html, baseUrl);

    const filePath = path.join(__dirname, "../result", filename);
    fs.writeFileSync(filePath, fixedHtml, "utf-8");
    console.log(`Saved to ${filePath}`);
  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
  } finally {
    await browser.close();
  }
}

async function crawlSmart(page: any, url: string) {
  const hostname = new URL(url).hostname;

  if (hostname.includes("pinterest")) {
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    );
    await new Promise((res) => setTimeout(res, 5000));
    await autoScroll(page);
    await new Promise((res) => setTimeout(res, 5000));
  } else {
    await clickAllTabs(page);
    await autoScroll(page);
    await new Promise((res) => setTimeout(res, 2000));
  }
}

async function clickAllTabs(page: any) {
  const clicked = await page.evaluate(async () => {
    let count = 0;

    const selectors = [
      '[role="tab"][data-state="inactive"]',
      '[role="tab"]:not([aria-selected="true"])',
      '[data-state="closed"] button[aria-expanded="false"]',
      '.nav-link:not(.active)',
      '[role="tab"]:not(.Mui-selected)',
      '[role="tabpanel"][hidden]',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (el.tagName.toLowerCase() === 'a') {
          const href = el.getAttribute('href');
          if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            continue;
          }
        }

        (el as HTMLElement).click();
        await new Promise((r) => setTimeout(r, 600));
        count++;
      }
    }

    const accordions = document.querySelectorAll(
      'details:not([open]), [data-headlessui-state=""] button'
    );
    for (const el of accordions) {
      (el as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 300));
      count++;
    }

    return count;
  });

  console.log(`Clicked ${clicked} interactive elements`);
  await new Promise((res) => setTimeout(res, 1500));
}

async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 150);
    });
  });
}

function fixNextJsHtml(html: string, baseUrl: string): string {
  const unHidden = html
    .replace(/(<div[^>]*role="tabpanel"[^>]*)\shidden=""/g, "$1")
    .replace(/data-state="inactive"/g, 'data-state="active"');

  return unHidden
    .replace(/\/_next\//g, `${baseUrl}/_next/`)
    .replace(/src="\/(?!\/)(.*?)"/g, `src="${baseUrl}/$1"`)
    .replace(/href="\/(?!\/|#)(.*?)"/g, `href="${baseUrl}/$1"`)
    .replace(/srcset="\/(?!\/)(.*?)"/g, `srcset="${baseUrl}/$1"`)
    .replace(/url\(\/(.*?)\)/g, `url(${baseUrl}/$1)`)
    .replace("<head>", `<head>\n  <base href="${baseUrl}/">`);
}