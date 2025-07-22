-- Create Role table
CREATE TABLE "roles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- Create unique index on role name
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- Create Permission table
CREATE TABLE "permissions" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- Create unique index on permission name
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- Create AuthEvent table
CREATE TABLE "auth_events" (
  "id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "user_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

-- Create indexes on auth_events
CREATE INDEX "auth_events_user_id_idx" ON "auth_events"("user_id");
CREATE INDEX "auth_events_event_type_idx" ON "auth_events"("event_type");

-- Create join tables for many-to-many relationships
CREATE TABLE "_RoleToUser" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE TABLE "_PermissionToUser" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

-- Create unique indexes on join tables
CREATE UNIQUE INDEX "_RoleToUser_AB_unique" ON "_RoleToUser"("A", "B");
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

CREATE UNIQUE INDEX "_PermissionToUser_AB_unique" ON "_PermissionToUser"("A", "B");
CREATE INDEX "_PermissionToUser_B_index" ON "_PermissionToUser"("B");

-- Add foreign key constraints
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_PermissionToUser" ADD CONSTRAINT "_PermissionToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PermissionToUser" ADD CONSTRAINT "_PermissionToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; 