import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { DocumentDefinitionValidator } from "../src/application/document-engine/document-definition.validator";

type PilotDefinition = {
  jsonSchema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
  mappingConfig: unknown[];
};

const TEMPLATE_CODE = "anexo-6-extraccion-componentes-v0";
const VERSION_NUMBER = "0.1.0";
const SOURCE_PATH = "docs/documentos-reales/anexo-6-registro-general-de-extraccion.pdf";
const SOURCE_SHA256 = "2AD0386EF94E66D0F48BF4F975B7179B601B1F2B716555E5C17445E282CFE09D";

async function main() {
  const definitionPath = join(__dirname, "anexo-6-definition.json");
  const definition = JSON.parse(await readFile(definitionPath, "utf8")) as PilotDefinition;
  const validator = new DocumentDefinitionValidator();
  validator.validate(definition.jsonSchema, definition.uiSchema, definition.mappingConfig);

  const definitionPayload = {
    jsonSchema: definition.jsonSchema,
    uiSchema: definition.uiSchema,
    mappingConfig: definition.mappingConfig,
    dependencyConfig: undefined,
    generationConfig: undefined,
  };
  const definitionHash = createHash("sha256")
    .update(JSON.stringify(definitionPayload))
    .digest("hex");
  const prisma = new PrismaClient();

  try {
    const adminId = process.env.PILOT_ADMIN_USER_ID;
    const admin = adminId
      ? await prisma.systemUser.findFirst({ where: { id: adminId, role: "ADMIN", isActive: true } })
      : await prisma.systemUser.findFirst({ where: { role: "ADMIN", isActive: true }, orderBy: { createdAt: "asc" } });
    if (!admin) throw new Error("No active ADMIN found; set PILOT_ADMIN_USER_ID.");

    const result = await prisma.$transaction(async (tx) => {
      let template = await tx.documentTemplate.findUnique({ where: { templateCode: TEMPLATE_CODE } });
      if (!template) {
        template = await tx.documentTemplate.create({
          data: {
            templateCode: TEMPLATE_CODE,
            name: "Anexo 6 - Registro general de extracción",
            category: "ANEXO_6",
            metadata: {
              pilotStatus: "DRAFT",
              sourceDocument: { path: SOURCE_PATH, sha256: SOURCE_SHA256, originalStored: false },
            } as Prisma.InputJsonValue,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: admin.id,
            action: "DOCUMENT_TEMPLATE_CREATED",
            entityType: "DOCUMENT_ENGINE",
            entityId: template.id,
            correlationId: `anexo-6-pilot-${template.id}`,
            metadata: { pilot: true, status: "DRAFT", sourcePath: SOURCE_PATH },
          },
        });
      }

      const existing = await tx.templateVersion.findUnique({
        where: { templateId_versionNumber: { templateId: template.id, versionNumber: VERSION_NUMBER } },
      });
      if (existing) {
        if (existing.status !== "DRAFT" || existing.definitionHash !== definitionHash) {
          throw new Error("Existing Anexo 6 version differs or is not DRAFT; no changes made.");
        }
        return { template, version: existing, created: false };
      }

      const version = await tx.templateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: VERSION_NUMBER,
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          status: "DRAFT",
          jsonSchema: definition.jsonSchema as Prisma.InputJsonValue,
          uiSchema: definition.uiSchema as Prisma.InputJsonValue,
          mappingConfig: definition.mappingConfig as Prisma.InputJsonValue,
          definitionHash,
          authorizedById: admin.id,
          createdById: admin.id,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: admin.id,
          action: "TEMPLATE_VERSION_CREATED",
          entityType: "DOCUMENT_ENGINE",
          entityId: version.id,
          correlationId: `anexo-6-pilot-${version.id}`,
          metadata: { pilot: true, status: "DRAFT", sourcePath: SOURCE_PATH },
        },
      });
      return { template, version, created: true };
    });

    console.log(JSON.stringify({
      templateId: result.template.id,
      versionId: result.version.id,
      templateCode: result.template.templateCode,
      versionNumber: result.version.versionNumber,
      status: result.version.status,
      created: result.created,
      definitionHash,
      source: { path: SOURCE_PATH, sha256: SOURCE_SHA256, originalStored: false },
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
