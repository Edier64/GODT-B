import * as fs from "fs";
import * as path from "path";
import { InstitutionalDocumentService } from "../src/application/pdf/institutional-document.service";
import { PdfRenderEngineService } from "../src/application/pdf/pdf-render-engine.service";

async function main() {
  const outDir = path.resolve(__dirname, "../test-output");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const instDocs = new InstitutionalDocumentService();
  const engine = new PdfRenderEngineService(instDocs);

  console.log("Generando Anexos 1, 2 y 3 finales con motor oficial GODT...");

  // 1. ANEXO 1
  const anexo1Input = {
    documentCode: "ANEXO_1",
    title: "Anexo 1: Formato de Valoración y Alerta del Posible Donante",
    data: {
      codigoRnd: "RND-2026-VAL-00892",
      fechaNotificacion: "2026-11-19",
      horaNotificacion: "14:30",
      medicoCoordinador: "Dra. María Carmona",
      regionalGeneradora: "Regional 3",
      ipsGeneradora: "Hospital Universitario del Valle",
      nombreDonante: "Juan David Pérez González",
      tipoIdentificacion: "CC",
      numeroIdentificacion: "1144123456",
      edad: 28,
      sexo: "MASCULINO",
      etnia: "MESTIZO",
      nacionalidad: "Colombiana",
      fechaIngresoIps: "2026-11-18",
      horaIngresoIps: "08:15",
      glasgowIngreso: 7,
      glasgowAlerta: 3,
      grupoSanguineo: "O",
      factorRh: "POSITIVO",
      grupoSanguineoDeterminadoPor: "LABORATORIO",
      servicioHospitalario: "UCI Adultos - Cama 12",
      remitido: true,
      estanciaHospitalariaDias: 2,
      diagnosticoPosibleDonante: "Trauma craneoencefálico severo cerrado con hemorragia subaracnoidea Fisher IV y edema cerebral difuso",
      pesoKg: 72,
      tallaCm: 175,
      perimetroAbdominalCm: 84,
      perimetroToracicoCm: 96,
      imc: 23.5,
      tensionArterialSistolica: 120,
      tensionArterialDiastolica: 80,
      frecuenciaCardiaca: 82,
      temperaturaCorporal: 36.6,
      spo2: 98,
      diuresisCcHora: 95,
      labHb: 13.5,
      labHto: 40.5,
      labLeucocitos: 11200,
      labPlaquetas: 215000,
      labCreatinina: 0.95,
      labPh: 7.38,
      labPco2: 38,
      labPo2: 95,
      labSodio: 140,
      labPotasio: 4.1,
      labInr: 1.05,
      medicamentos: [
        { nombre: "Noradrenalina", dosisActual: "0.08 mcg/kg/min", fechaInicio: "2026-11-18 10:00", fechaFin: "2026-11-19 14:00", dosisMaxima: "0.2 mcg/kg/min" },
        { nombre: "Fentanilo", dosisActual: "100 mcg/h", fechaInicio: "2026-11-18 08:30", fechaFin: "2026-11-19 12:00", dosisMaxima: "150 mcg/h" },
        { nombre: "Midazolam", dosisActual: "5 mg/h", fechaInicio: "2026-11-18 08:30", fechaFin: "2026-11-19 06:00", dosisMaxima: "10 mg/h" },
        { nombre: "Levotiroxina", dosisActual: "200 mcg IV", fechaInicio: "2026-11-19 08:00", fechaFin: "2026-11-19 14:00", dosisMaxima: "200 mcg" },
        { nombre: "Metilprednisolona", dosisActual: "1 g IV", fechaInicio: "2026-11-19 09:00", fechaFin: "2026-11-19 09:30", dosisMaxima: "1 g" },
        { nombre: "Desmopresina", dosisActual: "2 mcg IV", fechaInicio: "2026-11-19 11:00", fechaFin: "2026-11-19 14:00", dosisMaxima: "4 mcg" },
      ],
      observacionesAlerta: "Protocolo de mantenimiento hemodinámico y hormonal activo. Angiografía cerebral de cuatro vasos programada para confirmación.",
    },
    metadata: {
      processCode: "PROC-2026-0099",
      rndCode: "RND-2026-VAL-00892",
      donorName: "Juan David Pérez González",
      donorDocument: "1144123456",
      primaryIpsName: "Hospital Universitario del Valle",
      revisionNumber: 1,
      templateVersion: "3.0.0",
      generatedAt: new Date("2026-11-19T14:30:00.000Z"),
      generatedByName: "Dra. María Carmona",
      snapshotDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
  };

  const anexo1Buffer = await engine.render(anexo1Input);
  const anexo1Path = path.join(outDir, "ANEXO_1_final_verificado.pdf");
  fs.writeFileSync(anexo1Path, anexo1Buffer);
  console.log(`✓ Anexo 1 guardado en: ${anexo1Path} (${anexo1Buffer.length} bytes)`);

  // 2. ANEXO 2
  const anexo2Input = {
    documentCode: "ANEXO_2",
    title: "Anexo 2: Notificación a los Deudos sobre la Ley 1805 de 2016",
    data: {
      coordinadorNombre: "Dra. María Carmona",
      coordinadorDocumento: "31876543",
      ipsGeneradora: "Hospital Universitario del Valle",
      fallecidoNombre: "Juan David Pérez González",
      fallecidoTipoDocumento: "Cédula de Ciudadanía",
      fallecidoDocumento: "1144123456",
      codigoConsultaRnd: "RND-2026-VAL-00892",
      entidadRnd: "Instituto Nacional de Salud",
      horaRnd: "14:30",
      fechaRnd: "2026-11-19",
      notificadoNombre: "Ana Patricia González Restrepo",
      notificadoDocumento: "38987654",
      notificadoParentesco: "Madre (Primer Grado de Consanguinidad)",
      ciudadNotificacion: "Santiago de Cali",
      fechaNotificacion: "2026-11-19",
      segundaPersonaNombre: "Carlos Alberto Pérez Ortiz",
      segundaPersonaDocumento: "16789123",
      segundaPersonaParentesco: "Padre (Primer Grado de Consanguinidad)",
      coordinadorCargo: "Coordinador Operativo de Trasplantes",
      testigoNombre: "Lic. Andrea Morales Rivas",
      testigoDocumento: "66778899",
      testigoCargo: "Trabajadora Social Hospitalaria",
      observaciones: "Se realiza notificación formal a los familiares directos sobre la vigencia de la presunción legal de donación (Ley 1805 de 2016). No se evidencia oposición expresa registrada en el Registro Nacional de Donantes del INS.",
    },
    metadata: {
      processCode: "PROC-2026-0099",
      rndCode: "RND-2026-VAL-00892",
      donorName: "Juan David Pérez González",
      donorDocument: "1144123456",
      primaryIpsName: "Hospital Universitario del Valle",
      revisionNumber: 1,
      templateVersion: "2.1.0",
      generatedAt: new Date("2026-11-19T15:15:00.000Z"),
      generatedByName: "Dra. María Carmona",
      snapshotDigest: "f4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afb",
    },
  };

  const anexo2Buffer = await engine.render(anexo2Input);
  const anexo2Path = path.join(outDir, "ANEXO_2_final_verificado.pdf");
  fs.writeFileSync(anexo2Path, anexo2Buffer);
  console.log(`✓ Anexo 2 guardado en: ${anexo2Path} (${anexo2Buffer.length} bytes)`);

  // 3. ANEXO 3
  const anexo3Input = {
    documentCode: "ANEXO_3",
    title: "Anexo 3: Formato de Consentimiento Informado Familiar",
    data: {
      fechaConsentimiento: "2026-11-19",
      horaConsentimiento: "15:45",
      ciudadConsentimiento: "Santiago de Cali",
      representanteNombre: "Ana Patricia González Restrepo",
      representanteTipoDocumento: "CC",
      representanteDocumento: "38987654",
      representanteLugarExpedicion: "Cali",
      parentesco: "Madre (Primer Grado de Consanguinidad)",
      segundoRepresentanteNombre: "Carlos Alberto Pérez Ortiz",
      segundoRepresentanteDocumento: "16789123",
      segundoRepresentanteLugarExpedicion: "Cali",
      segundoRepresentanteParentesco: "Padre",
      fallecidoNombre: "Juan David Pérez González",
      fallecidoTipoDocumento: "Cédula de Ciudadanía",
      fallecidoDocumento: "1144123456",
      fallecidoLugarExpedicion: "Cali",
      autorizaExtraccion: true,
      autorizaDonacion: true,
      finalidadTrasplante: true,
      organosAutorizados: "Autorización expresa para donación de órganos (corazón, pulmones, hígado, riñones) y tejidos (córneas, piel, tejido osteomuscular) con fines terapéuticos y de trasplante.",
      testigoNombre: "Lic. Andrea Morales Rivas",
      testigoDocumento: "66778899",
      testigoCargo: "Trabajadora Social Hospitalaria",
      entrevistadorNombre: "Dra. María Carmona",
      entrevistadorRegistro: "RM-76-9812-VALLE",
      segundoEntrevistadorNombre: "Dr. Fernando Restrepo",
      segundoEntrevistadorDocumento: "94567812",
    },
    metadata: {
      processCode: "PROC-2026-0099",
      rndCode: "RND-2026-VAL-00892",
      donorName: "Juan David Pérez González",
      donorDocument: "1144123456",
      primaryIpsName: "Hospital Universitario del Valle",
      revisionNumber: 1,
      templateVersion: "2.1.0",
      generatedAt: new Date("2026-11-19T16:00:00.000Z"),
      generatedByName: "Dra. María Carmona",
      snapshotDigest: "18293a9afbf4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298",
    },
  };

  const anexo3Buffer = await engine.render(anexo3Input);
  const anexo3Path = path.join(outDir, "ANEXO_3_final_verificado.pdf");
  fs.writeFileSync(anexo3Path, anexo3Buffer);
  console.log(`✓ Anexo 3 guardado en: ${anexo3Path} (${anexo3Buffer.length} bytes)`);

  console.log("Todos los documentos generados con éxito.");
}

main().catch((err) => {
  console.error("Error al generar documentos:", err);
  process.exit(1);
});
