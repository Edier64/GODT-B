import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  levenshteinDistance,
  normalizeString,
  stringSimilarity,
} from "./normalization.helper";

export interface InstitutionSearchResult {
  id: string;
  name: string;
  code: string | null;
  city: string;
  department: string | null;
  complexityLevel: string | null;
  hasUserAccess: boolean;
  matchType: "EXACT" | "ALIAS" | "PARTIAL" | "APPROXIMATE";
  matchedAlias?: string;
  suggestionMessage?: string;
}

export interface CreateInstitutionInput {
  name: string;
  code?: string;
  city: string;
  department?: string;
  complexityLevel?: string;
  aliases?: string[];
  confirmNonDuplicate?: boolean;
}

export const OFFICIAL_CLINICAL_SERVICES = [
  "UCI Adultos",
  "UCI Pediátrica",
  "UCI Neonatal",
  "UCI Neurocríticos",
  "UCI Cardiovascular",
  "Urgencias / Trauma",
  "Urgencias Médicas",
  "Quirófano de Extracción",
  "Quirófano Central",
  "Hospitalización Neurocirugía",
  "Hospitalización General",
];

@Injectable()
export class InstitutionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Búsqueda inteligente con debounce, normalización, alias y detección de similitud
   */
  async searchInstitutions(
    query: string,
    user: AuthenticatedUser,
  ): Promise<{ results: InstitutionSearchResult[]; queryNormalized: string }> {
    const qNorm = normalizeString(query);
    if (!qNorm) {
      // Si la consulta está vacía, devolver las instituciones activas de mayor relevancia
      const topInsts = await this.prisma.institutionEntity.findMany({
        where: { status: "ACTIVE" },
        take: 10,
        orderBy: { name: "asc" },
        include: {
          aliases: true,
          userScopes: {
            where: { userId: user.userId, status: "APPROVED" },
          },
        },
      });

      return {
        queryNormalized: "",
        results: topInsts.map((i) => ({
          id: i.id,
          name: i.name,
          code: i.code,
          city: i.city,
          department: i.department,
          complexityLevel: i.complexityLevel,
          hasUserAccess:
            user.role === "ADMIN" ||
            i.userScopes.length > 0 ||
            Boolean(user.institutionalIps?.includes(i.name)),
          matchType: "EXACT",
        })),
      };
    }

    // Cargar todas las instituciones y alias activos para búsqueda y cálculo de similaridad
    const allInstitutions = await this.prisma.institutionEntity.findMany({
      where: { status: "ACTIVE" },
      include: {
        aliases: true,
        userScopes: {
          where: { userId: user.userId, status: "APPROVED" },
        },
      },
    });

    const results: InstitutionSearchResult[] = [];
    const addedIds = new Set<string>();

    // 1. Coincidencia exacta por nombre normalizado
    for (const inst of allInstitutions) {
      const hasAccess =
        user.role === "ADMIN" ||
        inst.userScopes.length > 0 ||
        Boolean(user.institutionalIps?.includes(inst.name));

      if (inst.normalizedName === qNorm) {
        results.push({
          id: inst.id,
          name: inst.name,
          code: inst.code,
          city: inst.city,
          department: inst.department,
          complexityLevel: inst.complexityLevel,
          hasUserAccess: hasAccess,
          matchType: "EXACT",
        });
        addedIds.add(inst.id);
      }
    }

    // 2. Coincidencia exacta por alias normalizado
    for (const inst of allInstitutions) {
      if (addedIds.has(inst.id)) continue;
      const matchedAlias = inst.aliases.find((a) => a.normalizedAlias === qNorm);
      if (matchedAlias) {
        const hasAccess =
          user.role === "ADMIN" ||
          inst.userScopes.length > 0 ||
          Boolean(user.institutionalIps?.includes(inst.name));

        results.push({
          id: inst.id,
          name: inst.name,
          code: inst.code,
          city: inst.city,
          department: inst.department,
          complexityLevel: inst.complexityLevel,
          hasUserAccess: hasAccess,
          matchType: "ALIAS",
          matchedAlias: matchedAlias.alias,
        });
        addedIds.add(inst.id);
      }
    }

    // 3. Coincidencia parcial (starts-with o contains)
    for (const inst of allInstitutions) {
      if (addedIds.has(inst.id)) continue;
      const nameContains = inst.normalizedName.includes(qNorm);
      const aliasMatch = inst.aliases.find((a) => a.normalizedAlias.includes(qNorm));

      if (nameContains || aliasMatch) {
        const hasAccess =
          user.role === "ADMIN" ||
          inst.userScopes.length > 0 ||
          Boolean(user.institutionalIps?.includes(inst.name));

        results.push({
          id: inst.id,
          name: inst.name,
          code: inst.code,
          city: inst.city,
          department: inst.department,
          complexityLevel: inst.complexityLevel,
          hasUserAccess: hasAccess,
          matchType: "PARTIAL",
          matchedAlias: aliasMatch ? aliasMatch.alias : undefined,
        });
        addedIds.add(inst.id);
      }
    }

    // 4. Coincidencias aproximadas / similares (Levenshtein / similitud fonética/tipográfica)
    // Útil para errores tipográficos comunes: "Inabaco" -> "Clínica Imbanaco"
    for (const inst of allInstitutions) {
      if (addedIds.has(inst.id)) continue;

      let highestSim = stringSimilarity(qNorm, inst.normalizedName);
      let matchedAliasName: string | undefined;

      for (const alias of inst.aliases) {
        const sim = stringSimilarity(qNorm, alias.normalizedAlias);
        if (sim > highestSim) {
          highestSim = sim;
          matchedAliasName = alias.alias;
        }
      }

      // Si la similaridad es suficiente o la distancia de edición es <= 2
      const isCloseEdit =
        levenshteinDistance(qNorm, inst.normalizedName) <= 2 ||
        inst.aliases.some((a) => levenshteinDistance(qNorm, a.normalizedAlias) <= 2);

      if (highestSim >= 0.65 || isCloseEdit) {
        const hasAccess =
          user.role === "ADMIN" ||
          inst.userScopes.length > 0 ||
          Boolean(user.institutionalIps?.includes(inst.name));

        results.push({
          id: inst.id,
          name: inst.name,
          code: inst.code,
          city: inst.city,
          department: inst.department,
          complexityLevel: inst.complexityLevel,
          hasUserAccess: hasAccess,
          matchType: "APPROXIMATE",
          matchedAlias: matchedAliasName,
          suggestionMessage: `Encontramos una institución que podría corresponder a la que buscas (${inst.name})`,
        });
        addedIds.add(inst.id);
      }
    }

    return {
      queryNormalized: qNorm,
      results,
    };
  }

  /**
   * Resuelve el nombre canónico y la autorización de una IPS para apertura de procesos
   */
  async resolveIpsForProcess(
    rawIpsName: string,
    user: AuthenticatedUser,
  ): Promise<{ canonicalName: string; institutionId: string }> {
    const qNorm = normalizeString(rawIpsName);

    // Buscar en BD por nombre canónico o alias
    const all = await this.prisma.institutionEntity.findMany({
      where: { status: "ACTIVE" },
      include: {
        aliases: true,
        userScopes: {
          where: { userId: user.userId, status: "APPROVED" },
        },
      },
    });

    const match = all.find(
      (i) =>
        i.normalizedName === qNorm ||
        i.aliases.some((a) => a.normalizedAlias === qNorm),
    );

    if (match) {
      const isAuthorized =
        user.role === "ADMIN" ||
        match.userScopes.length > 0 ||
        Boolean(user.institutionalIps?.includes(match.name)) ||
        Boolean(
          user.institutionalIps?.some(
            (ips) =>
              normalizeString(ips) === match.normalizedName ||
              match.aliases.some((a) => a.normalizedAlias === normalizeString(ips)),
          ),
        );

      if (!isAuthorized) {
        throw new ForbiddenException(
          `Esta institución ya existe ('${match.name}'), pero actualmente no tienes autorización para abrir procesos en ella. Puedes solicitar la asociación institucional desde la interfaz.`,
        );
      }

      return {
        canonicalName: match.name,
        institutionId: match.id,
      };
    }

    // Si no coincide exactamente con ninguna en la base de datos maestra
    // Si el usuario es ADMIN, permitir el nombre ingresado directamente
    if (user.role === "ADMIN") {
      return {
        canonicalName: rawIpsName.trim(),
        institutionId: "",
      };
    }

    // Si el usuario tiene la IPS textual en su token o scope legado
    if (user.institutionalIps?.includes(rawIpsName.trim())) {
      return {
        canonicalName: rawIpsName.trim(),
        institutionId: "",
      };
    }

    // Buscar si hay alguna similar para advertir
    const candidates = all.filter((i) => {
      return (
        stringSimilarity(qNorm, i.normalizedName) >= 0.7 ||
        i.aliases.some((a) => stringSimilarity(qNorm, a.normalizedAlias) >= 0.7)
      );
    });

    if (candidates.length > 0) {
      throw new ForbiddenException(
        `No encontramos una IPS autorizada con el nombre exacto '${rawIpsName}'. Encontramos una institución que podría corresponder: '${candidates[0].name}'. Selecciónala del buscador o solicita autorización.`,
      );
    }

    throw new ForbiddenException(
      `No tiene autorización para abrir un proceso en la IPS '${rawIpsName}'. Debe seleccionar una IPS autorizada o registrarla si cuenta con permisos administrativos.`,
    );
  }

  /**
   * Creación controlada de nueva entidad institucional (con prevención de duplicados)
   */
  async createInstitution(
    input: CreateInstitutionInput,
    user: AuthenticatedUser,
  ): Promise<InstitutionSearchResult> {
    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      throw new ForbiddenException(
        "No tiene permisos para crear nuevas IPS. Solicite el alta al administrador de la Red Regional.",
      );
    }

    const name = input.name?.trim();
    if (!name) {
      throw new ConflictException("El nombre institucional es obligatorio");
    }

    const normalizedName = normalizeString(name);

    // 1. Verificar si ya existe idéntica
    const existing = await this.prisma.institutionEntity.findFirst({
      where: {
        OR: [
          { normalizedName },
          { aliases: { some: { normalizedAlias: normalizedName } } },
        ],
      },
      include: { aliases: true },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una institución registrada con este nombre o alias canónico: '${existing.name}'. Selecciónala del autocompletado en lugar de crear una duplicada.`,
      );
    }

    // 2. Si no se confirmó explícitamente y existe una muy similar, advertir
    if (!input.confirmNonDuplicate) {
      const all = await this.prisma.institutionEntity.findMany({
        where: { status: "ACTIVE" },
        include: { aliases: true },
      });

      for (const inst of all) {
        const sim = stringSimilarity(normalizedName, inst.normalizedName);
        if (sim >= 0.8 || levenshteinDistance(normalizedName, inst.normalizedName) <= 2) {
          throw new ConflictException({
            statusCode: 409,
            message: `Encontramos una institución que podría corresponder a la que intentas crear: '${inst.name}' (${inst.city}). Confirma si se trata de una entidad distinta para continuar.`,
            potentialDuplicate: {
              id: inst.id,
              name: inst.name,
              city: inst.city,
            },
            requiresConfirmation: true,
          });
        }
      }
    }

    // 3. Crear entidad y asociar automáticamente al usuario creador
    const institution = await this.prisma.institutionEntity.create({
      data: {
        name,
        normalizedName,
        code: input.code?.trim() || null,
        city: input.city?.trim() || "Cali",
        department: input.department?.trim() || "Valle del Cauca",
        complexityLevel: input.complexityLevel || "NIVEL_3_ALTA",
        createdById: user.userId,
        status: "ACTIVE",
        aliases: input.aliases?.length
          ? {
              create: input.aliases.map((a) => ({
                alias: a.trim(),
                normalizedAlias: normalizeString(a),
              })),
            }
          : undefined,
        userScopes: {
          create: {
            userId: user.userId,
            status: "APPROVED",
            approvedAt: new Date(),
          },
        },
      },
    });

    return {
      id: institution.id,
      name: institution.name,
      code: institution.code,
      city: institution.city,
      department: institution.department,
      complexityLevel: institution.complexityLevel,
      hasUserAccess: true,
      matchType: "EXACT",
    };
  }

  /**
   * Solicitar asociación a una IPS existente
   */
  async requestAssociation(
    institutionId: string,
    user: AuthenticatedUser,
  ): Promise<{ message: string; status: string }> {
    const institution = await this.prisma.institutionEntity.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException("La institución solicitada no existe.");
    }

    const isAutoApproved = user.role === "ADMIN";
    const status = isAutoApproved ? "APPROVED" : "PENDING_APPROVAL";

    await this.prisma.userInstitutionScope.upsert({
      where: {
        userId_institutionId: {
          userId: user.userId,
          institutionId,
        },
      },
      update: {
        status,
        approvedAt: isAutoApproved ? new Date() : undefined,
      },
      create: {
        userId: user.userId,
        institutionId,
        status,
        approvedAt: isAutoApproved ? new Date() : undefined,
      },
    });

    return {
      message: isAutoApproved
        ? `Asociación a '${institution.name}' aprobada inmediatamente con rol Administrador.`
        : `Solicitud de asociación a '${institution.name}' enviada para aprobación administrativa.`,
      status,
    };
  }

  /**
   * Catálogo de Servicios Clínicos institucionales
   */
  getClinicalServices(query?: string): string[] {
    if (!query || !query.trim()) return OFFICIAL_CLINICAL_SERVICES;
    const qNorm = normalizeString(query);
    return OFFICIAL_CLINICAL_SERVICES.filter((s) =>
      normalizeString(s).includes(qNorm),
    );
  }

  /**
   * Catálogo de Profesionales del Sistema
   */
  async searchProfessionals(
    query?: string,
  ): Promise<Array<{ id: string; fullName: string; role: string; professionalId: string | null }>> {
    const qNorm = query ? normalizeString(query) : "";
    const users = await this.prisma.systemUser.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        role: true,
        professionalId: true,
      },
      take: 20,
    });

    if (!qNorm) return users;
    return users.filter(
      (u) =>
        normalizeString(u.fullName).includes(qNorm) ||
        (u.professionalId && normalizeString(u.professionalId).includes(qNorm)),
    );
  }
}
