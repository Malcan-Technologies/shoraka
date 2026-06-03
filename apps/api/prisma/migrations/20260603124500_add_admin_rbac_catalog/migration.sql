CREATE TABLE "admin_roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_editable" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "admins"
ADD COLUMN "role_id" TEXT;

CREATE UNIQUE INDEX "admin_roles_key_key" ON "admin_roles"("key");
CREATE INDEX "admin_roles_is_system_idx" ON "admin_roles"("is_system");
CREATE INDEX "admin_roles_is_default_idx" ON "admin_roles"("is_default");
CREATE INDEX "admins_role_id_idx" ON "admins"("role_id");

ALTER TABLE "admins"
ADD CONSTRAINT "admins_role_id_fkey"
FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
