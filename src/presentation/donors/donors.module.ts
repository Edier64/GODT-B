import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CreateDonorUseCase } from "../../application/donors/create-donor.use-case";
import { GetDonorUseCase } from "../../application/donors/get-donor.use-case";
import { ListDonorsUseCase } from "../../application/donors/list-donors.use-case";
import { UpdateDonorUseCase } from "../../application/donors/update-donor.use-case";
import { PrismaDonorRecordRepository } from "../../infrastructure/donors/prisma-donor-record.repository";
import { DONOR_RECORD_REPOSITORY } from "../../application/donors/donor-record.repository";
import { DonorsController } from "./donors.controller";
import { PrismaAuditEventAdapter } from "../../infrastructure/audit/prisma-audit-event.adapter";
import { AUDIT_EVENT_PORT } from "../../application/audit/audit-event.port";

@Module({
  imports: [AuthModule],
  controllers: [DonorsController],
  providers: [
    CreateDonorUseCase,
    GetDonorUseCase,
    ListDonorsUseCase,
    UpdateDonorUseCase,
    PrismaDonorRecordRepository,
    PrismaAuditEventAdapter,
    {
      provide: DONOR_RECORD_REPOSITORY,
      useExisting: PrismaDonorRecordRepository,
    },
    {
      provide: AUDIT_EVENT_PORT,
      useExisting: PrismaAuditEventAdapter,
    },
  ],
})
export class DonorsModule {}
