import { Module } from "@nestjs/common";
import { InstitutionService } from "../../application/institutions/institution.service";
import { InstitutionController } from "./institution.controller";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [InstitutionController],
  providers: [InstitutionService],
  exports: [InstitutionService],
})
export class InstitutionModule {}
