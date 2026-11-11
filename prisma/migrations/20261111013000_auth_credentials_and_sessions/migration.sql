-- CreateTable
CREATE TABLE "USER_CREDENTIAL" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "USER_CREDENTIAL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AUTH_SESSION" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(128) NOT NULL,
    "replaced_by_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_reason" VARCHAR(100),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AUTH_SESSION_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "USER_CREDENTIAL_user_id_key" ON "USER_CREDENTIAL"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "AUTH_SESSION_refresh_token_hash_key" ON "AUTH_SESSION"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "AUTH_SESSION_user_id_idx" ON "AUTH_SESSION"("user_id");

-- CreateIndex
CREATE INDEX "AUTH_SESSION_family_id_idx" ON "AUTH_SESSION"("family_id");

-- CreateIndex
CREATE INDEX "AUTH_SESSION_expires_at_idx" ON "AUTH_SESSION"("expires_at");

-- AddForeignKey
ALTER TABLE "USER_CREDENTIAL" ADD CONSTRAINT "USER_CREDENTIAL_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "SYSTEM_USER"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AUTH_SESSION" ADD CONSTRAINT "AUTH_SESSION_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "SYSTEM_USER"("id") ON DELETE CASCADE ON UPDATE CASCADE;

