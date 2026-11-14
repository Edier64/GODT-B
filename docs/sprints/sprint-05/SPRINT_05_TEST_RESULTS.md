# Sprint 05 — Resultados de pruebas backend

| Comando | Resultado |
|---|---|
| `npm run format:check` | Correcto |
| `npm run build` | Correcto |
| `npm test -- --runInBand` | 9 suites, 27 pruebas correctas |
| `npm run prisma:validate` | Correcto |
| `npm run test:integration` | 4 suites y 9 pruebas omitidas por variable/integración |
| `npx prisma migrate status` | Bloqueado: PostgreSQL no disponible |
| `docker compose config --quiet` | Correcto |
| `npm audit --audit-level=high` | Hallazgos transitivos; sin `audit fix --force` |

La prueba añadida valida que el contrato de consulta OCR devuelve el estado
persistido y el código de error junto con los campos.

No se ejecutaron pruebas HTTP/E2E contra backend real porque PostgreSQL, Redis
y el servidor NestJS no estaban disponibles.
