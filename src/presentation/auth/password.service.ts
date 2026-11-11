import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import * as argon2 from "argon2";
import { timingSafeEqual } from "crypto";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

export const ARGON2ID_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  // Parámetros recomendados por OWASP viables para VM Azure Standard_B2als_v2 (2 vCPU, 4 GiB RAM):
  // 19 MiB (19456 KiB), 2 iteraciones, paralelismo 1.
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
};

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private dummyHashPromise?: Promise<string>;

  constructor(private readonly prisma: PrismaService) {}

  async hashPassword(plainPassword: string): Promise<string> {
    if (typeof plainPassword !== "string" || plainPassword.trim().length === 0) {
      throw new BadRequestException("La contraseña no puede estar vacía.");
    }
    if (plainPassword.length > 128) {
      throw new BadRequestException("La contraseña excede la longitud máxima permitida.");
    }

    return argon2.hash(plainPassword, ARGON2ID_OPTIONS) as Promise<string>;
  }

  async verifyPassword(passwordHash: string, plainPassword: string): Promise<boolean> {
    if (
      typeof passwordHash !== "string" ||
      !passwordHash.startsWith("$argon2id$") ||
      typeof plainPassword !== "string" ||
      plainPassword.length === 0 ||
      plainPassword.length > 128
    ) {
      return false;
    }

    try {
      return await argon2.verify(passwordHash, plainPassword);
    } catch {
      this.logger.warn("Error verificando hash de contraseña almacenado.");
      return false;
    }
  }

  /**
   * Ejecuta una verificación dummy con tiempo constante aproximado cuando el usuario
   * no existe o no tiene credencial provisionada, evitando filtración por timing.
   */
  async verifyDummy(plainPassword: string): Promise<void> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = argon2.hash(
        "godt-dummy-constant-time-verification-secret",
        ARGON2ID_OPTIONS,
      ) as Promise<string>;
    }
    try {
      const dummyHash = await this.dummyHashPromise;
      if (dummyHash) {
        await argon2.verify(dummyHash, plainPassword || "dummy");
      }
    } catch {
      // Ignorar errores en verificación dummy
    }
  }

  needsRehash(passwordHash: string): boolean {
    if (!passwordHash || !passwordHash.startsWith("$argon2id$")) {
      return true;
    }
    try {
      return argon2.needsRehash(passwordHash, ARGON2ID_OPTIONS);
    } catch {
      return true;
    }
  }

  async updateUserPassword(userId: string, newPlainPassword: string): Promise<void> {
    const passwordHash = await this.hashPassword(newPlainPassword);
    const now = new Date();
    await this.prisma.userCredential.upsert({
      where: { userId },
      update: {
        passwordHash,
        passwordUpdatedAt: now,
      },
      create: {
        userId,
        passwordHash,
        passwordUpdatedAt: now,
      },
    });
  }

  timingSafeEqualHex(hexA: string, hexB: string): boolean {
    if (typeof hexA !== "string" || typeof hexB !== "string") {
      return false;
    }
    const bufA = Buffer.from(hexA, "hex");
    const bufB = Buffer.from(hexB, "hex");
    if (bufA.length === 0 || bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }
}
