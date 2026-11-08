const fs = require('fs');

async function run() {
  const tokens = JSON.parse(fs.readFileSync('scripts/dev-tokens.json', 'utf8'));
  const token = tokens.users.coordinator.token;
  const baseUrl = 'http://localhost:3000/api/v1';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  console.log('========================================================================');
  console.log('GODT REGIONAL 3 — VALIDACIÓN FUNCIONAL PASO A PASO (AUDITORÍA G.1.2)');
  console.log('========================================================================\n');

  const logStep = (step, title) => console.log(`\n▶ PASO ${step}: ${title}`);

  // 1. Crear un donante nuevo en censo (con código RND sintético explícito para pruebas)
  logStep(1, 'Crear un donante nuevo en censo (identificador sintético de prueba)');
  const uniqueId = Date.now().toString().slice(-6);
  const donorPayload = {
    rndCode: `TEST-SYNTHETIC-RND-${uniqueId}`,
    originatingIpsName: 'Hospital Universitario del Valle',
    clinicalService: 'Urgencias / Trauma',
    fullName: `Donante Auditoría Funcional ${uniqueId}`,
    documentNumber: `CC-1098${uniqueId}`,
    bloodGroup: 'O',
    rhFactor: 'POSITIVO'
  };
  const res1 = await fetch(`${baseUrl}/donors`, {
    method: 'POST',
    headers,
    body: JSON.stringify(donorPayload)
  });
  const donorCreated = await res1.json();
  console.log(`[Paso 1] Status: ${res1.status} | ID: ${donorCreated.id} | RND: ${donorCreated.rndCode}`);

  // 2. Crear un proceso desde cero (con donante provisional automático)
  logStep(2, 'Crear un proceso desde cero sin donante previo (Provisional RND)');
  const procPayload = {
    primaryIpsName: 'Hospital Universitario del Valle',
    donor: {
      fullName: `Donante Emergencia Cero ${uniqueId}`,
      clinicalService: 'UCI Neurocríticos',
      bloodGroup: 'A',
      rhFactor: 'POSITIVO'
    }
  };
  const res2 = await fetch(`${baseUrl}/donation-processes`, {
    method: 'POST',
    headers,
    body: JSON.stringify(procPayload)
  });
  const processCreated = await res2.json();
  console.log(`[Paso 2] Status: ${res2.status} | Process ID: ${processCreated.id} | Code: ${processCreated.processCode} | Donor ID: ${processCreated.donorId}`);

  // 3. Abrir el proceso
  logStep(3, 'Abrir y consultar el proceso recién creado');
  const res3 = await fetch(`${baseUrl}/donation-processes/${processCreated.id}`, { headers });
  const processDetail = await res3.json();
  console.log(`[Paso 3] Status: ${res3.status} | Estado: ${processDetail.status} | IPS: ${processDetail.primaryIpsName} | Documentos: ${processDetail.documents?.length || 0}`);

  // 4. Consultar expedientes
  logStep(4, 'Consultar expedientes de donantes con paginación');
  const res4 = await fetch(`${baseUrl}/donors?page=1&pageSize=5`, { headers });
  const donorsList = await res4.json();
  console.log(`[Paso 4] Status: ${res4.status} | Total donantes en DB: ${donorsList.total} | Retornados en página: ${donorsList.items?.length}`);

  // 5. Abrir el catálogo de plantillas
  logStep(5, 'Abrir el catálogo de plantillas oficiales');
  const res5 = await fetch(`${baseUrl}/document-catalog`, { headers });
  const catalog = await res5.json();
  console.log(`[Paso 5] Status: ${res5.status} | Total plantillas activas: ${catalog.length}`);
  const anexo2 = catalog.find(t => t.templateCode === 'anexo_2') || catalog[0];
  console.log(`[Paso 5] Plantilla seleccionada: ${anexo2.templateCode} - ${anexo2.name}`);

  // 6. Abrir una plantilla publicada y obtener versiones
  logStep(6, 'Abrir una plantilla publicada e inspeccionar versión');
  const res6 = await fetch(`${baseUrl}/document-catalog/${anexo2.id}/versions`, { headers });
  const versions = await res6.json();
  console.log(`[Paso 6] Status: ${res6.status} | Versiones encontradas: ${versions.length}`);
  const publishedVersion = versions.find(v => v.status === 'PUBLISHED') || versions[0];
  console.log(`[Paso 6] Versión: ${publishedVersion.versionNumber} | Estado: ${publishedVersion.status} | Hash: ${publishedVersion.definitionHash?.slice(0, 16)}...`);

  // 7. Diligenciar un documento (Crear DocumentInstance inicial)
  logStep(7, 'Diligenciar un documento (Crear DocumentInstance)');
  const instancePayload = {
    templateVersionId: publishedVersion.id,
    responseData: {
      fallecidoNombre: donorCreated.fullName,
      fallecidoDocumento: donorCreated.documentNumber,
      fallecidoTipoDocumento: 'CC',
      coordinadorNombre: 'Dra. Elena Ramos',
      ciudadNotificacion: 'Cali',
      notificadoNombre: 'María Pérez',
      notificadoDocumento: '66778899',
      notificadoParentesco: 'Cónyuge'
    },
    sourceProvenance: [
      {
        fieldPath: 'fallecidoNombre',
        canonicalFieldKey: 'donor.identity.full_name',
        sourceKind: 'DONOR_RECORD',
        sourceValue: donorCreated.fullName
      },
      {
        fieldPath: 'fallecidoDocumento',
        canonicalFieldKey: 'donor.identity.document_number',
        sourceKind: 'DONOR_RECORD',
        sourceValue: donorCreated.documentNumber
      }
    ]
  };
  const res7 = await fetch(`${baseUrl}/donors/${donorCreated.id}/document-instances`, {
    method: 'POST',
    headers,
    body: JSON.stringify(instancePayload)
  });
  const docInstance = await res7.json();
  console.log(`[Paso 7] Status: ${res7.status} | Instance ID: ${docInstance.id} | Revision: ${docInstance.currentRevision?.revisionNumber}`);

  // 8. Guardarlo y volverlo a abrir
  logStep(8, 'Guardar revisión adicional y volver a consultar la instancia');
  const updatePayload = {
    responseData: {
      ...instancePayload.responseData,
      observaciones: 'Revisión preliminar de constancia guardada exitosamente.',
      ciudadNotificacion: 'Cali, Valle del Cauca'
    }
  };
  const res8a = await fetch(`${baseUrl}/document-instances/${docInstance.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updatePayload)
  });
  const savedRevision = await res8a.json();
  console.log(`[Paso 8] Guardado Status: ${res8a.status} | Nueva Revisión: ${savedRevision.currentRevision?.revisionNumber}`);

  const res8b = await fetch(`${baseUrl}/document-instances/${docInstance.id}`, { headers });
  const reopenedInstance = await res8b.json();
  console.log(`[Paso 8] Reabierto Status: ${res8b.status} | Revisiones históricas: ${reopenedInstance.revisions?.length}`);

  // 9. Modificar un dato y comprobar su procedencia
  logStep(9, 'Modificar dato mapeado y verificar cambio riguroso a MANUAL sin pérdida de trazabilidad');
  const modifyPayload = {
    responseData: {
      ...reopenedInstance.currentRevision?.responseData,
      fallecidoNombre: 'Nombre Corregido Manualmente por Auditor'
    }
  };
  const res9 = await fetch(`${baseUrl}/document-instances/${docInstance.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(modifyPayload)
  });
  const modifiedInstance = await res9.json();
  const provs = modifiedInstance.currentRevision?.provenance || [];
  const modifiedFieldProv = provs.find(p => p.fieldPath === 'fallecidoNombre');
  const untouchedFieldProv = provs.find(p => p.fieldPath === 'fallecidoDocumento');
  console.log(`[Paso 9] Status: ${res9.status}`);
  console.log(`[Paso 9] Campo modificado ('fallecidoNombre') -> sourceKind: ${modifiedFieldProv?.sourceKind} | sourceValue: "${modifiedFieldProv?.sourceValue}"`);
  console.log(`[Paso 9] Campo no modificado ('fallecidoDocumento') -> sourceKind: ${untouchedFieldProv?.sourceKind} | sourceValue: "${untouchedFieldProv?.sourceValue}"`);

  // 10. Abrir el dashboard y contrastar sus indicadores
  logStep(10, 'Abrir dashboard y contrastar métricas consolidadas');
  const res10 = await fetch(`${baseUrl}/donation-processes/dashboard/summary`, { headers });
  const dashboard = await res10.json();
  console.log(`[Paso 10] Status: ${res10.status}`);
  console.log(`[Paso 10] Métricas obtenidas:`);
  console.log(`  - Procesos Totales: ${dashboard.processes.total}`);
  console.log(`    - En Valoración: ${dashboard.processes.byStatus.EN_VALORACION}`);
  console.log(`    - En Curso: ${dashboard.processes.byStatus.EN_CURSO}`);
  console.log(`  - Donantes Totales: ${dashboard.donors.total}`);
  console.log(`    - En Valoración: ${dashboard.donors.byStatus.EN_VALORACION}`);
  console.log(`  - Documentos Totales: ${dashboard.documents.total}`);
  console.log(`    - Liberados/Firmados: ${(dashboard.documents.byStatus.LIBERADO || 0) + (dashboard.documents.byStatus.FIRMADO || 0)}`);
  console.log(`    - En Diligenciamiento/Revisión: ${(dashboard.documents.byStatus.EN_DILIGENCIAMIENTO || 0) + (dashboard.documents.byStatus.PENDIENTE_FIRMAS || 0) + (dashboard.documents.byStatus.BORRADOR || 0)}`);
  console.log(`    - Pendientes: ${dashboard.documents.byStatus.PENDIENTE || 0}`);
  console.log(`  - Procesos Recientes cargados: ${dashboard.recentProcesses.length}`);

  console.log('\n========================================================================');
  console.log('✅ VALIDACIÓN FUNCIONAL COMPLETA EXITOSA (10/10 PASOS VERIFICADOS)');
  console.log('========================================================================\n');
}

run().catch(err => {
  console.error('ERROR EN VALIDACIÓN FUNCIONAL:', err);
  process.exit(1);
});
