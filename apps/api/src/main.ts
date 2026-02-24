import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as os from 'os';

function getLocalIp(): string {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS_ORIGIN can be:
  //   *                           → allow any origin (home-network dev)
  //   http://192.168.1.x:5173     → single origin
  //   http://a:5173,http://b:5173 → comma-separated list
  const rawOrigin = process.env.CORS_ORIGIN ?? '*';
  const corsOrigin: string | string[] | RegExp =
    rawOrigin === '*'
      ? '*'
      : rawOrigin.includes(',')
        ? rawOrigin.split(',').map((s) => s.trim())
        : rawOrigin;

  app.enableCors({ origin: corsOrigin, credentials: rawOrigin !== '*' });

  app.setGlobalPrefix('api');

  // Validate and transform incoming request bodies
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  const ip = getLocalIp();
  Logger.log(`🚀 API → local:   http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`🚀 API → network: http://${ip}:${port}/api`, 'Bootstrap');
}

bootstrap();

