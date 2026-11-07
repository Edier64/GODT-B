import { PrismaClient, UserRole } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const prisma = new PrismaClient();
  const secret = process.env.JWT_SECRET || "local-development-secret-32-characters-minimum-123";
  const issuer = process.env.JWT_ISSUER || "godt-backend";

  const jwtService = new JwtService({
    secret,
    signOptions: {
      issuer,
      expiresIn: "365d",
    },
  });

  console.log("=== GODT REGIONAL 3 — GENERADOR DE TOKENS DEV ===");
  console.log(`Secret configurado: ${secret.substring(0, 10)}...`);
  console.log(`Issuer: ${issuer}`);

  // 1. Upsert Usuario Coordinador
  const coordUser = await prisma.systemUser.upsert({
    where: { id: "a0000000-0000-0000-0000-000000000001" },
    update: {
      email: "coordinador@godt.gov.co",
      fullName: "Dra. Elena Ramos (Coordinadora Regional 3)",
      role: UserRole.COORDINATOR,
      isActive: true,
    },
    create: {
      id: "a0000000-0000-0000-0000-000000000001",
      email: "coordinador@godt.gov.co",
      fullName: "Dra. Elena Ramos (Coordinadora Regional 3)",
      role: UserRole.COORDINATOR,
      isActive: true,
    },
  });

  // 2. Upsert Usuario Administrador
  const adminUser = await prisma.systemUser.upsert({
    where: { id: "a0000000-0000-0000-0000-000000000002" },
    update: {
      email: "admin@godt.gov.co",
      fullName: "Administrador del Sistema GODT",
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      id: "a0000000-0000-0000-0000-000000000002",
      email: "admin@godt.gov.co",
      fullName: "Administrador del Sistema GODT",
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  // Generar Tokens
  const coordinatorToken = jwtService.sign({
    sub: coordUser.id,
    role: coordUser.role,
    email: coordUser.email,
    name: coordUser.fullName,
    institutionalIps: [
      "Hospital Universitario del Valle",
      "Clínica Imbanaco",
      "Clínica Occidente",
      "Fundación Valle del Lili",
    ],
  });

  const adminToken = jwtService.sign({
    sub: adminUser.id,
    role: adminUser.role,
    email: adminUser.email,
    name: adminUser.fullName,
    institutionalIps: [
      "Hospital Universitario del Valle",
      "Clínica Imbanaco",
    ],
  });

  const output = {
    generatedAt: new Date().toISOString(),
    secretUsed: secret,
    issuer,
    users: {
      coordinator: {
        id: coordUser.id,
        email: coordUser.email,
        name: coordUser.fullName,
        role: coordUser.role,
        token: coordinatorToken,
      },
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.fullName,
        role: adminUser.role,
        token: adminToken,
      },
    },
  };

  const outputPath = path.resolve(__dirname, "dev-tokens.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log("\n✅ Usuarios dev sincronizados en PostgreSQL.");
  console.log(`✅ Tokens exportados a: ${outputPath}`);
  console.log("\n------------------------------------------------------------");
  console.log("📌 TOKEN COORDINADOR (Rol: COORDINATOR):");
  console.log(coordinatorToken);
  console.log("\n------------------------------------------------------------");
  console.log("📌 TOKEN ADMINISTRADOR (Rol: ADMIN):");
  console.log(adminToken);
  console.log("------------------------------------------------------------\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error al generar tokens dev:", err);
  process.exit(1);
});

