import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { APP_CONFIG, AppConfig } from './config/app-config';

async function bootstrap() {
  const app = setupApp(
    // bodyParser: false — Better Auth reads the raw stream on /api/auth/*; IdentityModule
    // re-adds the JSON parser (100 kB) for every other route.
    await NestFactory.create(AppModule, {
      bodyParser: false,
      bufferLogs: true,
    }),
  );
  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
}
void bootstrap();
