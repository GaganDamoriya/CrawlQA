import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { CrawlerService } from './crawler.service';

@Controller()
export class CrawlerController {
  constructor(private readonly crawlerService: CrawlerService) {}

  @Post('crawl')
  async crawl(@Body() body: { url: string }) {
    const { url } = body;

    if (!url || typeof url !== 'string') {
      throw new BadRequestException('A valid "url" field is required.');
    }

    try {
      new URL(url);
    } catch {
      throw new BadRequestException(`Invalid URL: "${url}"`);
    }

    return this.crawlerService.crawlWebsite(url);
  }
}
