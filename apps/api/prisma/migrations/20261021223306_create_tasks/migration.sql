-- pg_trgm first: the generated GIN index tasks_search_trgm_idx uses gin_trgm_ops.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000),
    "status" "task_status" NOT NULL DEFAULT 'PENDING',
    "due_date" DATE,
    "completed_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_teams" (
    "task_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_teams_pkey" PRIMARY KEY ("task_id","team_id")
);

-- CreateIndex
CREATE INDEX "tasks_search_trgm_idx" ON "tasks" USING GIN ("title" gin_trgm_ops, "description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "task_teams_team_id_task_id_idx" ON "task_teams"("team_id", "task_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_teams" ADD CONSTRAINT "task_teams_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_teams" ADD CONSTRAINT "task_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Raw SQL (not expressible in schema.prisma), plan 003 § Data. Never drop these in a later
-- generated migration; schema-drift.int-spec.ts keeps schema and migrations in step.
-- (tasks_search_trgm_idx is declared in schema.prisma and generated above.)
-- Integrity backstops: the domain owns the rules (trimming, transitions, clock); the database
-- refuses impossible rows.
-- BR-03.1: 3-120 characters (varchar(120) caps the top; trimming stays in the domain).
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_title_len" CHECK (char_length("title") BETWEEN 3 AND 120);
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_version_pos" CHECK ("version" >= 1);
-- BR-03.5: completed_at is set exactly when the task is DONE.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_done" CHECK (("status" = 'DONE') = ("completed_at" IS NOT NULL));
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_after_created" CHECK ("updated_at" >= "created_at");

-- Listing indexes end with id: every sort is tie-broken by id for stable offset pagination.
-- Status filter + default sort (-createdAt), the hottest query.
CREATE INDEX "tasks_owner_status_created_idx"
  ON "tasks" ("owner_id", "status", "created_at" DESC, "id" DESC) WHERE "deleted_at" IS NULL;
-- Default listing without a status filter, and count(*) per owner.
CREATE INDEX "tasks_owner_created_idx"
  ON "tasks" ("owner_id", "created_at" DESC, "id" DESC) WHERE "deleted_at" IS NULL;
-- sort=dueDate ascending (ASC NULLS LAST is the B-tree order). DESC NULLS LAST cannot use this
-- index order (a backward scan would put NULLs first) and sorts the owner's rows instead, which
-- is acceptable at per-owner cardinality.
CREATE INDEX "tasks_owner_due_idx"
  ON "tasks" ("owner_id", "due_date", "id") WHERE "deleted_at" IS NULL;
