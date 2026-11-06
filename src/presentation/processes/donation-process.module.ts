import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DonationProcessController } from "./donation-process.controller";
import { CreateDonationProcessUseCase } from "../../application/processes/create-donation-process.use-case";
import { GetDonationProcessUseCase } from "../../application/processes/get-donation-process.use-case";
import { ListDonationProcessesUseCase } from "../../application/processes/list-donation-processes.use-case";
import { UpdateDonationProcessUseCase } from "../../application/processes/update-donation-process.use-case";
import { AddProcessInstitutionUseCase } from "../../application/processes/add-institution.use-case";
import { AddProcessParticipantUseCase } from "../../application/processes/add-participant.use-case";
import { PrismaDonationProcessRepository } from "../../infrastructure/processes/prisma-donation-process.repository";
import { DONATION_PROCESS_REPOSITORY } from "../../application/processes/donation-process.repository";
import { PrismaDonorRecordRepository } from "../../infrastructure/donors/prisma-donor-record.repository";
import { DONOR_RECORD_REPOSITORY } from "../../application/donors/donor-record.repository";
import { PrismaAuditEventAdapter } from "../../infrastructure/audit/prisma-audit-event.adapter";
import { AUDIT_EVENT_PORT } from "../../application/audit/audit-event.port";
import { PrismaProcessPackageRepository } from "../../infrastructure/packages/prisma-process-package.repository";
import { PROCESS_PACKAGE_REPOSITORY } from "../../application/packages/process-package.repository";

@Module({
  imports: [AuthModule],
  controllers: [DonationProcessController],
  providers: [
    CreateDonationProcessUseCase,
    GetDonationProcessUseCase,
    ListDonationProcessesUseCase,
    UpdateDonationProcessUseCase,
    AddProcessInstitutionUseCase,
    AddProcessParticipantUseCase,
    PrismaDonationProcessRepository,
    PrismaDonorRecordRepository,
    PrismaAuditEventAdapter,
    PrismaProcessPackageRepository,
    {
      provide: DONATION_PROCESS_REPOSITORY,
      useExisting: PrismaDonationProcessRepository,
    },
    {
      provide: DONOR_RECORD_REPOSITORY,
      useExisting: PrismaDonorRecordRepository,
    },
    {
      provide: AUDIT_EVENT_PORT,
      useExisting: PrismaAuditEventAdapter,
    },
    {
      provide: PROCESS_PACKAGE_REPOSITORY,
      useExisting: PrismaProcessPackageRepository,
    },
  ],
  exports: [
    DONATION_PROCESS_REPOSITORY,
    CreateDonationProcessUseCase,
    GetDonationProcessUseCase,
  ],
})

export class DonationProcessModule {}

