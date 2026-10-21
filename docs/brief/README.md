# Brief — Teste Prático: Desenvolvedor Fullstack

Transcrição fiel do PDF original (`teste-prático-desenvolvedor-fullstack.pdf`, nesta pasta), sem interpretação. A seção final, em inglês, relaciona cada requisito a épicos e histórias.

## Visão Geral

Crie uma aplicação mobile React Native (TypeScript) e um backend Node.js / TypeScript (opcional) para gerenciar Times e Tarefas. O foco é na qualidade do código, clareza arquitetural, testes, UX mínima e documentação das decisões.

## Entregáveis obrigatórios

- Repositório público com frontend e backend (pode ser monorepo).
- Backend em Node.js expondo uma API REST ou Graphql. Pode ser utilizado o framework de sua preferência (ex. NestJS, Express, Fastify ou outro), desde que a arquitetura esteja bem organizada e documentada.
- Frontend em React Native (TypeScript) consumindo a API.
- Formulários com validação (ex.: react-hook-form + zod).
- Gerenciamento de server state com React Query; state local (se necessário).
- Estilização sem styled-components (ex. NativeWind / Dripsy / TailwindRN).
- README com instruções claras para executar o projeto.
- Seeds/fixtures (dados iniciais) para facilitar avaliação (ex. 3 times e 10 tasks).

## O que não está sendo prescrito

Não detalhamos como você deve implementar o banco de dados ou qual ORM usar:

- Propor a solução de persistência (ex. Postgres, MongoDB, SQLite, etc.), justificar a escolha e descrever o modelo lógico (entidades e relacionamentos).
- Explicar como fará migrations/seeding e como irá garantir reprodutibilidade local.

## Funcionalidades (o que precisa ser implementado)

### Gestão de Times

- CRUD de times.
- Ao listar, retornar metadata (ex.: total/pagination).

### Gestão de Tarefas

- CRUD de tarefas (Pendente | Em Progresso | Concluída).
- Uma tarefa pode pertencer a zero ou mais times (relacionamento).
- Endpoints de listagem com suporte a filtros: teamId, status, search, ordenação e paginação.

### Frontend - telas mínimas

- Lista de times (tocar em um time filtra tarefas por time).
- Lista de tarefas (global e filtrada por time).
- Tela de criar/editar tarefa (form com validação).
- Visualizar tarefa (com ações rápidas: alterar status, deletar).
- Mostrar cor do time como label/chip na tarefa.

Figma Mockup: É um exemplo, porém pode ser feito com a sua própria ideia (o link do exemplo consta no PDF original).

## API - contratos / payloads (exemplos)

Você pode manter livre o formato exato, mas documente no README.

Exemplos (sugestão):

- `GET /api/teams?limit=&offset=&search=`
- `POST /api/teams { name, colorHex, description? }`
- `PUT /api/teams/:id`
- `DELETE /api/teams/:id`
- `GET /api/tasks?teamId=&status=&search=&limit=&offset=&sort=`
- `POST /api/tasks { title, description?, status?, dueDate?, teamIds? }`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

Resposta padrão sugerida: `200 { data, meta? }` e erros com um envelope `{ error: { code, message, details? } }`.

## Requisitos de Aceitação

- CRUD de times e tarefas funcional via API e interface.
- Listagem de tarefas suporta filtros teamId e status, search e paginação.
- Botão/ação para alterar status (p.ex. marcar como Concluída) atualiza backend e UI.
- Cores dos times aparecem como label/chip nas tarefas.
- Formulários possuem validação (ex.: title mínimo 3 caracteres).
- Documentação com instruções de execução local e exemplos de requests.
- Seed/fixtures presentes para avaliação rápida.

## Documentação Obrigatória

No README do seu projeto, inclua:

1. **Decisões arquiteturais** — Explique: por que escolheu determinado banco; como modelou entidades e relacionamentos; como organiza camadas do backend; por que escolheu certos patterns (ex. React Query, Zustand etc.).
2. **Modelo de dados** — Pode ser: um diagrama simples; ou uma explicação textual clara.
3. **Como rodar o projeto** — Passo a passo para backend e frontend.
4. **Exemplos de requisições** — Ex.: cURL, Insomnia, Postman.
5. **O que faria diferente em produção** — Pontos como cache, logs, escalabilidade, segurança.

## Diferenciais (opcionais)

- Offline-first (ex. MMKV)
- Optimistic updates (ex. React Query)
- Deploy backend em qualquer plataforma
- Testes mínimos: backend (unit + integration) e frontend (component test).
- Scripts: `start`, `test`, `seed`.

## Entrega

- Submeter repositório público (GitHub ou GitLab)
- README completo e funcional
- Garantir que o projeto inicia sem erros a partir do passo-a-passo

_Boa sorte!_

---

# Traceability (English)

Level: **MUST** = mandatory deliverable / acceptance requirement; **SHOULD** = brief's optional differentials. "Not pursued" items are documented decisions.

| Brief requirement                                                             | Level       | Epic → stories (spec)                                                                           |
| ----------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| Public repo, monorepo allowed                                                 | MUST        | Project setup (CLAUDE.md); delivery checklist in EP-07 (US-07.1)                                |
| Node/TS backend, REST, well-organized and documented architecture             | MUST        | EP-01–03 (specs 001–003) + ADRs; README decisions: US-07.4 (AC-07.4.5)                          |
| React Native + TypeScript frontend consuming the API                          | MUST        | EP-04 (US-04.2–04.9)                                                                            |
| Forms with validation (react-hook-form + zod)                                 | MUST        | EP-04: US-04.7, US-04.3, US-04.1; verifiable constraint US-04.15 (AC-04.15.2)                   |
| Server state with React Query; local state if needed                          | MUST        | EP-04: US-04.15 (AC-04.15.3); plan 004                                                          |
| Styling without styled-components                                             | MUST        | EP-04: US-04.15 (AC-04.15.1)                                                                    |
| README with clear run instructions                                            | MUST        | EP-07: US-07.1, US-07.4 (AC-07.4.7)                                                             |
| Seeds/fixtures (e.g. 3 teams, 10 tasks)                                       | MUST        | EP-07: US-07.2; EP-01: US-01.8; 002 / 003 seed tasks                                            |
| Propose and justify persistence; describe logical model                       | MUST        | EP-07: US-07.4 (AC-07.4.5, AC-07.4.6); data model in `docs/architecture`                        |
| Explain migrations/seeding and local reproducibility                          | MUST        | EP-07: US-07.1, US-07.2, US-07.4 (AC-07.4.6)                                                    |
| Team CRUD                                                                     | MUST        | EP-02: US-02.1, 02.5, 02.6, 02.7; UI US-04.3                                                    |
| Team listing returns metadata (total/pagination)                              | MUST        | EP-02: US-02.2 (and US-02.3 for the suggested `search`)                                         |
| Task CRUD with Pending / In progress / Done                                   | MUST        | EP-03: US-03.1, 03.8–03.11                                                                      |
| A task belongs to zero or more teams                                          | MUST        | EP-03: US-03.1, 03.9, 03.13                                                                     |
| Task listing filters teamId, status, search, sort, pagination                 | MUST        | EP-03: US-03.2–03.7; UI US-04.5 (status filter + search), US-04.14 (sort, COULD)                |
| Screen: teams list (tap filters tasks)                                        | MUST        | EP-04: US-04.2                                                                                  |
| Screen: tasks list (global and per team)                                      | MUST        | EP-04: US-04.4                                                                                  |
| Screen: create/edit task form with validation                                 | MUST        | EP-04: US-04.7                                                                                  |
| Screen: view task with quick actions (status, delete)                         | MUST        | EP-04: US-04.6                                                                                  |
| Team color as label/chip on the task                                          | MUST        | EP-04: US-04.8; EP-03: US-03.2/03.8 (embedded teams)                                            |
| Figma mockup is an example only                                               | —           | Not used; design lives in `docs/design/design-spec.md` (EP-04 design)                           |
| Contracts documented in the README (suggested endpoints and envelopes)        | MUST        | EP-07: US-07.4 (AC-07.4.7); constitution IV (envelope)                                          |
| Status-change action updates backend and UI                                   | MUST        | EP-03: US-03.10; EP-04: US-04.6 (AC-04.6.2)                                                     |
| Title minimum 3 characters                                                    | MUST        | EP-03: US-03.1 (AC-03.1.2); EP-04: US-04.7 (AC-04.7.2)                                          |
| Docs: run locally and request examples                                        | MUST        | EP-07: US-07.1, US-07.4                                                                         |
| README: architectural decisions; data model; how to run; requests; production | MUST        | EP-07: US-07.4 (AC-07.4.5–07.4.8); EP-06: US-06.8                                               |
| Offline-first                                                                 | SHOULD      | EP-05: US-05.1, 05.2, 05.5, 05.6, 05.7                                                          |
| Optimistic updates                                                            | SHOULD      | EP-05: US-05.3, 05.4, 05.5                                                                      |
| Deploy backend on any platform                                                | Not pursued | Out of scope by decision (vision: runs locally via Docker); production notes cover it (US-06.8) |
| Minimal tests: backend unit + integration, frontend component                 | SHOULD      | Test AC coverage criteria in EP-02/03/04; CI: US-07.6                                           |
| Scripts `start`, `test`, `seed`                                               | SHOULD      | EP-07: US-07.3                                                                                  |
| Delivery: public repo, complete README, starts without errors from the steps  | MUST        | EP-07: US-07.1 (AC-07.4.9 doc check; compose smoke US-07.6)                                     |

Extras beyond the brief (authentication and ownership, observability, idempotency, concurrency control, i18n/theme/a11y) are tagged COULD, except the access-control core of EP-01 which is MUST by project decision.
