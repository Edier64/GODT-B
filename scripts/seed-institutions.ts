import { PrismaClient } from "@prisma/client";

export function normalizeInstitutionName(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes/diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // sustituir puntuación
    .replace(/\s+/g, " ")
    .trim();
}

export const CANONICAL_REGIONAL_3_INSTITUTIONS = [
  {
    code: "HUV-76001",
    name: "Hospital Universitario del Valle",
    city: "Cali",
    department: "Valle del Cauca",
    complexityLevel: "NIVEL_3_ALTA",
    aliases: [
      "HUV",
      "Hospital Universitario",
      "Universitario del Valle",
      "Hospital Universitario del Valle Evaristo García",
    ],
  },
  {
    code: "IMB-76001",
    name: "Clínica Imbanaco",
    city: "Cali",
    department: "Valle del Cauca",
    complexityLevel: "NIVEL_3_ALTA",
    aliases: [
      "Imbanaco",
      "Centro Médico Imbanaco",
      "Inabaco",
      "Clinica Imbanaco",
      "Clínica Imbanaco Grupo Quirónsalud",
    ],
  },
  {
    code: "OCC-76001",
    name: "Clínica Occidente",
    city: "Cali",
    department: "Valle del Cauca",
    complexityLevel: "NIVEL_3_ALTA",
    aliases: [
      "Occidente",
      "Clinica de Occidente",
      "Clínica de Occidente",
      "Clínica de Occidente S.A.",
    ],
  },
  {
    code: "FVL-76001",
    name: "Fundación Valle del Lili",
    city: "Cali",
    department: "Valle del Cauca",
    complexityLevel: "NIVEL_3_ALTA",
    aliases: [
      "Valle del Lili",
      "Fundacion Valle del Lili",
      "FVL",
      "Lili",
      "Clínica Valle del Lili",
    ],
  },
];

export async function seedInstitutions(prisma: PrismaClient): Promise<number> {
  let count = 0;
  for (const inst of CANONICAL_REGIONAL_3_INSTITUTIONS) {
    const normalizedName = normalizeInstitutionName(inst.name);

    const institution = await prisma.institutionEntity.upsert({
      where: { name: inst.name },
      update: {
        code: inst.code,
        normalizedName,
        city: inst.city,
        department: inst.department,
        complexityLevel: inst.complexityLevel,
        status: "ACTIVE",
      },
      create: {
        code: inst.code,
        name: inst.name,
        normalizedName,
        city: inst.city,
        department: inst.department,
        complexityLevel: inst.complexityLevel,
        status: "ACTIVE",
      },
    });

    for (const alias of inst.aliases) {
      const normalizedAlias = normalizeInstitutionName(alias);
      await prisma.institutionAlias.upsert({
        where: {
          institutionId_normalizedAlias: {
            institutionId: institution.id,
            normalizedAlias,
          },
        },
        update: {
          alias,
        },
        create: {
          institutionId: institution.id,
          alias,
          normalizedAlias,
        },
      });
    }

    count++;
  }

  // Asociar usuarios de prueba (ADMIN, COORDINATOR) a todas las instituciones de Regional 3
  const users = await prisma.systemUser.findMany({
    where: {
      email: {
        in: [
          "admin@godt.gov.co",
          "coordinador@godt.gov.co",
        ],
      },
    },
  });

  const allInstitutions = await prisma.institutionEntity.findMany();

  for (const user of users) {
    for (const inst of allInstitutions) {
      await prisma.userInstitutionScope.upsert({
        where: {
          userId_institutionId: {
            userId: user.id,
            institutionId: inst.id,
          },
        },
        update: {
          status: "APPROVED",
        },
        create: {
          userId: user.id,
          institutionId: inst.id,
          status: "APPROVED",
        },
      });
    }
  }

  return count;
}

if (require.main === module) {
  const p = new PrismaClient();
  seedInstitutions(p)
    .then((c) => {
      console.log(`Instituciones maestras sembradas con éxito: ${c}`);
      return p.$disconnect();
    })
    .catch((err) => {
      console.error("Error sembrando instituciones:", err);
      process.exit(1);
    });
}
