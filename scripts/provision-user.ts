import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import * as argon2 from "argon2";
import * as readline from "readline";
import { Writable } from "stream";

const ARGON2ID_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
};

interface ProvisionArgs {
  email?: string;
  fullName?: string;
  role?: UserRole;
  professionalId?: string;
  ipsNames?: string[];
  allActiveInstitutions: boolean;
  isActive?: boolean;
  updatePassword: boolean;
  revokeSessions: boolean;
}

function parseCliArgs(argv: string[]): ProvisionArgs {
  const result: ProvisionArgs = {
    allActiveInstitutions: false,
    updatePassword: false,
    revokeSessions: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--password" || arg.startsWith("--password=")) {
      throw new Error(
        "Por seguridad no se permite pasar --password como argumento visible del shell. Use el prompt interactivo sin eco o la variable de entorno temporal PROVISION_USER_PASSWORD.",
      );
    }

    const next = (): string => {
      const val = argv[i + 1];
      if (!val || val.startsWith("--")) {
        throw new Error(`Falta valor para el argumento ${arg}`);
      }
      i += 1;
      return val;
    };

    switch (arg) {
      case "--email":
        result.email = next().trim().toLowerCase();
        break;
      case "--name":
      case "--full-name":
        result.fullName = next().trim();
        break;
      case "--role": {
        const rawRole = next().trim().toUpperCase();
        if (!Object.values(UserRole).includes(rawRole as UserRole)) {
          throw new Error(
            `Rol inválido '${rawRole}'. Valores permitidos: ${Object.values(UserRole).join(", ")}`,
          );
        }
        result.role = rawRole as UserRole;
        break;
      }
      case "--professional-id":
        result.professionalId = next().trim();
        break;
      case "--ips":
        result.ipsNames = next()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--all-active-institutions":
        result.allActiveInstitutions = true;
        break;
      case "--active": {
        const rawActive = next().trim().toLowerCase();
        if (rawActive !== "true" && rawActive !== "false") {
          throw new Error("El valor de --active debe ser 'true' o 'false'.");
        }
        result.isActive = rawActive === "true";
        break;
      }
      case "--update-password":
        result.updatePassword = true;
        break;
      case "--revoke-sessions":
        result.revokeSessions = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
      default:
        throw new Error(`Argumento desconocido: ${arg}`);
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
Uso:
  npm run auth:provision-user -- --email <correo> [--name "<nombre>"] [--role <ADMIN|COORDINATOR|SURGEON|TECHNICIAN>] [--ips "<IPS 1>,<IPS 2>"] [--active true|false] [--update-password] [--revoke-sessions]

Opciones de contraseña (seguras, nunca como argumento CLI):
  1. Interactivo sin eco en consola (recomendado).
  2. Variable de entorno temporal PROVISION_USER_PASSWORD (útil para automatización controlada).
`);
}

async function promptHidden(promptLabel: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error(
      "La entrada estándar no es interactiva (TTY). Defina temporalmente PROVISION_USER_PASSWORD en el entorno.",
    );
  }

  return new Promise((resolve, reject) => {
    let muted = false;
    const mutableStdout = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      },
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true,
    });

    process.stdout.write(promptLabel);
    muted = true;

    rl.question("", (answer) => {
      muted = false;
      process.stdout.write("\n");
      rl.close();
      resolve(answer);
    });

    rl.on("SIGINT", () => {
      muted = false;
      process.stdout.write("\n");
      rl.close();
      reject(new Error("Operación cancelada por el operador."));
    });
  });
}

async function obtainValidatedPassword(): Promise<string> {
  const envPwd = process.env.PROVISION_USER_PASSWORD;
  if (typeof envPwd === "string" && envPwd.length > 0) {
    delete process.env.PROVISION_USER_PASSWORD;
    validatePasswordStrength(envPwd);
    return envPwd;
  }

  const pwd1 = await promptHidden("Nueva contraseña institucional (mín. 12 caracteres): ");
  validatePasswordStrength(pwd1);
  const pwd2 = await promptHidden("Confirme la contraseña institucional: ");
  if (pwd1 !== pwd2) {
    throw new Error("Las contraseñas ingresadas no coinciden.");
  }
  return pwd1;
}

function validatePasswordStrength(pwd: string): void {
  if (!pwd || pwd.length < 12) {
    throw new Error("La contraseña institucional debe tener al menos 12 caracteres.");
  }
  if (pwd.length > 128) {
    throw new Error("La contraseña institucional no puede superar los 128 caracteres.");
  }
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.email) {
    printUsage();
    throw new Error("El parámetro --email es obligatorio.");
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.systemUser.findUnique({
      where: { email: args.email },
      include: { credential: true },
    });

    if (!existing && (!args.fullName || !args.role)) {
      throw new Error(
        "Para crear un usuario nuevo debe especificar --name y --role.",
      );
    }

    const needPassword =
      !existing || !existing.credential || args.updatePassword || Boolean(process.env.PROVISION_USER_PASSWORD);

    let passwordHash: string | undefined;
    if (needPassword) {
      const plainPassword = await obtainValidatedPassword();
      passwordHash = (await argon2.hash(plainPassword, ARGON2ID_OPTIONS)) as string;
    }

    const user = existing
      ? await prisma.systemUser.update({
          where: { id: existing.id },
          data: {
            fullName: args.fullName ?? existing.fullName,
            role: args.role ?? existing.role,
            professionalId: args.professionalId ?? existing.professionalId,
            isActive: args.isActive ?? existing.isActive,
          },
        })
      : await prisma.systemUser.create({
          data: {
            email: args.email,
            fullName: args.fullName!,
            role: args.role!,
            professionalId: args.professionalId ?? null,
            isActive: args.isActive ?? true,
          },
        });

    if (passwordHash) {
      const now = new Date();
      await prisma.userCredential.upsert({
        where: { userId: user.id },
        update: {
          passwordHash,
          passwordUpdatedAt: now,
        },
        create: {
          userId: user.id,
          passwordHash,
          passwordUpdatedAt: now,
        },
      });
    }

    let linkedInstitutions = 0;
    if (args.allActiveInstitutions) {
      const activeInstitutions = await prisma.institutionEntity.findMany({
        where: { status: "ACTIVE" },
      });
      for (const inst of activeInstitutions) {
        await prisma.userInstitutionScope.upsert({
          where: { userId_institutionId: { userId: user.id, institutionId: inst.id } },
          update: { status: "APPROVED", approvedAt: new Date() },
          create: {
            userId: user.id,
            institutionId: inst.id,
            status: "APPROVED",
            approvedAt: new Date(),
          },
        });
        linkedInstitutions += 1;
      }
    } else if (args.ipsNames && args.ipsNames.length > 0) {
      for (const ipsName of args.ipsNames) {
        const inst = await prisma.institutionEntity.findFirst({
          where: { name: ipsName, status: "ACTIVE" },
        });
        if (!inst) {
          throw new Error(
            `La institución '${ipsName}' no existe o no está ACTIVE en INSTITUTION_ENTITY.`,
          );
        }
        await prisma.userInstitutionScope.upsert({
          where: { userId_institutionId: { userId: user.id, institutionId: inst.id } },
          update: { status: "APPROVED", approvedAt: new Date() },
          create: {
            userId: user.id,
            institutionId: inst.id,
            status: "APPROVED",
            approvedAt: new Date(),
          },
        });
        linkedInstitutions += 1;
      }
    }

    const shouldRevokeSessions =
      Boolean(passwordHash) || args.revokeSessions || args.isActive === false;
    if (shouldRevokeSessions) {
      await prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revocationReason:
            args.isActive === false
              ? "USER_DEACTIVATED"
              : passwordHash
                ? "PASSWORD_ROTATED"
                : "ADMIN_PROVISION_RESET",
        },
      });
    }

    console.log(
      JSON.stringify(
        {
          action: existing ? "updated" : "created",
          userId: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          credentialProvisioned: Boolean(passwordHash || existing?.credential),
          linkedInstitutions,
          sessionsRevoked: shouldRevokeSessions,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(
    "[auth:provision-user] Error:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
