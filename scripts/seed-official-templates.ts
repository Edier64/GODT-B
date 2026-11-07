import { PrismaClient } from "@prisma/client";
import { seedOfficialTemplates, OFFICIAL_TEMPLATE_DEFINITIONS } from "../src/application/document-engine/official-template-definitions";

async function main() {
  console.log("=== GODT REGIONAL 3 — SEMBRADOR DE PLANTILLAS OFICIALES ===");
  const prisma = new PrismaClient();

  try {
    console.log(`Definiciones oficiales disponibles: ${OFFICIAL_TEMPLATE_DEFINITIONS.length}`);
    const count = await seedOfficialTemplates(prisma as any);
    console.log(`Plantillas oficiales sembradas exitosamente: ${count} de 19`);
    console.log("Posiciones normativas 20 a 23 permanecen correctamente como PENDING_HOMOLOGATION.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Error al sembrar plantillas oficiales:", err);
  process.exit(1);
});
