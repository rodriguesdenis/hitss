-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color_hex" CHAR(7) NOT NULL,
    "description" VARCHAR(280),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Raw SQL (not expressible in schema.prisma), plan 002 § Data.
-- BR-02.2: team names are unique per owner, case-insensitively, among active teams only
-- (a soft-deleted team frees its name, AC-02.1.7). Also backs the create race (AC-02.1.9) and
-- serves ORDER BY lower(name).
CREATE UNIQUE INDEX "teams_owner_id_lower_name_key"
  ON "teams" ("owner_id", lower("name")) WHERE "deleted_at" IS NULL;

-- Default listing: WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC, id DESC
-- (sort -createdAt, ties broken by id for stable offset pagination, ADR-0006).
CREATE INDEX "teams_owner_id_created_at_idx"
  ON "teams" ("owner_id", "created_at" DESC, "id" DESC) WHERE "deleted_at" IS NULL;

-- Integrity backstops; the domain normalizes the color (ColorHex) and owns versioning.
ALTER TABLE "teams" ADD CONSTRAINT "teams_color_hex_format" CHECK ("color_hex" ~ '^#[0-9A-F]{6}$');
ALTER TABLE "teams" ADD CONSTRAINT "teams_version_positive" CHECK ("version" >= 1);
ALTER TABLE "teams" ADD CONSTRAINT "teams_updated_after_created" CHECK ("updated_at" >= "created_at");
