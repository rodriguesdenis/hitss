import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { APP_CONFIG, AppConfig } from './config/app-config';

async function bootstrap() {
  const app = setupApp(await NestFactory.create(AppModule));
  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
}
void bootstrap();
