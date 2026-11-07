import { createHash } from "node:crypto";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

export interface OfficialTemplateDefinition {
  templateCode: string;
  name: string;
  category: string;
  versionNumber: string;
  jsonSchema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
  mappingConfig: unknown[];
  metadata?: Record<string, unknown>;
}

export const OFFICIAL_TEMPLATE_DEFINITIONS: ReadonlyArray<OfficialTemplateDefinition> = [
  // -------------------------------------------------------------
  // 1. ANEXO 2: Notificación a deudos (Ley 1805 / Presunción Legal)
  // -------------------------------------------------------------
  {
    templateCode: "anexo_2",
    name: "Anexo 2 — Notificación a deudos sobre la Ley 1805 de 2016",
    category: "LEGAL",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["fallecidoNombre", "fallecidoDocumento", "notificadoNombre", "notificadoDocumento"],
      properties: {
        coordinadorNombre: { type: "string", title: "Nombre del Coordinador Operativo" },
        coordinadorDocumento: { type: "string", title: "Cédula del Coordinador" },
        institucionRed: { type: "string", title: "Institución ante la Red de Donación" },
        fallecidoNombre: { type: "string", title: "Nombre del Fallecido" },
        fallecidoTipoDocumento: { type: "string", title: "Tipo de Documento", enum: ["CC", "TI", "CE", "PASAPORTE", "MS", "OTRO"] },
        fallecidoDocumento: { type: "string", title: "Número de Identificación" },
        codigoConsultaRND: { type: "string", title: "Código de Consulta al RND" },
        entidadConsultaRND: { type: "string", title: "Entidad que Certifica RND" },
        fechaHoraConsultaRND: { type: "string", title: "Fecha y Hora Consulta RND" },
        notificadoNombre: { type: "string", title: "Nombre de la Persona Notificada" },
        notificadoTipoDocumento: { type: "string", title: "Tipo Doc. Notificado", enum: ["CC", "TI", "CE", "PASAPORTE", "OTRO"] },
        notificadoDocumento: { type: "string", title: "Identificación de la Persona Notificada" },
        notificadoParentesco: { type: "string", title: "Parentesco con el Fallecido" },
        ciudadNotificacion: { type: "string", title: "Ciudad de Notificación" },
        fechaNotificacion: { type: "string", title: "Fecha de Notificación" },
        testigoNombre: { type: "string", title: "Nombre del Testigo" },
        testigoDocumento: { type: "string", title: "Cédula del Testigo" },
        testigoCargo: { type: "string", title: "Cargo o Relación del Testigo" },
        observaciones: { type: "string", title: "Observaciones Adicionales" },
        constanciaEntregaCertificado: { type: "boolean", title: "Constancia de entrega del certificado de consulta RND", default: true },
      },
    },
    uiSchema: {
      sections: [
        { id: "coordinador", title: "1. Datos del Coordinador Notificador", fields: ["coordinadorNombre", "coordinadorDocumento", "institucionRed"] },
        { id: "fallecido", title: "2. Donante Fallecido y Consulta al RND", fields: ["fallecidoNombre", "fallecidoTipoDocumento", "fallecidoDocumento", "codigoConsultaRND", "entidadConsultaRND", "fechaHoraConsultaRND"] },
        { id: "notificado", title: "3. Persona Notificada y Notificación Legal", fields: ["notificadoNombre", "notificadoTipoDocumento", "notificadoDocumento", "notificadoParentesco", "ciudadNotificacion", "fechaNotificacion", "constanciaEntregaCertificado"] },
        { id: "testigo", title: "4. Testigo y Observaciones", fields: ["testigoNombre", "testigoDocumento", "testigoCargo", "observaciones"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "fallecidoNombre", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "fallecidoDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_type", schemaPath: "fallecidoTipoDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.registration.rnd_code", schemaPath: "codigoConsultaRND", scope: "DONOR", bindingPolicy: "READONLY_DERIVED", dataType: "string" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "institucionRed", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 2. ANEXO 3: Consentimiento familiar (Menores / Extranjeros)
  // -------------------------------------------------------------
  {
    templateCode: "anexo_3",
    name: "Anexo 3 — Consentimiento informado familiar de donación",
    category: "LEGAL",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["fallecidoNombre", "fallecidoDocumento", "representanteNombre", "representanteDocumento", "autorizaExtraccion"],
      properties: {
        fecha: { type: "string", title: "Fecha" },
        hora: { type: "string", title: "Hora" },
        ciudad: { type: "string", title: "Ciudad" },
        representanteNombre: { type: "string", title: "Nombre del Representante Legal" },
        representanteDocumento: { type: "string", title: "Documento de Identidad del Representante" },
        representanteParentesco: { type: "string", title: "Parentesco" },
        fallecidoNombre: { type: "string", title: "Nombre del Fallecido" },
        fallecidoTipoDocumento: { type: "string", title: "Tipo de Documento", enum: ["RC", "TI", "CC", "PASAPORTE", "MS", "OTRO"] },
        fallecidoDocumento: { type: "string", title: "Número de Identificación" },
        fallecidoLugarExpedicion: { type: "string", title: "Lugar de Expedición del Documento" },
        criterioFallecimiento: { type: "string", title: "Criterio de Muerte", enum: ["MUERTE_ENCEFALICA", "PARADA_CARDIORRESPIRATORIA"] },
        autorizaExtraccion: { type: "boolean", title: "¿Autoriza libremente la extracción de componentes anatómicos?" },
        finalidadTrasplante: { type: "boolean", title: "Finalidad Trasplante", default: true },
        observacionesRestricciones: { type: "string", title: "Observaciones o Restricciones Familiares" },
        autorizaMuestrasInmunologia: { type: "boolean", title: "Autoriza toma de muestras para inmunología y serología", default: true },
        testigoNombre: { type: "string", title: "Nombre del Testigo" },
        testigoDocumento: { type: "string", title: "Documento del Testigo" },
        testigoParentesco: { type: "string", title: "Parentesco / Relación del Testigo" },
        entrevistadorPrincipalNombre: { type: "string", title: "Nombre Entrevistador Principal" },
        entrevistadorPrincipalRegistro: { type: "string", title: "Registro Médico Entrevistador" },
        segundoEntrevistadorNombre: { type: "string", title: "Segundo Entrevistador (Opcional)" },
        segundoEntrevistadorDocumento: { type: "string", title: "Cédula Segundo Entrevistador" },
      },
    },
    uiSchema: {
      sections: [
        { id: "encabezado", title: "1. Información de Lugar y Fecha", fields: ["fecha", "hora", "ciudad"] },
        { id: "representante", title: "2. Representante(s) Legal(es) que Consienten", fields: ["representanteNombre", "representanteDocumento", "representanteParentesco"] },
        { id: "donante", title: "3. Donante y Criterio de Fallecimiento", fields: ["fallecidoNombre", "fallecidoTipoDocumento", "fallecidoDocumento", "fallecidoLugarExpedicion", "criterioFallecimiento"] },
        { id: "declaracion", title: "4. Consentimiento Informado y Finalidades", fields: ["autorizaExtraccion", "finalidadTrasplante", "observacionesRestricciones", "autorizaMuestrasInmunologia"] },
        { id: "firmas", title: "5. Testigo y Entrevistadores de la Red", fields: ["testigoNombre", "testigoDocumento", "testigoParentesco", "entrevistadorPrincipalNombre", "entrevistadorPrincipalRegistro", "segundoEntrevistadorNombre", "segundoEntrevistadorDocumento"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "fallecidoNombre", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "fallecidoDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_type", schemaPath: "fallecidoTipoDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "ciudad", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 3. ANEXO 4: Registro de donante y oferta
  // -------------------------------------------------------------
  {
    templateCode: "anexo_4",
    name: "Anexo 4 — Registro de donante y oferta de componentes anatómicos",
    category: "CLINICAL",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["donanteNombre", "donanteDocumento", "ipsGeneradora"],
      properties: {
        codigoConsultaRND: { type: "string", title: "Código de Consulta RND" },
        fechaOferta: { type: "string", title: "Fecha de Oferta" },
        horaOferta: { type: "string", title: "Hora de Oferta" },
        regionalGeneradora: { type: "string", title: "Regional Generadora" },
        medicoCoordinadorCargo: { type: "string", title: "Médico Coordinador a Cargo" },
        ipsGeneradora: { type: "string", title: "IPS Generadora" },
        mecanismoLegalizacion: { type: "string", enum: ["CONSENTIMIENTO_FAMILIAR", "PRESUNCION_LEGAL"], title: "Mecanismo Legalización" },
        donanteNombre: { type: "string", title: "Nombre del Donante" },
        donanteDocumento: { type: "string", title: "Número de Identificación" },
        donanteTipoDocumento: { type: "string", title: "Tipo de Documento" },
        donanteSexo: { type: "string", enum: ["MASCULINO", "FEMENINO", "INDETERMINADO"] },
        donanteEdad: { type: "number", title: "Edad (Años)" },
        donanteNacionalidad: { type: "string", title: "Nacionalidad" },
        donanteEtnia: { type: "string", title: "Etnia" },
        grupoSanguineo: { type: "string", enum: ["O", "A", "B", "AB"] },
        factorRh: { type: "string", enum: ["POSITIVO", "NEGATIVO"] },
        fechaHoraIngresoIps: { type: "string", title: "Ingreso a IPS" },
        glasgowIngreso: { type: "number", title: "Glasgow de Ingreso" },
        glasgowAlerta: { type: "number", title: "Glasgow de Alerta" },
        servicioUbicacion: { type: "string", title: "Servicio de Estancia" },
        tiempoEstanciaDias: { type: "number", title: "Días de Estancia" },
        fechaHoraDiagnosticoMuerte: { type: "string", title: "Diagnóstico de Muerte" },
        causaMuerteTipo: { type: "string", enum: ["TCE", "ACV_HEMORRAGICO", "ACV_ISQUEMICO", "EHI", "TUMOR", "OTRA"] },
        causaMuerteDetalle: { type: "string", title: "Causa Específica de Muerte" },
        pesoKg: { type: "number", title: "Peso (Kg)" },
        tallaCms: { type: "number", title: "Talla (cm)" },
        imc: { type: "number", title: "IMC" },
        taSistolica: { type: "number", title: "TA Sistólica" },
        taDiastolica: { type: "number", title: "TA Diastólica" },
        frecuenciaCardiaca: { type: "number", title: "Frecuencia Cardíaca (lpm)" },
        temperaturaCelsius: { type: "number", title: "Temperatura (°C)" },
        diuresisCcHora: { type: "number", title: "Diuresis (cc/h)" },
        hemoglobina: { type: "number", title: "Hemoglobina (g/dL)" },
        hematocrito: { type: "number", title: "Hematocrito (%)" },
        leucocitos: { type: "number", title: "Leucocitos (/mm³)" },
        plaquetas: { type: "number", title: "Plaquetas (/mm³)" },
        creatinina: { type: "number", title: "Creatinina Sérica (mg/dL)" },
        phArterial: { type: "number", title: "pH Arterial" },
        ofertaCorazon: { type: "boolean", title: "Oferta Corazón", default: false },
        ofertaPulmones: { type: "boolean", title: "Oferta Pulmones", default: false },
        ofertaHigado: { type: "boolean", title: "Oferta Hígado", default: false },
        ofertaRinonDerecho: { type: "boolean", title: "Oferta Riñón Derecho", default: false },
        ofertaRinonIzquierdo: { type: "boolean", title: "Oferta Riñón Izquierdo", default: false },
        ofertaPancreas: { type: "boolean", title: "Oferta Páncreas", default: false },
        ofertaTejidos: { type: "boolean", title: "Oferta Tejidos", default: false },
        observaciones: { type: "string", title: "Observaciones Generales" },
      },
    },
    uiSchema: {
      sections: [
        { id: "general", title: "1. Datos de Oferta e Identificación", fields: ["codigoConsultaRND", "fechaOferta", "horaOferta", "regionalGeneradora", "medicoCoordinadorCargo", "ipsGeneradora", "mecanismoLegalizacion", "donanteNombre", "donanteDocumento", "donanteTipoDocumento", "donanteSexo", "donanteEdad", "donanteNacionalidad", "donanteEtnia", "grupoSanguineo", "factorRh"] },
        { id: "clinico", title: "2. Evolución Clínica y Diagnóstico de Muerte", fields: ["fechaHoraIngresoIps", "glasgowIngreso", "glasgowAlerta", "servicioUbicacion", "tiempoEstanciaDias", "fechaHoraDiagnosticoMuerte", "causaMuerteTipo", "causaMuerteDetalle"] },
        { id: "examen", title: "3. Examen Físico y Monitoreo", fields: ["pesoKg", "tallaCms", "imc", "taSistolica", "taDiastolica", "frecuenciaCardiaca", "temperaturaCelsius", "diuresisCcHora"] },
        { id: "laboratorios", title: "4. Laboratorios y Paraclínicos", fields: ["hemoglobina", "hematocrito", "leucocitos", "plaquetas", "creatinina", "phArterial"] },
        { id: "oferta", title: "5. Oferta de Componentes y Observaciones", fields: ["ofertaCorazon", "ofertaPulmones", "ofertaHigado", "ofertaRinonDerecho", "ofertaRinonIzquierdo", "ofertaPancreas", "ofertaTejidos", "observaciones"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "donanteNombre", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "donanteDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_type", schemaPath: "donanteTipoDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.demographics.age", schemaPath: "donanteEdad", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.demographics.sex", schemaPath: "donanteSexo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.registration.rnd_code", schemaPath: "codigoConsultaRND", scope: "DONOR", bindingPolicy: "READONLY_DERIVED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.blood_group", schemaPath: "grupoSanguineo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.rh_factor", schemaPath: "factorRh", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "ipsGeneradora", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.cause_of_death", schemaPath: "causaMuerteDetalle", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.creatinine", schemaPath: "creatinina", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.clinical.arterial_ph", schemaPath: "phArterial", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "number" },
    ],
  },

  // -------------------------------------------------------------
  // 4. ANEXO 5: Remisión de muestras de laboratorio
  // -------------------------------------------------------------
  {
    templateCode: "anexo_5",
    name: "Anexo 5 — Formato de remisión de muestras para laboratorio e inmunogenética",
    category: "CLINICAL",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["donanteNombre", "donanteDocumento", "institucionRemitente"],
      properties: {
        ciudadOrigen: { type: "string", title: "Ciudad de Origen" },
        coordinacionRegional: { type: "string", title: "Coordinación Regional No." },
        fechaRecoleccion: { type: "string", title: "Fecha de Recolección" },
        horaRecoleccion: { type: "string", title: "Hora de Recolección" },
        institucionRemitente: { type: "string", title: "Institución Remitente" },
        destinoCiudad: { type: "string", title: "Destino de la Muestra (Ciudad)" },
        destinoDireccion: { type: "string", title: "Dirección de Destino" },
        tipoDonante: { type: "string", enum: ["DV", "DC"], title: "Tipo de Donante (DV / DC)", default: "DC" },
        donanteNombre: { type: "string", title: "Nombre del Donante" },
        donanteDocumento: { type: "string", title: "Identificación del Donante" },
        muestraSangre: { type: "boolean", title: "Muestra de Sangre", default: true },
        muestraGanglio: { type: "boolean", title: "Muestra de Ganglio Linfático", default: false },
        muestraBazo: { type: "boolean", title: "Muestra de Bazo", default: false },
        causaMuerte: { type: "string", title: "Causa de Muerte" },
        grupoSanguineo: { type: "string", enum: ["O", "A", "B", "AB"] },
        factorRh: { type: "string", enum: ["POSITIVO", "NEGATIVO"] },
        antecedentesTransfusionales: { type: "string", title: "Antecedentes Transfusionales" },
        antecedentesMedicamentos: { type: "string", title: "Medicamentos Administrados" },
        pruebaHIV: { type: "boolean", title: "HIV / VIH", default: true },
        pruebaHVC: { type: "boolean", title: "Hepatitis C (HVC)", default: true },
        pruebaHBsAg: { type: "boolean", title: "HBsAg (Antígeno Sup. HB)", default: true },
        pruebaAntiHbcIgM: { type: "boolean", title: "Anti HBc IgM", default: true },
        pruebaAntiHbcIgG: { type: "boolean", title: "Anti HBc IgG", default: true },
        pruebaToxoplasma: { type: "boolean", title: "Toxoplasma", default: true },
        pruebaCMVIgG: { type: "boolean", title: "CMV IgG", default: true },
        pruebaCMVIgM: { type: "boolean", title: "CMV IgM", default: true },
        pruebaChagas: { type: "boolean", title: "Chagas", default: true },
        pruebaRPR: { type: "boolean", title: "RPR / Sífilis", default: true },
        pruebaHTLV: { type: "boolean", title: "HTLV I y II", default: true },
        pruebaEBV: { type: "boolean", title: "Epstein-Barr (EBV)", default: true },
        pruebaHLA: { type: "boolean", title: "Tipificación HLA", default: true },
        pruebaCitotoxicos: { type: "boolean", title: "Citotóxicos", default: true },
        otrosExamenes: { type: "string", title: "Otros Exámenes a Solicitar" },
        hematocrito: { type: "string", title: "Hematocrito Reciente" },
        hemoglobina: { type: "string", title: "Hemoglobina Reciente" },
        leucocitos: { type: "string", title: "Leucocitos Recientes" },
        observaciones: { type: "string", title: "Observaciones Generales" },
        medicoCoordinador: { type: "string", title: "Médico Coordinador Remitente" },
      },
    },
    uiSchema: {
      sections: [
        { id: "remision", title: "1. Remisión y Traslado de Muestras", fields: ["ciudadOrigen", "coordinacionRegional", "fechaRecoleccion", "horaRecoleccion", "institucionRemitente", "destinoCiudad", "destinoDireccion", "tipoDonante"] },
        { id: "donante", title: "2. Donante y Muestras Enviadas", fields: ["donanteNombre", "donanteDocumento", "causaMuerte", "grupoSanguineo", "factorRh", "muestraSangre", "muestraGanglio", "muestraBazo", "antecedentesTransfusionales", "antecedentesMedicamentos"] },
        { id: "solicitudes", title: "3. Panel Infeccioso e Inmunogenética", fields: ["pruebaHIV", "pruebaHVC", "pruebaHBsAg", "pruebaAntiHbcIgM", "pruebaAntiHbcIgG", "pruebaToxoplasma", "pruebaCMVIgG", "pruebaCMVIgM", "pruebaChagas", "pruebaRPR", "pruebaHTLV", "pruebaEBV", "pruebaHLA", "pruebaCitotoxicos", "otrosExamenes"] },
        { id: "cuadro", title: "4. Cuadro Hemático y Firma Remitente", fields: ["hematocrito", "hemoglobina", "leucocitos", "observaciones", "medicoCoordinador"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "donanteNombre", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "donanteDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.blood_group", schemaPath: "grupoSanguineo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.rh_factor", schemaPath: "factorRh", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.cause_of_death", schemaPath: "causaMuerte", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "institucionRemitente", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 5. ANEXO 7: Cardiovascular
  // -------------------------------------------------------------
  {
    templateCode: "anexo_7_cardiovascular",
    name: "Anexo 7 — Acta de rescate de tejido cardiovascular",
    category: "TISSUE",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["donanteNombre", "donanteDocumento", "medicoExtractor"],
      properties: {
        donanteNombre: { type: "string", title: "Nombre del Fallecido" },
        donanteDocumento: { type: "string", title: "Identificación" },
        donanteTipoDocumento: { type: "string", title: "Tipo de Documento" },
        donanteEdad: { type: "number", title: "Edad" },
        donanteSexo: { type: "string", enum: ["MASCULINO", "FEMENINO", "INDETERMINADO"] },
        ancestroRacial: { type: "string", title: "Ancestro Racial" },
        fechaMuerte: { type: "string", title: "Fecha de Muerte" },
        horaMuerte: { type: "string", title: "Hora de Muerte" },
        causaMuerte: { type: "string", title: "Causa de Muerte" },
        ciudadDonante: { type: "string", title: "Ciudad" },
        contactoFamiliar: { type: "string", title: "Contacto Familiar" },
        tipoProcedencia: { type: "string", enum: ["INMLCF", "IPS"], default: "IPS" },
        sedeInmlcf: { type: "string", title: "Sede INMLCF" },
        sirdec: { type: "string", title: "No. SIRDEC" },
        noticiaCriminal: { type: "string", title: "No. Noticia Criminal" },
        fechaInspeccion: { type: "string", title: "Fecha Inspección Cadáver" },
        nombreIps: { type: "string", title: "Nombre IPS Generadora" },
        historiaClinica: { type: "string", title: "No. Historia Clínica" },
        fechaIngresoIps: { type: "string", title: "Ingreso al Hospital" },
        fenomenosTemperatura: { type: "string", enum: ["CALIENTE", "TIBIO", "FRIO", "NO_VALORABLE"], default: "FRIO" },
        fenomenosRigidez: { type: "string", enum: ["PARCIAL", "GENERALIZADA", "FLACIDEZ", "NO_VALORABLE"], default: "GENERALIZADA" },
        fenomenosLivideces: { type: "string", title: "Color y Ubicación Livideces" },
        chequeoPrendas: { type: "boolean", title: "¿Cadáver con prendas de vestir?" },
        prendasDescripcion: { type: "string", title: "Descripción de Prendas" },
        prendasDestino: { type: "string", title: "Destino de Prendas" },
        chequeoPertenencias: { type: "boolean", title: "¿Cadáver con pertenencias?" },
        pertenenciasDescripcion: { type: "string", title: "Descripción Pertenencias" },
        pertenenciasDestino: { type: "string", title: "Destino Pertenencias" },
        tejidoCorazon: { type: "boolean", title: "Extracción Tejido Cardíaco (Válvulas)", default: true },
        tejidoPericardio: { type: "boolean", title: "Extracción Pericardio", default: true },
        tejidoSegmentosVasculares: { type: "boolean", title: "Extracción Segmentos Vasculares", default: true },
        clampeoOParoCardiaco: { type: "string", title: "Hora Paro Cardíaco / Clampeo" },
        hallazgosIntraoperatorios: { type: "string", title: "Hallazgos Intraoperatorios" },
        exclusionTejidos: { type: "string", title: "Exclusión de Tejidos" },
        motivoExclusion: { type: "string", title: "Motivo de Exclusión" },
        medicoExtractor: { type: "string", title: "Médico Extractor del Banco" },
        institucionBancoTejidos: { type: "string", title: "Banco de Tejidos" },
      },
    },
    uiSchema: {
      sections: [
        { id: "donante", title: "1. Datos del Donante de Tejido Cardiovascular", fields: ["donanteNombre", "donanteDocumento", "donanteTipoDocumento", "donanteEdad", "donanteSexo", "ancestroRacial", "fechaMuerte", "horaMuerte", "causaMuerte", "ciudadDonante", "contactoFamiliar"] },
        { id: "procedencia", title: "2. Procedencia del Cadáver y Examen Forense", fields: ["tipoProcedencia", "sedeInmlcf", "sirdec", "noticiaCriminal", "fechaInspeccion", "nombreIps", "historiaClinica", "fechaIngresoIps", "fenomenosTemperatura", "fenomenosRigidez", "fenomenosLivideces"] },
        { id: "custodia", title: "3. Chequeo de Prendas y Pertenencias", fields: ["chequeoPrendas", "prendasDescripcion", "prendasDestino", "chequeoPertenencias", "pertenenciasDescripcion", "pertenenciasDestino"] },
        { id: "extraccion", title: "4. Región Anatómica Cardiovascular y Hallazgos", fields: ["tejidoCorazon", "tejidoPericardio", "tejidoSegmentosVasculares", "clampeoOParoCardiaco", "hallazgosIntraoperatorios", "exclusionTejidos", "motivoExclusion", "medicoExtractor", "institucionBancoTejidos"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "donanteNombre", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "donanteDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_type", schemaPath: "donanteTipoDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.demographics.age", schemaPath: "donanteEdad", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.demographics.sex", schemaPath: "donanteSexo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.cause_of_death", schemaPath: "causaMuerte", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "nombreIps", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "process.recovery.cardiac_arrest_at", schemaPath: "clampeoOParoCardiaco", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 6. ANEXO 7: Osteomuscular
  // -------------------------------------------------------------
  {
    templateCode: "anexo_7_osteomuscular",
    name: "Anexo 7 — Acta de rescate de tejido osteomuscular",
    category: "TISSUE",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["donanteNombre", "donanteDocumento", "medicoExtractor"],
      properties: {
        donanteNombre: { type: "string", title: "Nombre del Donante" },
        donanteDocumento: { type: "string", title: "Identificación" },
        donanteTipoDocumento: { type: "string", title: "Tipo de Documento" },
        donanteEdad: { type: "number", title: "Edad" },
        donanteSexo: { type: "string", enum: ["MASCULINO", "FEMENINO", "INDETERMINADO"] },
        causaMuerte: { type: "string", title: "Causa de Muerte" },
        nombreIps: { type: "string", title: "IPS Generadora" },
        fenomenosTemperatura: { type: "string", enum: ["CALIENTE", "TIBIO", "FRIO", "NO_VALORABLE"], default: "FRIO" },
        fenomenosRigidez: { type: "string", enum: ["PARCIAL", "GENERALIZADA", "FLACIDEZ", "NO_VALORABLE"], default: "GENERALIZADA" },
        fenomenosLivideces: { type: "string", title: "Livideces" },
        tejidoCostillas: { type: "boolean", title: "Costillas", default: false },
        tejidoCartilagoCostal: { type: "boolean", title: "Cartílago Costal", default: false },
        tejidoHumero: { type: "boolean", title: "Húmero Osteocondral", default: false },
        tejidoRadioCubito: { type: "boolean", title: "Radio / Cúbito", default: false },
        tejidoFemurProximal: { type: "boolean", title: "Fémur Proximal", default: false },
        tejidoFemurDistal: { type: "boolean", title: "Fémur Distal", default: false },
        tejidoTibiaProximal: { type: "boolean", title: "Tibia Proximal", default: false },
        tejidoTibiaDistal: { type: "boolean", title: "Tibia Distal", default: false },
        tejidoPerone: { type: "boolean", title: "Peroné Completo / Proximal", default: false },
        tejidoRodillaCompleta: { type: "boolean", title: "Rodilla Osteocondral", default: false },
        tejidoFasciaLata: { type: "boolean", title: "Fascia Lata", default: false },
        tejidoTendonAquiles: { type: "boolean", title: "Tendón de Aquiles", default: false },
        tejidoTendonTibial: { type: "boolean", title: "Tendón Tibial (Ant / Post)", default: false },
        tejidoTendonPeronero: { type: "boolean", title: "Tendón Peronero Largo", default: false },
        tejidoPelvisIliaco: { type: "boolean", title: "Pelvis / Cresta Ilíaca", default: false },
        tejidoCalcaneoAstragalo: { type: "boolean", title: "Calcáneo / Astrágalo", default: false },
        clampeoOParoCardiaco: { type: "string", title: "Hora Clampeo / Paro Cardíaco" },
        hallazgosIntraoperatorios: { type: "string", title: "Hallazgos Intraoperatorios" },
        exclusionTejidos: { type: "string", title: "Exclusión de Tejidos" },
        motivoExclusion: { type: "string", title: "Motivo de Exclusión" },
        medicoExtractor: { type: "string", title: "Médico Extractor del Banco" },
        institucionBancoTejidos: { type: "string", title: "Banco de Tejidos" },
      },
    },
    uiSchema: {
      sections: [
        { id: "donante", title: "1. Datos Generales del Donante", fields: ["donanteNombre", "donanteDocumento", "donanteTipoDocumento", "donanteEdad", "donanteSexo", "causaMuerte", "nombreIps"] },
        { id: "fenomenos", title: "2. Valoración Cadavérica y Tiempos", fields: ["fenomenosTemperatura", "fenomenosRigidez", "fenomenosLivideces", "clampeoOParoCardiaco"] },
        { id: "anatomia", title: "3. Piezas Anatómicas Osteomusculares Rescatadas", fields: ["tejidoCostillas", "tejidoCartilagoCostal", "tejidoHumero", "tejidoRadioCubito", "tejidoFemurProximal", "tejidoFemurDistal", "tejidoTibiaProximal", "tejidoTibiaDistal", "tejidoPerone", "tejidoRodillaCompleta", "tejidoFasciaLata", "tejidoTendonAquiles", "tejidoTendonTibial", "tejidoTendonPeronero", "tejidoPelvisIliaco", "tejidoCalcaneoAstragalo"] },
        { id: "cierre", title: "4. Hallazgos, Exclusiones y Personal", fields: ["hallazgosIntraoperatorios", "exclusionTejidos", "motivoExclusion", "medicoExtractor", "institucionBancoTejidos"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "donanteNombre", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "donanteDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_type", schemaPath: "donanteTipoDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.demographics.age", schemaPath: "donanteEdad", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.demographics.sex", schemaPath: "donanteSexo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.cause_of_death", schemaPath: "causaMuerte", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "nombreIps", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "process.recovery.cardiac_arrest_at", schemaPath: "clampeoOParoCardiaco", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 7. ANEXO 7: Piel
  // -------------------------------------------------------------
  {
    templateCode: "anexo_7_piel",
    name: "Anexo 7 — Acta de rescate de tejido piel",
    category: "TISSUE",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["donanteNombre", "donanteDocumento", "medicoExtractor"],
      properties: {
        donanteNombre: { type: "string", title: "Nombre del Donante" },
        donanteDocumento: { type: "string", title: "Identificación" },
        donanteTipoDocumento: { type: "string", title: "Tipo de Documento" },
        donanteEdad: { type: "number", title: "Edad" },
        donanteSexo: { type: "string", enum: ["MASCULINO", "FEMENINO", "INDETERMINADO"] },
        causaMuerte: { type: "string", title: "Causa de Muerte" },
        nombreIps: { type: "string", title: "IPS Generadora" },
        fenomenosTemperatura: { type: "string", enum: ["CALIENTE", "TIBIO", "FRIO", "NO_VALORABLE"], default: "FRIO" },
        fenomenosRigidez: { type: "string", enum: ["PARCIAL", "GENERALIZADA", "FLACIDEZ", "NO_VALORABLE"], default: "GENERALIZADA" },
        fenomenosLivideces: { type: "string", title: "Livideces" },
        pielAntebrazos: { type: "boolean", title: "Extracción Piel Antebrazos (Der / Izq)", default: false },
        pielBrazos: { type: "boolean", title: "Extracción Piel Brazos (Der / Izq)", default: false },
        pielMuslos: { type: "boolean", title: "Extracción Piel Muslos (Der / Izq)", default: true },
        pielPiernas: { type: "boolean", title: "Extracción Piel Piernas (Der / Izq)", default: true },
        pielDorso: { type: "boolean", title: "Extracción Piel Región Dorsal", default: true },
        pielGluteos: { type: "boolean", title: "Extracción Piel Región Glútea", default: false },
        espesorDermotomoMm: { type: "number", title: "Espesor de Corte en Dermátomo (mm)", default: 0.35 },
        clampeoOParoCardiaco: { type: "string", title: "Hora Clampeo / Paro Cardíaco" },
        hallazgosIntraoperatorios: { type: "string", title: "Hallazgos Intraoperatorios" },
        exclusionTejidos: { type: "string", title: "Exclusión de Tejidos" },
        motivoExclusion: { type: "string", title: "Motivo de Exclusión" },
        medicoExtractor: { type: "string", title: "Médico Extractor del Banco" },
        institucionBancoTejidos: { type: "string", title: "Banco de Tejidos" },
      },
    },
    uiSchema: {
      sections: [
        { id: "donante", title: "1. Datos del Donante de Piel", fields: ["donanteNombre", "donanteDocumento", "donanteTipoDocumento", "donanteEdad", "donanteSexo", "causaMuerte", "nombreIps"] },
        { id: "fenomenos", title: "2. Valoración Cadavérica y Clampeo", fields: ["fenomenosTemperatura", "fenomenosRigidez", "fenomenosLivideces", "clampeoOParoCardiaco"] },
        { id: "topografia", title: "3. Topografía de Extracción Dérmica", fields: ["pielMuslos", "pielPiernas", "pielDorso", "pielBrazos", "pielAntebrazos", "pielGluteos", "espesorDermotomoMm"] },
        { id: "cierre", title: "4. Hallazgos, Exclusiones y Personal", fields: ["hallazgosIntraoperatorios", "exclusionTejidos", "motivoExclusion", "medicoExtractor", "institucionBancoTejidos"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "donanteNombre", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "donanteDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_type", schemaPath: "donanteTipoDocumento", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.demographics.age", schemaPath: "donanteEdad", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.demographics.sex", schemaPath: "donanteSexo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.cause_of_death", schemaPath: "causaMuerte", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "nombreIps", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "process.recovery.cardiac_arrest_at", schemaPath: "clampeoOParoCardiaco", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 8. ANEXO 7: Páncreas
  // -------------------------------------------------------------
  {
    templateCode: "anexo_7_pancreas",
    name: "Anexo 7 — Ficha técnica extracción componente anatómico páncreas",
    category: "ORGAN",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["codigoDonante", "ipsGeneradora", "cirujanoNombre"],
      properties: {
        codigoDonante: { type: "string", title: "Código Donante" },
        ipsGeneradora: { type: "string", title: "IPS Generadora" },
        fecha: { type: "string", title: "Fecha" },
        horaClampeo: { type: "string", title: "Hora de Clampeo Aórtico" },
        tecnicaQuirurgica: { type: "string", title: "Técnica Quirúrgica de Extracción" },
        parenquima: { type: "string", title: "Evaluación del Parénquima Pancreático" },
        hemorragias: { type: "string", title: "Hemorragias Observadas" },
        esteatonecrosis: { type: "string", title: "Presencia de Esteatonecrosis" },
        edema: { type: "string", title: "Edema Pancreático" },
        tejidoGraso: { type: "string", title: "Infiltración de Tejido Graso" },
        otrosHallazgos: { type: "string", title: "Otros Hallazgos Intraoperatorios" },
        observaciones: { type: "string", title: "Observaciones de Conservación" },
        cirujanoNombre: { type: "string", title: "Nombre del Cirujano Extractor" },
        cirujanoDocumento: { type: "string", title: "Documento del Cirujano" },
      },
    },
    uiSchema: {
      sections: [
        { id: "general", title: "1. Identificación y Cirugía", fields: ["codigoDonante", "ipsGeneradora", "fecha", "horaClampeo", "tecnicaQuirurgica"] },
        { id: "evaluacion", title: "2. Evaluación Macroscópica del Órgano", fields: ["parenquima", "hemorragias", "esteatonecrosis", "edema", "tejidoGraso"] },
        { id: "cierre", title: "3. Hallazgos Adicionales y Cirujano Responsable", fields: ["otrosHallazgos", "observaciones", "cirujanoNombre", "cirujanoDocumento"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.registration.rnd_code", schemaPath: "codigoDonante", scope: "DONOR", bindingPolicy: "READONLY_DERIVED", dataType: "string" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "ipsGeneradora", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "process.recovery.aortic_clamp_at", schemaPath: "horaClampeo", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 9. ANEXO 7: Pulmón
  // -------------------------------------------------------------
  {
    templateCode: "anexo_7_pulmon",
    name: "Anexo 7 — Ficha técnica extracción componente anatómico pulmón",
    category: "ORGAN",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["codigoDonante", "ipsGeneradora", "lateralidad", "cirujanoNombre"],
      properties: {
        codigoDonante: { type: "string", title: "Código Donante" },
        ipsGeneradora: { type: "string", title: "IPS Generadora" },
        fecha: { type: "string", title: "Fecha" },
        horaClampeo: { type: "string", title: "Hora de Clampeo Aórtico" },
        lateralidad: { type: "string", enum: ["DERECHO", "IZQUIERDO", "BILATERAL"], title: "Lateralidad Extraída" },
        tecnicaQuirurgica: { type: "string", title: "Técnica Quirúrgica (Neumonectomía)" },
        hallazgosIntraoperatorios: { type: "string", title: "Hallazgos Intraoperatorios (Compliancia, Secreciones)" },
        hallazgosEnBanco: { type: "string", title: "Hallazgos en Banco / Mesa Quirúrgica" },
        observaciones: { type: "string", title: "Observaciones Generales" },
        cirujanoNombre: { type: "string", title: "Nombre del Cirujano Extractor" },
        cirujanoDocumento: { type: "string", title: "Documento del Cirujano" },
      },
    },
    uiSchema: {
      sections: [
        { id: "general", title: "1. Identificación y Lateralidad", fields: ["codigoDonante", "ipsGeneradora", "fecha", "horaClampeo", "lateralidad", "tecnicaQuirurgica"] },
        { id: "hallazgos", title: "2. Hallazgos Intraoperatorios y en Banco", fields: ["hallazgosIntraoperatorios", "hallazgosEnBanco"] },
        { id: "cierre", title: "3. Observaciones y Cirujano Responsable", fields: ["observaciones", "cirujanoNombre", "cirujanoDocumento"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.registration.rnd_code", schemaPath: "codigoDonante", scope: "DONOR", bindingPolicy: "READONLY_DERIVED", dataType: "string" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "ipsGeneradora", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "process.recovery.aortic_clamp_at", schemaPath: "horaClampeo", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 10. ANEXO 9: Entrega cuerpo donante a INMLCF / Fiscalía
  // -------------------------------------------------------------
  {
    templateCode: "anexo_9",
    name: "Anexo 9 — Entrega cuerpo donante sujeto a procesos médico legales",
    category: "LEGAL",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["nombreDonante", "numeroIdentificacion", "ipsGeneradora", "medicoCoordinadorNombre"],
      properties: {
        fechaEntrega: { type: "string", title: "Fecha de Entrega" },
        ciudad: { type: "string", title: "Ciudad" },
        nombreDonante: { type: "string", title: "Nombre del Donante" },
        edad: { type: "number", title: "Edad" },
        tipoIdentificacion: { type: "string", title: "Tipo de Identificación" },
        numeroIdentificacion: { type: "string", title: "Número de Identificación" },
        ipsGeneradora: { type: "string", title: "IPS Generadora donde se Extrae" },
        criterioDiagnosticoMuerte: { type: "string", enum: ["MUERTE_ENCEFALICA", "PARADA_CARDIORRESPIRATORIA"], title: "Diagnóstico de Muerte" },
        causaSecundariaA: { type: "string", title: "Secundaria a (Causa Lesional / Médica)" },
        organosTejidosExtraidosResumen: { type: "string", title: "Resumen de Órganos / Tejidos Extraídos" },
        ipsOBancosReceptores: { type: "string", title: "IPS o Bancos de Tejidos Receptores" },
        anexoConsultaRND: { type: "boolean", title: "Anexa Consulta RND", default: true },
        anexoRegistroOferta: { type: "boolean", title: "Anexa Formato Registro / Oferta", default: true },
        anexoRegistroGeneralExtraccion: { type: "boolean", title: "Anexa Registro General Extracción", default: true },
        anexoRegistrosEspecificosExtraccion: { type: "boolean", title: "Anexa Registros Específicos Extracción", default: true },
        anexoLegalizacionDonacion: { type: "boolean", title: "Anexa Copia Legalización Donación", default: true },
        anexoCadenaCustodia: { type: "boolean", title: "Anexa Formato Cadena de Custodia", default: true },
        medicoCoordinadorNombre: { type: "string", title: "Nombre del Médico Coordinador" },
        medicoCoordinadorRegistro: { type: "string", title: "Registro Médico del Coordinador" },
      },
    },
    uiSchema: {
      sections: [
        { id: "general", title: "1. Datos Generales y Destinatarios", fields: ["fechaEntrega", "ciudad", "ipsGeneradora"] },
        { id: "donante", title: "2. Donante y Diagnóstico Médico-Legal", fields: ["nombreDonante", "edad", "tipoIdentificacion", "numeroIdentificacion", "criterioDiagnosticoMuerte", "causaSecundariaA"] },
        { id: "extracciones", title: "3. Componentes Extraídos y Destino", fields: ["organosTejidosExtraidosResumen", "ipsOBancosReceptores"] },
        { id: "anexos", title: "4. Lista de Chequeo de Documentos Entregados y Firma", fields: ["anexoConsultaRND", "anexoRegistroOferta", "anexoRegistroGeneralExtraccion", "anexoRegistrosEspecificosExtraccion", "anexoLegalizacionDonacion", "anexoCadenaCustodia", "medicoCoordinadorNombre", "medicoCoordinadorRegistro"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "nombreDonante", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "numeroIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_type", schemaPath: "tipoIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.demographics.age", schemaPath: "edad", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "ipsGeneradora", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.cause_of_death", schemaPath: "causaSecundariaA", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 11. ANEXO 1: Formato de Valoración y Alerta de Posible Donante
  // -------------------------------------------------------------
  {
    templateCode: "anexo_1",
    name: "Anexo 1 — Formato de valoración y alerta de posible donante",
    category: "CLINICAL",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["nombreDonante", "numeroIdentificacion", "ipsGeneradora", "causaMuerte"],
      properties: {
        fechaHoraAlerta: { type: "string", title: "Fecha y Hora de la Alerta" },
        ipsGeneradora: { type: "string", title: "IPS Generadora" },
        servicioHospitalario: { type: "string", title: "Servicio Hospitalario", enum: ["UCI_ADULTOS", "UCI_PEDIATRICA", "URGENCIAS", "HOSPITALIZACION", "QUIROFANO"] },
        nombreDonante: { type: "string", title: "Nombres y Apellidos del Paciente" },
        tipoIdentificacion: { type: "string", title: "Tipo de Identificación", enum: ["CC", "TI", "CE", "PASAPORTE", "MS", "OTRO"] },
        numeroIdentificacion: { type: "string", title: "Número de Identificación" },
        edad: { type: "number", title: "Edad" },
        sexo: { type: "string", title: "Sexo", enum: ["MASCULINO", "FEMENINO", "OTRO"] },
        grupoSanguineo: { type: "string", title: "Grupo Sanguíneo", enum: ["O", "A", "B", "AB"] },
        factorRh: { type: "string", title: "Factor Rh", enum: ["POSITIVO", "NEGATIVO"] },
        causaMuerte: { type: "string", title: "Causa de Muerte / Diagnóstico Principal" },
        glasgowScore: { type: "number", title: "Escala de Coma de Glasgow (3-15)" },
        muerteEncefalicaConfirmada: { type: "boolean", title: "Muerte Encefálica Diagnosticada", default: false },
        fechaHoraMuerteEncefalica: { type: "string", title: "Fecha/Hora Declaración Muerte Encefálica" },
        tensionArterialSistolica: { type: "number", title: "Tensión Sistólica (mmHg)" },
        tensionArterialDiastolica: { type: "number", title: "Tensión Diastólica (mmHg)" },
        frecuenciaCardiaca: { type: "number", title: "Frecuencia Cardíaca (lpm)" },
        temperaturaCorporal: { type: "number", title: "Temperatura Corporal (°C)" },
        soporteInotropico: { type: "string", title: "Soporte Inotrópico / Vasopresor Actual" },
        coordinadorAlertaNombre: { type: "string", title: "Nombre del Coordinador que Recibe Alerta" },
        observacionesAlerta: { type: "string", title: "Observaciones Clínicas de la Alerta" },
      },
    },
    uiSchema: {
      sections: [
        { id: "alerta", title: "1. Datos de la Alerta y Centro Asistencial", fields: ["fechaHoraAlerta", "ipsGeneradora", "servicioHospitalario", "coordinadorAlertaNombre"] },
        { id: "donante", title: "2. Identificación del Posible Donante", fields: ["nombreDonante", "tipoIdentificacion", "numeroIdentificacion", "edad", "sexo", "grupoSanguineo", "factorRh"] },
        { id: "evaluacion", title: "3. Evaluación Neurológica y Muerte Encefálica", fields: ["causaMuerte", "glasgowScore", "muerteEncefalicaConfirmada", "fechaHoraMuerteEncefalica"] },
        { id: "hemodinamia", title: "4. Parámetros Hemodinámicos y Soporte", fields: ["tensionArterialSistolica", "tensionArterialDiastolica", "frecuenciaCardiaca", "temperaturaCorporal", "soporteInotropico", "observacionesAlerta"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "nombreDonante", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "numeroIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_type", schemaPath: "tipoIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.demographics.age", schemaPath: "edad", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.demographics.biological_sex", schemaPath: "sexo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.immuno.abo_group", schemaPath: "grupoSanguineo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.immuno.rh_factor", schemaPath: "factorRh", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "ipsGeneradora", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.clinical.cause_of_death", schemaPath: "causaMuerte", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.hemodynamics.systolic_bp", schemaPath: "tensionArterialSistolica", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.hemodynamics.diastolic_bp", schemaPath: "tensionArterialDiastolica", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.hemodynamics.heart_rate", schemaPath: "frecuenciaCardiaca", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.hemodynamics.temperature", schemaPath: "temperaturaCorporal", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "number" },
    ],
  },

  // -------------------------------------------------------------
  // 12. ANEXO 6: Registro General de Extracción de Componentes
  // -------------------------------------------------------------
  {
    templateCode: "anexo_6",
    name: "Anexo 6 — Registro general de extracción de componentes anatómicos",
    category: "SURGERY",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["rndCode", "nombreDonante", "numeroIdentificacion", "ipsGeneradora"],
      properties: {
        rndCode: { type: "string", title: "Código Donante RND" },
        nombreDonante: { type: "string", title: "Nombre del Donante" },
        numeroIdentificacion: { type: "string", title: "Identificación" },
        ipsGeneradora: { type: "string", title: "IPS Generadora" },
        ciudad: { type: "string", title: "Ciudad" },
        scheduledStartAt: { type: "string", title: "Inicio Programado" },
        actualStartAt: { type: "string", title: "Inicio Real Quirófano" },
        clampAt: { type: "string", title: "Hora Clampeo Aórtico" },
        finishedAt: { type: "string", title: "Finalización del Procedimiento" },
        tipoSolucionPreservacion: { type: "string", title: "Tipo de Solución de Preservación" },
        volumenPreservacionLitros: { type: "number", title: "Volumen Total Perfusión (Litros)" },
        resumenOrganosExtraidos: { type: "string", title: "Resumen de Órganos Rescatados" },
        resumenTejidosExtraidos: { type: "string", title: "Resumen de Tejidos Rescatados" },
        cirujanoExtraccionNombre: { type: "string", title: "Cirujano Principal de Extracción" },
        cirujanoExtraccionRegistro: { type: "string", title: "Registro Médico Cirujano" },
        coordinadorQuirurgicoNombre: { type: "string", title: "Coordinador Quirófano de Rescate" },
        observacionesQuirurgicas: { type: "string", title: "Observaciones Quirúrgicas Relevantes" },
      },
    },
    uiSchema: {
      sections: [
        { id: "donante", title: "1. Identificación del Donante y Centro", fields: ["rndCode", "nombreDonante", "numeroIdentificacion", "ipsGeneradora", "ciudad"] },
        { id: "tiempos", title: "2. Cronología y Tiempos Quirúrgicos", fields: ["scheduledStartAt", "actualStartAt", "clampAt", "finishedAt"] },
        { id: "perfusion", title: "3. Soluciones y Perfusión", fields: ["tipoSolucionPreservacion", "volumenPreservacionLitros"] },
        { id: "componentes", title: "4. Componentes Rescatados y Equipo Quirúrgico", fields: ["resumenOrganosExtraidos", "resumenTejidosExtraidos", "cirujanoExtraccionNombre", "cirujanoExtraccionRegistro", "coordinadorQuirurgicoNombre", "observacionesQuirurgicas"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "nombreDonante", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "numeroIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.institution.originating_ips", schemaPath: "ipsGeneradora", scope: "PROCESS", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 13. ANEXO 7: Ocular (Acta de rescate de tejido ocular)
  // -------------------------------------------------------------
  {
    templateCode: "anexo_7_ocular",
    name: "Anexo 7 — Acta de rescate de tejido ocular",
    category: "TISSUE",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["nombreDonante", "numeroIdentificacion", "tipoTejidoOcular", "bancoTejidosDestino"],
      properties: {
        nombreDonante: { type: "string", title: "Nombre del Donante" },
        tipoIdentificacion: { type: "string", title: "Tipo de Identificación" },
        numeroIdentificacion: { type: "string", title: "Número de Identificación" },
        edad: { type: "number", title: "Edad" },
        sexo: { type: "string", title: "Sexo", enum: ["MASCULINO", "FEMENINO"] },
        fechaHoraMuerte: { type: "string", title: "Fecha y Hora del Fallecimiento" },
        fechaHoraInicioRefrigeracion: { type: "string", title: "Fecha y Hora Inicio Refrigeración Cadáver" },
        fechaHoraInicioExtraccion: { type: "string", title: "Fecha y Hora Inicio de Extracción" },
        fechaHoraFinExtraccion: { type: "string", title: "Fecha y Hora Fin de Extracción" },
        tipoTejidoOcular: { type: "string", enum: ["GLOBOS_OCULARES_TOTALES", "CORNEAS_IN_SITU", "ESCLERA"], title: "Tipo de Tejido Rescatado" },
        codigoOjoDerecho: { type: "string", title: "Identificador Ojo Derecho" },
        claridadCornealDerecha: { type: "string", enum: ["TRANSPARENTE", "LEVE_OPACIDAD", "EDEMA_MODERADO", "NO_APTO"], title: "Claridad Corneal Derecha" },
        codigoOjoIzquierdo: { type: "string", title: "Identificador Ojo Izquierdo" },
        claridadCornealIzquierda: { type: "string", enum: ["TRANSPARENTE", "LEVE_OPACIDAD", "EDEMA_MODERADO", "NO_APTO"], title: "Claridad Corneal Izquierda" },
        medioPreservacion: { type: "string", title: "Medio de Preservación Utilizado (p.ej. Eusol-C, Optisol-GS)" },
        loteMedioPreservacion: { type: "string", title: "Lote del Medio de Preservación" },
        fechaVencimientoMedio: { type: "string", title: "Fecha Vencimiento del Medio" },
        temperaturaConservacion: { type: "number", title: "Temperatura de Conservación (°C)", default: 4 },
        bancoTejidosDestino: { type: "string", title: "Banco de Tejidos Destinatario" },
        operadorRescateNombre: { type: "string", title: "Nombre del Profesional de Rescate Ocular" },
        operadorRescateRegistro: { type: "string", title: "Registro Profesional / Cédula" },
        observacionesOculares: { type: "string", title: "Observaciones / Hallazgos Oculares" },
      },
    },
    uiSchema: {
      sections: [
        { id: "donante", title: "1. Identificación del Donante y Cronología", fields: ["nombreDonante", "tipoIdentificacion", "numeroIdentificacion", "edad", "sexo", "fechaHoraMuerte", "fechaHoraInicioRefrigeracion", "fechaHoraInicioExtraccion", "fechaHoraFinExtraccion"] },
        { id: "evaluacion", title: "2. Evaluación y Tejidos Oculares Rescatados", fields: ["tipoTejidoOcular", "codigoOjoDerecho", "claridadCornealDerecha", "codigoOjoIzquierdo", "claridadCornealIzquierda"] },
        { id: "preservacion", title: "3. Medio de Preservación y Banco Receptor", fields: ["medioPreservacion", "loteMedioPreservacion", "fechaVencimientoMedio", "temperaturaConservacion", "bancoTejidosDestino"] },
        { id: "responsable", title: "4. Profesional de Rescate y Firmas", fields: ["operadorRescateNombre", "operadorRescateRegistro", "observacionesOculares"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "nombreDonante", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "numeroIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_type", schemaPath: "tipoIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.demographics.age", schemaPath: "edad", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.demographics.biological_sex", schemaPath: "sexo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 14. ANEXO 7: Corazón (Ficha de extracción de corazón - Cardiectomía)
  // -------------------------------------------------------------
  {
    templateCode: "anexo_7_corazon",
    name: "Anexo 7 — Ficha de extracción de corazón (Cardiectomía)",
    category: "ORGAN",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["nombreDonante", "numeroIdentificacion", "clampeoAorticoHora", "cirujanoExtraccionNombre"],
      properties: {
        nombreDonante: { type: "string", title: "Nombre del Donante" },
        numeroIdentificacion: { type: "string", title: "Número de Identificación" },
        pesoKg: { type: "number", title: "Peso del Donante (kg)" },
        tallaCm: { type: "number", title: "Talla del Donante (cm)" },
        grupoSanguineo: { type: "string", title: "Grupo Sanguíneo" },
        factorRh: { type: "string", title: "Factor Rh" },
        feviPorcentaje: { type: "number", title: "Fracción de Eyección VI (%)" },
        soporteInotropicoIntraoperatorio: { type: "string", title: "Soporte Inotrópico en Quirófano" },
        anatomiaCoronariaMacroscopica: { type: "string", enum: ["NORMAL_SIN_ATEROMATOSIS", "LEVE_PLACA_CALCICA", "ATEROMATOSIS_SIGNIFICATIVA"], title: "Anatomía Coronaria Macroscópica" },
        aspectoMiocardico: { type: "string", enum: ["NORMAL_TONO_ADECUADO", "HIPERTROFICO", "ZONAS_HIPOCINETICAS"], title: "Aspecto del Miocardio" },
        clampeoAorticoHora: { type: "string", title: "Hora Clampeo Aórtico" },
        solucionCardioplejiaTipo: { type: "string", title: "Solución de Cardioplejia Utilizada" },
        volumenCardioplejiaCc: { type: "number", title: "Volumen Cardioplejia Infundido (cc)" },
        metodoEnfriamientoTopico: { type: "string", title: "Método Enfriamiento Tópico (Hielo estéril / Solución fría)" },
        centroReceptorTrasplante: { type: "string", title: "Centro de Trasplante Cardíaco Receptor" },
        cirujanoExtraccionNombre: { type: "string", title: "Cirujano Cardíaco Extractor" },
        cirujanoExtraccionRegistro: { type: "string", title: "Registro Médico Cirujano" },
        observacionesCardiectomia: { type: "string", title: "Hallazgos y Observaciones de Cardiectomía" },
      },
    },
    uiSchema: {
      sections: [
        { id: "donante", title: "1. Donante y Antropometría Cardíaca", fields: ["nombreDonante", "numeroIdentificacion", "pesoKg", "tallaCm", "grupoSanguineo", "factorRh"] },
        { id: "evaluacion", title: "2. Función Ventricular e Inspección Quirúrgica", fields: ["feviPorcentaje", "soporteInotropicoIntraoperatorio", "anatomiaCoronariaMacroscopica", "aspectoMiocardico"] },
        { id: "procedimiento", title: "3. Tiempos, Cardioplejia y Protección Miocárdica", fields: ["clampeoAorticoHora", "solucionCardioplejiaTipo", "volumenCardioplejiaCc", "metodoEnfriamientoTopico"] },
        { id: "destino", title: "4. Centro Destino y Cirujano Responsable", fields: ["centroReceptorTrasplante", "cirujanoExtraccionNombre", "cirujanoExtraccionRegistro", "observacionesCardiectomia"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "nombreDonante", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "numeroIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.demographics.weight_kg", schemaPath: "pesoKg", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.demographics.height_cm", schemaPath: "tallaCm", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.immuno.abo_group", schemaPath: "grupoSanguineo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.immuno.rh_factor", schemaPath: "factorRh", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 15. ANEXO 7: Hígado (Ficha de extracción de hígado - Hepatectomía)
  // -------------------------------------------------------------
  {
    templateCode: "anexo_7_higado",
    name: "Anexo 7 — Ficha de extracción de hígado (Hepatectomía)",
    category: "ORGAN",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["nombreDonante", "numeroIdentificacion", "clampeoAorticoHora", "cirujanoExtraccionNombre"],
      properties: {
        nombreDonante: { type: "string", title: "Nombre del Donante" },
        numeroIdentificacion: { type: "string", title: "Número de Identificación" },
        pesoKg: { type: "number", title: "Peso del Donante (kg)" },
        tallaCm: { type: "number", title: "Talla del Donante (cm)" },
        grupoSanguineo: { type: "string", title: "Grupo Sanguíneo" },
        factorRh: { type: "string", title: "Factor Rh" },
        aspectoMacroscopicoHigado: { type: "string", enum: ["HOMOGENEO_NORMAL", "BORDES_ROMOS", "CONGESTIVO", "CIRROTICO"], title: "Aspecto Macroscópico del Hígado" },
        esteatosisMacroEstimada: { type: "number", title: "Esteatosis Macroscópica Estimada (%)" },
        esteatosisMicroBiopsia: { type: "number", title: "Esteatosis por Biopsia Rápida en Banco (%)" },
        anatomiaVascularArterial: { type: "string", title: "Anatomía Arterial (Normal / Hepática derecha de AMS / Izquierda de Gástrica Izq.)" },
        viaBiliarLavada: { type: "boolean", title: "Lavado Exhaustivo de Vía Biliar Realizado", default: true },
        clampeoAorticoHora: { type: "string", title: "Hora Clampeo Aórtico" },
        volumenPerfusionAorticaCc: { type: "number", title: "Volumen Perfusión Aórtica (cc)" },
        volumenPerfusionPortalCc: { type: "number", title: "Volumen Perfusión Portal (cc)" },
        solucionPreservacion: { type: "string", title: "Solución de Preservación Hepática (Custodiol / Celsior / IGL-1 / UW)" },
        biopsiaTomada: { type: "boolean", title: "Biopsia de Cuña Tomada", default: false },
        centroReceptorTrasplante: { type: "string", title: "Centro Trasplante Hepático Receptor" },
        cirujanoExtraccionNombre: { type: "string", title: "Cirujano Hepático Extractor" },
        cirujanoExtraccionRegistro: { type: "string", title: "Registro Médico Cirujano" },
        observacionesHepatectomia: { type: "string", title: "Observaciones Quirúrgicas de Hepatectomía" },
      },
    },
    uiSchema: {
      sections: [
        { id: "donante", title: "1. Datos del Donante", fields: ["nombreDonante", "numeroIdentificacion", "pesoKg", "tallaCm", "grupoSanguineo", "factorRh"] },
        { id: "evaluacion", title: "2. Evaluación y Parénquima Hepático", fields: ["aspectoMacroscopicoHigado", "esteatosisMacroEstimada", "esteatosisMicroBiopsia", "anatomiaVascularArterial", "viaBiliarLavada", "biopsiaTomada"] },
        { id: "perfusion", title: "3. Tiempos y Perfusión Vascular", fields: ["clampeoAorticoHora", "solucionPreservacion", "volumenPerfusionAorticaCc", "volumenPerfusionPortalCc"] },
        { id: "destino", title: "4. Destino y Equipo Quirúrgico", fields: ["centroReceptorTrasplante", "cirujanoExtraccionNombre", "cirujanoExtraccionRegistro", "observacionesHepatectomia"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "nombreDonante", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "numeroIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.demographics.weight_kg", schemaPath: "pesoKg", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.demographics.height_cm", schemaPath: "tallaCm", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.immuno.abo_group", schemaPath: "grupoSanguineo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.immuno.rh_factor", schemaPath: "factorRh", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 16. ANEXO 7: Otros Órganos (Ficha de extracción otros órganos)
  // -------------------------------------------------------------
  {
    templateCode: "anexo_7_otros_organos",
    name: "Anexo 7 — Ficha de extracción de otros órganos",
    category: "ORGAN",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["nombreDonante", "numeroIdentificacion", "organoExtraido", "cirujanoExtraccionNombre"],
      properties: {
        nombreDonante: { type: "string", title: "Nombre del Donante" },
        numeroIdentificacion: { type: "string", title: "Número de Identificación" },
        organoExtraido: { type: "string", title: "Órgano o Componente Extraído (p.ej. Intestino, Bloque Multivisceral)" },
        clampeoHora: { type: "string", title: "Hora de Clampeo" },
        descripcionAnatomica: { type: "string", title: "Descripción Anatómica y Hallazgos" },
        vascularizacion: { type: "string", title: "Características Vasculares (Arterias / Venas)" },
        estadoParenquima: { type: "string", title: "Estado y Consistencia del Parénquima" },
        solucionPreservacion: { type: "string", title: "Solución de Preservación Utilizada" },
        centroReceptor: { type: "string", title: "Centro Asistencial Receptor" },
        cirujanoExtraccionNombre: { type: "string", title: "Cirujano Extractor" },
        cirujanoExtraccionRegistro: { type: "string", title: "Registro Profesional Cirujano" },
        observacionesOtrosOrganos: { type: "string", title: "Observaciones Generales" },
      },
    },
    uiSchema: {
      sections: [
        { id: "donante", title: "1. Donante y Componente", fields: ["nombreDonante", "numeroIdentificacion", "organoExtraido", "clampeoHora"] },
        { id: "anatomia", title: "2. Hallazgos Anatómicos y Preservación", fields: ["descripcionAnatomica", "vascularizacion", "estadoParenquima", "solucionPreservacion"] },
        { id: "equipo", title: "3. Destino y Equipo Responsable", fields: ["centroReceptor", "cirujanoExtraccionNombre", "cirujanoExtraccionRegistro", "observacionesOtrosOrganos"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "nombreDonante", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "numeroIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 17. ANEXO 7: Riñón Derecho (Ficha de extracción riñón derecho)
  // -------------------------------------------------------------
  {
    templateCode: "anexo_7_rinon_derecho",
    name: "Anexo 7 — Ficha de extracción riñón derecho (Nefrectomía)",
    category: "ORGAN",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["nombreDonante", "numeroIdentificacion", "clampeoAorticoHora", "cirujanoExtraccionNombre"],
      properties: {
        nombreDonante: { type: "string", title: "Nombre del Donante" },
        numeroIdentificacion: { type: "string", title: "Número de Identificación" },
        pesoKg: { type: "number", title: "Peso Donante (kg)" },
        tallaCm: { type: "number", title: "Talla Donante (cm)" },
        grupoSanguineo: { type: "string", title: "Grupo Sanguíneo" },
        factorRh: { type: "string", title: "Factor Rh" },
        clampeoAorticoHora: { type: "string", title: "Hora Clampeo Aórtico" },
        numeroArteriasRenales: { type: "number", title: "Número de Arterias Renales Derechas", default: 1 },
        numeroVenasRenales: { type: "number", title: "Número de Venas Renales Derechas", default: 1 },
        longitudUreterCm: { type: "number", title: "Longitud del Uréter Derecho (cm)" },
        calidadPerfusion: { type: "string", enum: ["HOMOGENEA_EXCELENTE", "LEVEMENTE_PARCHEADA", "MOTEADA_HETERO"], title: "Calidad de Perfusión en Banco" },
        quistesPresentes: { type: "boolean", title: "Presencia de Quistes Renales", default: false },
        hematomaSubcapsular: { type: "boolean", title: "Presencia de Hematoma Subcapsular", default: false },
        solucionPreservacion: { type: "string", title: "Solución de Preservación Renal" },
        maquinaPerfusionUtilizada: { type: "boolean", title: "Conectado a Máquina de Perfusión Pulsátil", default: false },
        centroReceptorTrasplante: { type: "string", title: "Centro Receptor del Riñón Derecho" },
        cirujanoExtraccionNombre: { type: "string", title: "Cirujano Extractor Riñón Derecho" },
        cirujanoExtraccionRegistro: { type: "string", title: "Registro Profesional Cirujano" },
        observacionesNefrectomia: { type: "string", title: "Observaciones Quirúrgicas Riñón Derecho" },
      },
    },
    uiSchema: {
      sections: [
        { id: "donante", title: "1. Donante y Datos Clínicos", fields: ["nombreDonante", "numeroIdentificacion", "pesoKg", "tallaCm", "grupoSanguineo", "factorRh"] },
        { id: "anatomia", title: "2. Anatomía Quirúrgica Riñón Derecho", fields: ["clampeoAorticoHora", "numeroArteriasRenales", "numeroVenasRenales", "longitudUreterCm", "calidadPerfusion", "quistesPresentes", "hematomaSubcapsular"] },
        { id: "preservacion", title: "3. Preservación y Máquina de Perfusión", fields: ["solucionPreservacion", "maquinaPerfusionUtilizada"] },
        { id: "destino", title: "4. Centro Destino y Cirujano", fields: ["centroReceptorTrasplante", "cirujanoExtraccionNombre", "cirujanoExtraccionRegistro", "observacionesNefrectomia"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "nombreDonante", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "numeroIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.demographics.weight_kg", schemaPath: "pesoKg", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.demographics.height_cm", schemaPath: "tallaCm", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.immuno.abo_group", schemaPath: "grupoSanguineo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.immuno.rh_factor", schemaPath: "factorRh", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 18. ANEXO 7: Riñón Izquierdo (Ficha de extracción riñón izquierdo)
  // -------------------------------------------------------------
  {
    templateCode: "anexo_7_rinon_izquierdo",
    name: "Anexo 7 — Ficha de extracción riñón izquierdo (Nefrectomía)",
    category: "ORGAN",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["nombreDonante", "numeroIdentificacion", "clampeoAorticoHora", "cirujanoExtraccionNombre"],
      properties: {
        nombreDonante: { type: "string", title: "Nombre del Donante" },
        numeroIdentificacion: { type: "string", title: "Número de Identificación" },
        pesoKg: { type: "number", title: "Peso Donante (kg)" },
        tallaCm: { type: "number", title: "Talla Donante (cm)" },
        grupoSanguineo: { type: "string", title: "Grupo Sanguíneo" },
        factorRh: { type: "string", title: "Factor Rh" },
        clampeoAorticoHora: { type: "string", title: "Hora Clampeo Aórtico" },
        numeroArteriasRenales: { type: "number", title: "Número de Arterias Renales Izquierdas", default: 1 },
        numeroVenasRenales: { type: "number", title: "Número de Venas Renales Izquierdas", default: 1 },
        longitudUreterCm: { type: "number", title: "Longitud del Uréter Izquierdo (cm)" },
        calidadPerfusion: { type: "string", enum: ["HOMOGENEA_EXCELENTE", "LEVEMENTE_PARCHEADA", "MOTEADA_HETERO"], title: "Calidad de Perfusión en Banco" },
        quistesPresentes: { type: "boolean", title: "Presencia de Quistes Renales", default: false },
        hematomaSubcapsular: { type: "boolean", title: "Presencia de Hematoma Subcapsular", default: false },
        solucionPreservacion: { type: "string", title: "Solución de Preservación Renal" },
        maquinaPerfusionUtilizada: { type: "boolean", title: "Conectado a Máquina de Perfusión Pulsátil", default: false },
        centroReceptorTrasplante: { type: "string", title: "Centro Receptor del Riñón Izquierdo" },
        cirujanoExtraccionNombre: { type: "string", title: "Cirujano Extractor Riñón Izquierdo" },
        cirujanoExtraccionRegistro: { type: "string", title: "Registro Profesional Cirujano" },
        observacionesNefrectomia: { type: "string", title: "Observaciones Quirúrgicas Riñón Izquierdo" },
      },
    },
    uiSchema: {
      sections: [
        { id: "donante", title: "1. Donante y Datos Clínicos", fields: ["nombreDonante", "numeroIdentificacion", "pesoKg", "tallaCm", "grupoSanguineo", "factorRh"] },
        { id: "anatomia", title: "2. Anatomía Quirúrgica Riñón Izquierdo", fields: ["clampeoAorticoHora", "numeroArteriasRenales", "numeroVenasRenales", "longitudUreterCm", "calidadPerfusion", "quistesPresentes", "hematomaSubcapsular"] },
        { id: "preservacion", title: "3. Preservación y Máquina de Perfusión", fields: ["solucionPreservacion", "maquinaPerfusionUtilizada"] },
        { id: "destino", title: "4. Centro Destino y Cirujano", fields: ["centroReceptorTrasplante", "cirujanoExtraccionNombre", "cirujanoExtraccionRegistro", "observacionesNefrectomia"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "nombreDonante", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "numeroIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.demographics.weight_kg", schemaPath: "pesoKg", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.demographics.height_cm", schemaPath: "tallaCm", scope: "DONOR", bindingPolicy: "SHARED", dataType: "number" },
      { canonicalFieldKey: "donor.immuno.abo_group", schemaPath: "grupoSanguineo", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.immuno.rh_factor", schemaPath: "factorRh", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },

  // -------------------------------------------------------------
  // 19. ANEXO 8: Formato Cadena de Custodia EMP y Evidencias
  // -------------------------------------------------------------
  {
    templateCode: "anexo_8",
    name: "Anexo 8 — Formato cadena de custodia EMP y evidencias",
    category: "CUSTODY",
    versionNumber: "1.0.0",
    jsonSchema: {
      type: "object",
      required: ["rndCode", "nombreDonante", "numeroIdentificacion", "codigoElementoCustodia", "descripcionElementoCustodia"],
      properties: {
        rndCode: { type: "string", title: "Código Donante RND" },
        nombreDonante: { type: "string", title: "Nombre del Donante" },
        numeroIdentificacion: { type: "string", title: "Identificación del Donante" },
        codigoElementoCustodia: { type: "string", title: "Código del Elemento en Custodia" },
        descripcionElementoCustodia: { type: "string", title: "Descripción del Elemento / Muestra / Componente" },
        numeroNeveraContenedor: { type: "string", title: "Número de Nevera / Contenedor Térmico" },
        numeroPrecintoSeguridad: { type: "string", title: "Número de Precinto / Sello de Seguridad" },
        temperaturaGradosCelsius: { type: "number", title: "Temperatura de Custodia (°C)", default: 4 },
        entidadOrigen: { type: "string", title: "Entidad / IPS Remitente" },
        entidadDestino: { type: "string", title: "Entidad / Banco / Laboratorio Destino" },
        responsableEntregaNombre: { type: "string", title: "Nombre Quien Entrega" },
        responsableEntregaCargo: { type: "string", title: "Cargo Quien Entrega" },
        responsableRecepcionNombre: { type: "string", title: "Nombre Quien Recibe" },
        responsableRecepcionCargo: { type: "string", title: "Cargo Quien Recibe" },
        fechaHoraTransferencia: { type: "string", title: "Fecha y Hora de Transferencia" },
        integridadVerificada: { type: "boolean", title: "Integridad del Sello y Embalaje Verificada", default: true },
        observacionesCustodia: { type: "string", title: "Observaciones de Custodia y Trazabilidad" },
      },
    },
    uiSchema: {
      sections: [
        { id: "donante", title: "1. Identificación del Donante y Caso", fields: ["rndCode", "nombreDonante", "numeroIdentificacion"] },
        { id: "elemento", title: "2. Elemento Materia de Prueba / Componente en Custodia", fields: ["codigoElementoCustodia", "descripcionElementoCustodia", "numeroNeveraContenedor", "numeroPrecintoSeguridad", "temperaturaGradosCelsius"] },
        { id: "transferencia", title: "3. Trazabilidad y Transferencia de Custodia", fields: ["entidadOrigen", "entidadDestino", "responsableEntregaNombre", "responsableEntregaCargo", "responsableRecepcionNombre", "responsableRecepcionCargo", "fechaHoraTransferencia", "integridadVerificada"] },
        { id: "observaciones", title: "4. Observaciones y Control de Calidad", fields: ["observacionesCustodia"] },
      ],
    },
    mappingConfig: [
      { canonicalFieldKey: "donor.identity.full_name", schemaPath: "nombreDonante", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
      { canonicalFieldKey: "donor.identity.document_number", schemaPath: "numeroIdentificacion", scope: "DONOR", bindingPolicy: "SHARED", dataType: "string" },
    ],
  },
];

export async function seedOfficialTemplates(prisma: PrismaService, adminUserId?: string): Promise<number> {
  let adminId = adminUserId;
  if (!adminId) {
    const admin = await prisma.systemUser.findFirst({
      where: { role: "ADMIN", isActive: true },
      orderBy: { createdAt: "asc" },
    });
    adminId = admin?.id;
  }
  if (!adminId) {
    const fallbackUser = await prisma.systemUser.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    adminId = fallbackUser?.id;
  }
  if (!adminId) {
    throw new Error("No active SystemUser found to authorize template seeding");
  }

  // 1. Depurar plantillas de prueba o códigos temporales/duplicados huérfanos sin instancias
  const orphanedCandidates = await prisma.documentTemplate.findMany({
    where: {
      OR: [
        { templateCode: { startsWith: "TPL-" } },
        { templateCode: { startsWith: "POS_NORMATIVA_" } },
        { templateCode: { contains: "test-" } },
        { templateCode: { contains: "synthetic-" } },
        { category: "PENDING_HOMOLOGATION" },
      ],
    },
    select: {
      id: true,
      _count: { select: { instances: true, processDocuments: true } },
    },
  });

  const purgeableIds = orphanedCandidates
    .filter((t) => t._count.instances === 0 && t._count.processDocuments === 0)
    .map((t) => t.id);

  if (purgeableIds.length > 0) {
    await prisma.templateVersion.deleteMany({
      where: { templateId: { in: purgeableIds } },
    });
    await prisma.documentTemplate.deleteMany({
      where: { id: { in: purgeableIds } },
    });
  }

  let count = 0;
  for (const def of OFFICIAL_TEMPLATE_DEFINITIONS) {
    const definitionPayload = {
      jsonSchema: def.jsonSchema,
      uiSchema: def.uiSchema,
      mappingConfig: def.mappingConfig,
    };
    const definitionHash = createHash("sha256")
      .update(JSON.stringify(definitionPayload))
      .digest("hex");

    const template = await prisma.documentTemplate.upsert({
      where: { templateCode: def.templateCode },
      update: {
        name: def.name,
        category: def.category,
        status: "ACTIVE",
      },
      create: {
        templateCode: def.templateCode,
        name: def.name,
        category: def.category,
        status: "ACTIVE",
      },
    });

    const existingVersion = await prisma.templateVersion.findUnique({
      where: {
        templateId_versionNumber: {
          templateId: template.id,
          versionNumber: def.versionNumber,
        },
      },
    });

    if (!existingVersion) {
      await prisma.templateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: def.versionNumber,
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          status: "PUBLISHED",
          jsonSchema: def.jsonSchema as any,
          uiSchema: def.uiSchema as any,
          mappingConfig: def.mappingConfig as any,
          definitionHash,
          createdById: adminId,
          authorizedById: adminId,
        },
      });
    } else if (existingVersion.status !== "PUBLISHED") {
      await prisma.templateVersion.update({
        where: { id: existingVersion.id },
        data: {
          status: "PUBLISHED",
          jsonSchema: def.jsonSchema as any,
          uiSchema: def.uiSchema as any,
          mappingConfig: def.mappingConfig as any,
          definitionHash,
        },
      });
    }

    count++;
  }

  return count;
}
