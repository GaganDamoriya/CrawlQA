import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CrawlerModule } from './crawler/crawler.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CrawlerModule,
  ],
})
export class AppModule {}
