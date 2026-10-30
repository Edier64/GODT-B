import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { DonorsModule } from "./presentation/donors/donors.module";
import { PrivacyModule } from "./application/privacy/privacy.module";
import { LegalizationModule } from "./presentation/legalization/legalization.module";
import { DocumentsModule } from "./presentation/documents/documents.module";
import { OcrModule } from "./presentation/ocr/ocr.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    DonorsModule,
    PrivacyModule,
    LegalizationModule,
    DocumentsModule,
    OcrModule,
  ],
})
export class AppModule {}
