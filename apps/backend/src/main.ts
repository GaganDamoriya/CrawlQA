import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  });
  const port = process.env.PORT ?? 7432;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();
