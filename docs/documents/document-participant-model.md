# Modelo de participantes documentales

## Problema

`DonationRepresentative` representa una relación concreta de la
legalización. No debe reutilizarse como contenedor universal para cualquier
persona que aparezca en un documento. Un mismo individuo puede tener varios
roles en documentos distintos, y los roles tienen requisitos, firmas y
trazabilidad diferentes.

## Roles documentales

| Rol | Significado | Relación recomendada |
|---|---|---|
| Deudo notificado | Persona a quien se comunica el proceso | Participación de instancia, con fecha, medio y resultado |
| Representante de consentimiento | Persona que interviene en el consentimiento familiar | `DonationRepresentative` mientras la regla institucional lo limite a legalización |
| Testigo | Persona que presencia o certifica una actuación | Participación de instancia, sin inferir representación |
| Profesional responsable | Profesional que realiza o certifica una actividad | Participación con `systemUserId` o identidad profesional verificada |
| Firmante | Persona cuya firma aparece en el documento | Participación de firma, separada del cargo |
| Custodio | Persona que entrega, recibe, embala o conserva EMP/EF | Participación de cadena de custodia, con evento y fecha |

## Diseño recomendado

Crear posteriormente un agregado `DocumentParticipant` asociado a
`DocumentInstance`, no a `DonationLegalization` únicamente:

```text
DocumentParticipant
  id
  documentInstanceId
  roleCode
  systemUserId?             -> SYSTEM_USER
  externalPersonSnapshot?   -> JSONB validado
  nameSnapshot
  documentTypeSnapshot?
  documentNumberSnapshot?
  professionalIdSnapshot?
  relationshipToDonor?
  organizationSnapshot?
  signatureReference?
  signedAt?
  createdAt
```

El rol se guarda como código de catálogo versionado, por ejemplo
`NOTIFIED_RELATIVE`, `CONSENT_REPRESENTATIVE`, `WITNESS`,
`RESPONSIBLE_PHYSICIAN`, `SIGNATORY` o `CHAIN_CUSTODIAN`. No se deben deducir
roles a partir del nombre, del parentesco ni del rol global del usuario.

## Relaciones específicas

- `DonationRepresentative` se conserva para la legalización existente y sus
  reglas actuales.
- Una instancia documental puede referenciar participantes de la legalización,
  pero guarda un snapshot de lo que se mostró y firmó.
- Un profesional interno puede vincularse a `SystemUser`; un tercero se guarda
  como snapshot mínimo, con acceso restringido.
- Un custodio debe tener eventos de entrega/recepción independientes; no basta
  con una fila de participantes.
- Un firmante no implica que haya aprobado el documento.

## Reglas de seguridad y conservación

- Separar identidad, rol documental y firma.
- No guardar en metadata de auditoría información clínica innecesaria.
- No sobrescribir snapshots históricos si cambia el usuario o su nombre.
- Validar que un participante externo solo sea visible dentro del alcance
  institucional autorizado.
- Las cantidades mínimas de representantes, testigos o firmas son reglas
  jurídicas/institucionales pendientes de homologación.

## Decisión

Se recomienda un modelo común de participantes para documentos, más relaciones
especializadas para legalización y cadena de custodia. No se recomienda ampliar
`DonationRepresentative` con columnas para todos los roles.
