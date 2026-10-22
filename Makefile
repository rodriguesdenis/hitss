# Short aliases for the Docker-only paths (ADR-0018, spec 007 US-07.3). Every recipe is echoed, so
# the raw `docker compose` command is visible for anyone without make (e.g. on Windows).
# `make` with no target prints this list.

.DEFAULT_GOAL := help
.PHONY: help up down logs reset seed test test-all test-docker smoke

help: ## List the available aliases
	@echo 'Usage: make <alias>'
	@echo
	@awk 'BEGIN { FS = ":.*## " } /^[a-z-]+:.*## / { printf "  %-14s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

up: ## Build and start PostgreSQL, the migrations and the API (only Docker needed)
	docker compose up -d --build --wait

down: ## Stop the stack (keeps the database volume)
	docker compose down

logs: ## Follow the API logs
	docker compose logs -f api

reset: ## Drop the database volume and start again from scratch
	docker compose down -v
	docker compose up -d --build --wait

seed: ## Re-apply the demo data in the running API container (idempotent)
	docker compose exec api sh -c 'DATABASE_URL="$$(node database-url.cjs)" node dist/seed/run.js'

test: ## Unit tests on the host (needs Node 24 and pnpm)
	pnpm test

test-all: ## Every suite: unit, integration and e2e on the host (needs Docker for Testcontainers)
	pnpm test:all

# Best effort (OQ-07.1): runs the suite in a throwaway container on a copy of the repository
# (node_modules and .git are not copied), so the host stays untouched. The image is the one the API
# Dockerfile pins (a single source of truth: ARG NODE_IMAGE there). The unit tests need no Docker, so
# the Docker socket (root-equivalent on the host) is mounted only for TARGET=test:all/test:integration/
# test:e2e, which run Testcontainers through the host's Docker.
TARGET ?= test
NODE_IMAGE ?= $(shell sed -n 's/^ARG NODE_IMAGE=//p' apps/api/Dockerfile)
ifeq ($(TARGET),test)
TEST_DOCKER_SOCKET :=
else
TEST_DOCKER_SOCKET := -v /var/run/docker.sock:/var/run/docker.sock -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal --add-host host.docker.internal:host-gateway
endif
test-docker: ## Run the unit tests in a throwaway container (TARGET=test:all for every suite)
	docker run --rm -v "$(CURDIR)":/src:ro $(TEST_DOCKER_SOCKET) \
		$(NODE_IMAGE) sh -c 'mkdir /repo && cd /src && tar --exclude=node_modules --exclude=.git -cf - . | tar -xf - -C /repo \
		&& cd /repo && corepack enable && pnpm install --frozen-lockfile && pnpm $(TARGET)'

smoke: ## Fresh-stack smoke test: the evaluator's one command and its failure modes
	tools/ci/compose-smoke.sh
