import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe,BadRequestException } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const formattedErrors = errors.map(err => ({
        field: err.property,
        errors: Object.values(err.constraints || {}),
      }));

      return new BadRequestException({
        message: 'Помилка валідації',
        errors: formattedErrors,
      });
    },
  }),
  );
  
  app.enableCors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
