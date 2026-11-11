/**
 * Script retirado de emisión de tokens JWT provisionales.
 *
 * La autenticación de GODT Regional 3 utiliza credenciales reales almacenadas en PostgreSQL
 * (tabla USER_CREDENTIAL con Argon2id) y sesiones persistidas (tabla AUTH_SESSION).
 *
 * Para aprovisionar usuarios autorizados sin registro público utilice:
 *   npm run auth:provision-user -- --email usuario@godt.gov.co --name "Nombre" --role COORDINATOR
 */

async function main(): Promise<void> {
  console.error(
    "[OBSOLETO] La emisión automática de tokens dev de 365 días y dev-tokens.json ha sido deshabilitada por seguridad.",
  );
  console.error(
    "Utilice el comando administrativo seguro: npm run auth:provision-user -- --email <correo> --name \"<nombre>\" --role <ROL>",
  );
  process.exitCode = 1;
}

void main();
