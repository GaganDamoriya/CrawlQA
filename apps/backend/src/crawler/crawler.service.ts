import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

export interface PageElement {
  tag: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  missingAlt: boolean;
}

export interface PageResult {
  url: string;
  title: string;
  screenshotPath: string;
  text: string;
  links: string[];
  layout: {
    hasHorizontalScroll: boolean;
    viewport: { width: number; height: number };
    document: { scrollWidth: number; scrollHeight: number };
  };
  elements: PageElement[];
  meta: {
    description: string;
    lang: string;
    canonical: string;
  };
  consoleErrors: string[];
  images: PageImage[];
}

export interface CrawlResult {
  pages: PageResult[];
}

function normalizeUrl(rawUrl: string): string {
  return rawUrl.split('#')[0].replace(/\/$/, '');
}

@Injectable()
export class CrawlerService {
  private readonly screenshotsDir = path.join(process.cwd(), 'screenshots');

  constructor() {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  async crawlWebsite(startUrl: string): Promise<CrawlResult> {
    const parsedBase = new url.URL(startUrl);
    const baseDomain = `${parsedBase.protocol}//${parsedBase.hostname}`;
    const hostname = parsedBase.hostname.replace(/\./g, '-');

    const visited = new Set<string>();
    const pages: PageResult[] = [];

    const browser = await chromium.launch({ headless: true });

    try {
      const urlQueue = [normalizeUrl(startUrl)];

      for (let i = 0; i < urlQueue.length && pages.length < 3; i++) {
        const currentUrl = urlQueue[i];
        if (visited.has(currentUrl)) continue;
        visited.add(currentUrl);

        const result = await this.crawlPage(browser, currentUrl, hostname, pages.length);
        if (!result) continue;

        pages.push(result);

        // Only collect more links from the first page (homepage)
        if (i === 0) {
          const internalLinks = result.links
            .map(normalizeUrl)
            .filter(
              (link) =>
                link.startsWith(baseDomain) &&
                !link.includes('mailto:') &&
                !link.includes('tel:') &&
                !link.includes('javascript:') &&
                !visited.has(link),
            )
            .slice(0, 2);

          urlQueue.push(...internalLinks);
        }
      }
    } finally {
      await browser.close();
    }

    return { pages };
  }

  private async crawlPage(
    browser: any,
    pageUrl: string,
    hostname: string,
    index: number,
  ): Promise<PageResult | null> {
    console.log(`Crawling: ${pageUrl}`);
    const page = await browser.newPage();

    // Collect console errors before navigation
    const consoleErrors: string[] = [];
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    try {
      await page.goto(pageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });

      // Wait for network to go quiet (images, fonts, async data)
      await page.waitForLoadState('networkidle').catch(() => {
        console.log(`networkidle timeout for ${pageUrl}, continuing anyway`);
      });

      // Extra buffer for JS-rendered content
      await page.waitForTimeout(2000);

      // Scroll down to trigger lazy-loaded content
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 300;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= document.body.scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      // Scroll back to top before extraction + screenshot
      await page.evaluate(() => window.scrollTo(0, 0));

      const title = await page.title();

      const text: string = await page.evaluate(
        () => (document.body?.innerText ?? '').trim(),
      );

      const links: string[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a'))
          .map((a: HTMLAnchorElement) => a.href)
          .filter((href) => href.startsWith('http')),
      );

      const layout = await page.evaluate(() => ({
        hasHorizontalScroll:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        document: {
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
        },
      }));

      const elements: PageElement[] = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll('button,input,select,textarea,a,h1,h2'),
        )
          .slice(0, 50)
          .map((el: Element) => {
            const r = el.getBoundingClientRect();
            const text = (
              el.textContent ||
              el.getAttribute('placeholder') ||
              el.getAttribute('aria-label') ||
              ''
            )
              .trim()
              .slice(0, 100);
            return {
              tag: el.tagName.toLowerCase(),
              text,
              x: Math.round(r.x),
              y: Math.round(r.y),
              width: Math.round(r.width),
              height: Math.round(r.height),
            };
          })
          .filter((el) => el.width > 0 && el.height > 0),
      );

      const meta = await page.evaluate(() => ({
        description:
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute('content') ?? '',
        lang: document.documentElement.lang ?? '',
        canonical:
          document
            .querySelector('link[rel="canonical"]')
            ?.getAttribute('href') ?? '',
      }));

      const images: PageImage[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('img'))
          .slice(0, 30)
          .map((img: HTMLImageElement) => ({
            src: img.src,
            alt: img.alt,
            width: img.naturalWidth,
            height: img.naturalHeight,
            missingAlt: !img.alt,
          })),
      );

      const screenshotFilename = `${hostname}-${index}-${Date.now()}.png`;
      const screenshotPath = path.join(this.screenshotsDir, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      return {
        url: pageUrl,
        title,
        screenshotPath,
        text: text.slice(0, 5000),
        links,
        layout,
        elements,
        meta,
        consoleErrors,
        images,
      };
    } catch (err) {
      console.log(`Failed to crawl ${pageUrl}: ${err.message}`);
      return null;
    } finally {
      await page.close();
    }
  }
}
