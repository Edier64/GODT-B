import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";

function validateCriticalEnvironment(logger: Logger): void {
  const nodeEnv = (process.env.NODE_ENV || "development").trim().toLowerCase();
  const isProduction = nodeEnv === "production";
  const isStaging = nodeEnv === "staging";
  void isProduction;
  void isStaging;

  if (!process.env.DATABASE_URL) {
    logger.error("[CRITICAL] DATABASE_URL no está configurada.");
    process.exit(1);
  }

  const jwtSecret = (process.env.JWT_SECRET || "").trim();
  if (!jwtSecret) {
    logger.error("[CRITICAL] JWT_SECRET es obligatorio y no está configurado.");
    process.exit(1);
  }

  if (
    jwtSecret.length < 32 ||
    jwtSecret.includes("replace_with") ||
    jwtSecret.includes("CHANGE_ME") ||
    jwtSecret.includes("secret_at_least_32")
  ) {
    logger.error(
      `[CRITICAL] JWT_SECRET en entorno ${nodeEnv} es inseguro o no cumple con la longitud mínima de 32 caracteres.`,
    );
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");
  validateCriticalEnvironment(logger);

  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(cookieParser());
  app.enableShutdownHooks();

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
        .map((o) => o.trim())
        .filter((o) => o && o !== "*")
    : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy blocked access from origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const isProduction = (process.env.NODE_ENV || "").trim().toLowerCase() === "production";
  const swaggerEnabled =
    process.env.SWAGGER_ENABLED === "true" ||
    (!isProduction && process.env.SWAGGER_ENABLED !== "false");

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle("GODT Backend API")
      .setDescription("API del Sistema GODT Regional 3 — Gestión Operativa de Donación y Trasplantes")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Servidor GODT Backend escuchando en puerto ${port} (entorno: ${process.env.NODE_ENV || "development"})`);
}

void bootstrap();
