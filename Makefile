# Short aliases for the Docker-only paths (ADR-0018, spec 007 US-07.3). Every recipe is echoed, so
# the raw `docker compose` command is visible for anyone without make (e.g. on Windows).
# `make` with no target prints this list.

.DEFAULT_GOAL := help
.PHONY: help up down logs reset test test-all test-docker smoke

help: ## List the available aliases
	@echo 'Usage: make <alias>'
	@echo
	@awk 'BEGIN { FS = ":.*## " } /^[a-z-]+:.*## / { printf "  %-14s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo
	@echo 'Not available yet (they land with the task that adds what they run):'
	@echo '  seed                 re-apply the demo data (T-007-07)'
	@echo '  observability        start with the telemetry backend (T-006-xx, SigNoz profile)'
	@echo '  observability-down   stop the telemetry backend'
	@echo '  mobile               Metro for Expo Go in Docker (T-007-13)'
	@echo '  load                 k6 load test (T-006-xx)'

up: ## Build and start PostgreSQL, the migrations and the API (only Docker needed)
	docker compose up -d --build --wait

down: ## Stop the stack (keeps the database volume)
	docker compose down

logs: ## Follow the API logs
	docker compose logs -f api

reset: ## Drop the database volume and start again from scratch
	docker compose down -v
	docker compose up -d --build --wait

test: ## Unit tests on the host (needs Node 24 and pnpm)
	pnpm test

test-all: ## Every suite: unit, integration and e2e on the host (needs Docker for Testcontainers)
	pnpm test:all

# Best effort (OQ-07.1): runs the suite in a throwaway Node 24 container on a copy of the
# repository (node_modules and .git are not copied), so the host stays untouched.
# TARGET=test:all also runs the Testcontainers suites through the host's Docker socket.
TARGET ?= test
test-docker: ## Run the unit tests in a throwaway Node 24 container (TARGET=test:all for every suite)
	docker run --rm -v "$(CURDIR)":/src:ro -v /var/run/docker.sock:/var/run/docker.sock \
		-e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal --add-host host.docker.internal:host-gateway \
		node:24 sh -c 'mkdir /repo && cd /src && tar --exclude=node_modules --exclude=.git -cf - . | tar -xf - -C /repo \
		&& cd /repo && corepack enable && pnpm install --frozen-lockfile && pnpm $(TARGET)'

smoke: ## Fresh-stack smoke test: the evaluator's one command and its failure modes
	tools/ci/compose-smoke.sh
