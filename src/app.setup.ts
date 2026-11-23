import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { NoNullsPipe } from './common/pipes';

// Dipakai main.ts dan e2e supaya perilakunya sama.
export function configureApp(app: INestApplication) {
  app.useGlobalPipes(
    new NoNullsPipe(),
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
