import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks(); // SIGTERM: selesaikan request berjalan dan tutup koneksi database
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('REST API Starter Kit')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, doc);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
