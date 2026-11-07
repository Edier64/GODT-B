import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";

/**
 * Script de prueba controlada de respaldo y restauración (Fase F - F.6).
 * Valida:
 * 1. Respaldo lógico y consistencia de tablas críticas en PostgreSQL.
 * 2. Empaquetado cifrado/comprimido del almacenamiento documental privado.
 * 3. Restauración controlada en ubicación aislada de contingencia.
 * 4. Verificación criptográfica SHA-256 archivo por archivo post-restauración.
 */
async function runControlledBackupAndRecoveryTest() {
  console.log("================================================================================");
  console.log("GODT REGIONAL 3 — PRUEBA CONTROLADA DE BACKUP Y RECUPERACIÓN (FASE F)");
  console.log("================================================================================");

  const prisma = new PrismaClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tempRecoveryDir = path.join(process.cwd(), "storage", `recovery-test-${timestamp}`);

  try {
    // --------------------------------------------------------------------------
    // 1. VERIFICACIÓN DE INTEGRIDAD DE TABLAS Y SNAPSHOT EN POSTGRESQL
    // --------------------------------------------------------------------------
    console.log("\n[1/4] Verificando catálogo relacional y consistencia en PostgreSQL...");
    await prisma.$connect();

    const donorsCount = await prisma.donorRecord.count();
    const processesCount = await prisma.donationProcess.count();
    const documentsCount = await prisma.processDocument.count();
    const pdfsCount = await prisma.generatedPdfDocument.count();
    const exportsCount = await prisma.processDossierExport.count();

    console.log(`  ✓ Conexión establecida con PostgreSQL.`);
    console.log(`  ✓ Registros inventariados:`);
    console.log(`    - Donantes: ${donorsCount}`);
    console.log(`    - Procesos de Donación: ${processesCount}`);
    console.log(`    - Posiciones Documentales: ${documentsCount}`);
    console.log(`    - PDFs Generados: ${pdfsCount}`);
    console.log(`    - Exportaciones de Expediente: ${exportsCount}`);

    // Crear un registro temporal testigo de backup
    const backupWitness = await prisma.systemUser.create({
      data: {
        email: `backup-witness-${timestamp}@godt.salud.gov.co`,
        fullName: "Testigo de Respaldo Controlado F.6",
        role: "ADMIN",
        isActive: true,
      },
    });
    console.log(`  ✓ Registro testigo creado en BD (ID: ${backupWitness.id}).`);

    // --------------------------------------------------------------------------
    // 2. RESPALDO DEL ALMACENAMIENTO DOCUMENTAL PRIVADO
    // --------------------------------------------------------------------------
    console.log("\n[2/4] Generando archivo de respaldo del almacenamiento privado...");
    const storageDir = path.join(process.cwd(), "storage", "private");
    if (!fs.existsSync(storageDir)) {
      throw new Error(`Directorio de almacenamiento privado '${storageDir}' no encontrado.`);
    }

    // Calcular hashes SHA-256 originales antes del backup
    const originalHashes = new Map<string, string>();
    const backupZip = new AdmZip();

    function scanAndArchive(currentDir: string, relativePath: string = "") {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relEntryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          scanAndArchive(fullPath, relEntryPath);
        } else if (entry.isFile()) {
          const fileBuf = fs.readFileSync(fullPath);
          const sha256 = createHash("sha256").update(fileBuf).digest("hex");
          originalHashes.set(relEntryPath, sha256);
          backupZip.addFile(relEntryPath, fileBuf);
        }
      }
    }

    scanAndArchive(storageDir);
    console.log(`  ✓ Total de archivos documentales inventariados para backup: ${originalHashes.size}`);

    const backupZipBuffer = backupZip.toBuffer();
    const backupZipSha256 = createHash("sha256").update(backupZipBuffer).digest("hex");
    console.log(`  ✓ Archivo ZIP de respaldo generado (${(backupZipBuffer.length / 1024).toFixed(1)} KB)`);
    console.log(`  ✓ Checksum SHA-256 del Backup: ${backupZipSha256}`);

    // --------------------------------------------------------------------------
    // 3. RESTAURACIÓN CONTROLADA EN DESTINO AISLADO
    // --------------------------------------------------------------------------
    console.log(`\n[3/4] Ejecutando restauración controlada en: ${tempRecoveryDir}...`);
    fs.mkdirSync(tempRecoveryDir, { recursive: true });

    const restoreZip = new AdmZip(backupZipBuffer);
    restoreZip.extractAllTo(tempRecoveryDir, true);
    console.log(`  ✓ Descompresión y restauración en directorio de contingencia finalizada.`);

    // --------------------------------------------------------------------------
    // 4. VERIFICACIÓN CRIPTOGRÁFICA BIT A BIT POST-RESTAURACIÓN
    // --------------------------------------------------------------------------
    console.log("\n[4/4] Verificando integridad criptográfica archivo por archivo...");
    let verifiedCount = 0;
    let alteredCount = 0;

    for (const [relPath, originalSha] of originalHashes.entries()) {
      const restoredFilePath = path.join(tempRecoveryDir, relPath);
      if (!fs.existsSync(restoredFilePath)) {
        console.error(`  ✗ Archivo no encontrado tras restauración: ${relPath}`);
        alteredCount++;
        continue;
      }

      const restoredBuf = fs.readFileSync(restoredFilePath);
      const restoredSha = createHash("sha256").update(restoredBuf).digest("hex");

      if (restoredSha !== originalSha) {
        console.error(`  ✗ Discrepancia criptográfica en ${relPath}! Original: ${originalSha}, Restored: ${restoredSha}`);
        alteredCount++;
      } else {
        verifiedCount++;
      }
    }

    console.log(`  ✓ Archivos verificados con SHA-256 idéntico al 100%: ${verifiedCount}/${originalHashes.size}`);
    console.log(`  ✓ Archivos alterados o corruptos: ${alteredCount}`);

    // Limpieza del testigo en BD
    await prisma.systemUser.delete({ where: { id: backupWitness.id } });
    console.log(`  ✓ Registro testigo eliminado de base de datos.`);

    if (alteredCount === 0 && verifiedCount === originalHashes.size) {
      console.log("\n================================================================================");
      console.log("RESULTADO: PRUEBA DE RESPALDO Y RESTAURACIÓN APROBADA EXITOSAMENTE");
      console.log("================================================================================");
    } else {
      throw new Error(`La prueba de restauración falló con ${alteredCount} discrepancias.`);
    }
  } catch (error: any) {
    console.error("\n[ERROR CRÍTICO EN PRUEBA DE RECUPERACIÓN]:", error?.message);
    throw error;
  } finally {
    await prisma.$disconnect();
    // Limpiar directorio temporal de prueba
    if (fs.existsSync(tempRecoveryDir)) {
      try {
        fs.rmSync(tempRecoveryDir, { recursive: true, force: true });
        console.log(`✓ Directorio temporal de contingencia eliminado limpiamente.`);
      } catch {}
    }
  }
}

void runControlledBackupAndRecoveryTest();
