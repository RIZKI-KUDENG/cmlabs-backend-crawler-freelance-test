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

    await crawlSmart(page, url);

    await page.evaluate(() => {
      document.querySelectorAll('script').forEach(el => el.remove());
      document.querySelectorAll('link[as="script"]').forEach(el => el.remove());

      const script = document.createElement('script');
      script.innerHTML = `
        document.addEventListener('DOMContentLoaded', () => {
          // Logic untuk Radix Tabs
          document.querySelectorAll('[role="tab"]').forEach(tab => {
            tab.addEventListener('click', (e) => {
              const clickedTab = e.currentTarget;
              const tabList = clickedTab.closest('[role="tablist"]');
              if (!tabList) return;

              // Matikan semua tab di list yang sama
              tabList.querySelectorAll('[role="tab"]').forEach(t => {
                t.setAttribute('aria-selected', 'false');
                t.setAttribute('data-state', 'inactive');
                t.classList.remove('text-[#E6C9A8]', 'border-b-2', 'border-[#E6C9A8]');
              });

              // Hidupkan tab yang diklik
              clickedTab.setAttribute('aria-selected', 'true');
              clickedTab.setAttribute('data-state', 'active');
              clickedTab.classList.add('text-[#E6C9A8]', 'border-b-2', 'border-[#E6C9A8]');

              // Sembunyikan panel yang lama
              tabList.querySelectorAll('[role="tab"]').forEach(t => {
                const pId = t.getAttribute('aria-controls');
                if (pId) {
                  const panel = document.getElementById(pId);
                  if (panel) {
                    panel.setAttribute('data-state', 'inactive');
                    panel.hidden = true;
                  }
                }
              });

              // Tampilkan panel yang sesuai
              const targetId = clickedTab.getAttribute('aria-controls');
              if (targetId) {
                const targetPanel = document.getElementById(targetId);
                if (targetPanel) {
                  targetPanel.setAttribute('data-state', 'active');
                  targetPanel.hidden = false;
                }
              }
            });
          });

          // Logic untuk Mobile Accordion
          document.querySelectorAll('button[aria-controls]:not([role="tab"])').forEach(btn => {
            btn.addEventListener('click', () => {
              const targetId = btn.getAttribute('aria-controls');
              const target = document.getElementById(targetId);
              if (!target) return;
              
              const isExpanded = btn.getAttribute('aria-expanded') === 'true';
              btn.setAttribute('aria-expanded', !isExpanded);
              
              if (!isExpanded) {
                target.hidden = false;
                target.setAttribute('data-state', 'open');
                btn.setAttribute('data-state', 'open');
              } else {
                target.hidden = true;
                target.setAttribute('data-state', 'closed');
                btn.setAttribute('data-state', 'closed');
              }
            });
          });
        });
      `;
      document.body.appendChild(script);
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
    const allTabs = document.querySelectorAll('[role="tab"]');
    
    const initialActiveTab = document.querySelector('[role="tab"][aria-selected="true"]');
    const initialActivePanelId = initialActiveTab?.getAttribute('aria-controls');

    for (const el of Array.from(allTabs)) {
      const tab = el as HTMLElement;
      tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      tab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      tab.click();

      await new Promise((r) => setTimeout(r, 800));

      const panelId = tab.getAttribute('aria-controls');
      if (panelId) {
        const panel = document.getElementById(panelId);
        if (panel && panel.innerHTML.trim() !== '') {
          panel.setAttribute('data-saved-content', panel.innerHTML);
        }
      }
      count++;
    }

    const panels = document.querySelectorAll('[role="tabpanel"]');
    panels.forEach(panel => {
      const savedContent = panel.getAttribute('data-saved-content');
      if (savedContent) {
        panel.innerHTML = savedContent;
      }
      
      if (panel.id === initialActivePanelId) {
        panel.removeAttribute('hidden');
        panel.setAttribute('data-state', 'active');
      } else {
        panel.setAttribute('hidden', '');
        panel.setAttribute('data-state', 'inactive');
      }
    });

    allTabs.forEach(tab => {
      if (tab.getAttribute('aria-controls') === initialActivePanelId) {
        tab.setAttribute('aria-selected', 'true');
        tab.setAttribute('data-state', 'active');
      } else {
        tab.setAttribute('aria-selected', 'false');
        tab.setAttribute('data-state', 'inactive');
      }
    });

    const accordions = document.querySelectorAll('button[aria-controls]:not([role="tab"])');
    for (const el of Array.from(accordions)) {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      (el as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 400));
      count++;
    }

    return count;
  });

  console.log(`Processed ${clicked} tabs & accordions.`);
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
  return html
    .replace(/\/_next\//g, `${baseUrl}/_next/`)
    .replace(/src="\/(?!\/)(.*?)"/g, `src="${baseUrl}/$1"`)
    .replace(/href="\/(?!\/|#)(.*?)"/g, `href="${baseUrl}/$1"`)
    .replace(/srcset="\/(?!\/)(.*?)"/g, `srcset="${baseUrl}/$1"`)
    .replace(/url\(\/(.*?)\)/g, `url(${baseUrl}/$1)`)
    .replace("<head>", `<head>\n  <base href="${baseUrl}/">`);
}