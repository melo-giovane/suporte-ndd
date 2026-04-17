# CLAUDE.md — Central de Relacionamentos (v2)

Documento de contexto para desenvolvimento e manutencao do sistema.
Ultima atualizacao: 16/04/2026

---

## 1. Visao Geral

O projeto evoluiu para uma arquitetura v2 com:

- frontend React (Vite) para visualizacao e interacao;
- API local em Express para ingestao e consulta;
- persistencia historica em SQLite com upsert/idempotencia;
- scripts de ETL para carga inicial e atualizacao incremental.

Dominio: Central de Relacionamentos (telefonia Atplus + tickets Ellevo), com entrada principal em arquivo Excel consolidado (`Dashboard_-_Central.xlsx`).

---

## 2. Arquitetura Atual do Sistema

### 2.1 Camadas

1. Frontend (React + Recharts)

- arquivo principal: `src/App.jsx`
- aba resumo (lazy): `src/tabs/ResumoTab.jsx`
- controlador: `src/controllers/useDashboardController.js`
- regras/modelo: `src/models/dashboardModel.js`
- utilitarios: `src/utils.js`

2. API local (Express)

- arquivo: `server/api.js`
- autenticacao: `scripts/db/auth.js`
- endpoints principais:
  - `POST /api/auth/login` / `POST /api/auth/logout` / `GET /api/auth/me`
  - `GET /api/users` / `GET /api/users/link-options` / `POST /api/users` (master only)
  - `GET /api/health`
  - `GET /api/dashboard-data`
  - `POST /api/import-dashboard` (multipart, master only)

3. Persistencia (SQLite)

- conexao/schema: `scripts/db/db.js`
- parser do layout Excel: `scripts/db/parser.js`
- servico de importacao: `scripts/db/import-service.js`
- rotinas CLI:
  - `scripts/db/init-db.js`
  - `scripts/db/import-dashboard.js`
  - `scripts/db/update-daily.js`

### 2.2 Estrutura de pastas (resumo)

```
central-relacionamentos/
  src/
    App.jsx
    tabs/ResumoTab.jsx
    controllers/useDashboardController.js
    models/dashboardModel.js
    utils.js
  server/
    api.js
  scripts/db/
    db.js
    parser.js
    import-service.js
    import-dashboard.js
    update-daily.js
    init-db.js
  data/
    input/
      uploads/
    sqlite/
```

---

## 3. Fluxo de Dados v2

1. Usuario autentica via `POST /api/auth/login` e recebe token de sessao.
2. Frontend carrega dados do banco via `GET /api/dashboard-data` (token Bearer).
3. Usuario master faz upload de `.xlsx` no frontend.
4. Frontend envia o arquivo para `POST /api/import-dashboard`.
5. API valida extensao, salva upload e chama `importDashboardToSqlite()`.
6. ETL faz parse das abas e grava no SQLite com `INSERT ... ON CONFLICT DO UPDATE`.
7. Frontend recarrega estado via `GET /api/dashboard-data`.

Modo incremental:

- envio com `onlyNew=true` importa apenas chaves ainda inexistentes.

---

## 4. Frontend (estado e responsabilidades)

### 4.1 Estado principal (controller)

Assinatura: `useDashboardController({ authToken, viewScope, canUpload, onUnauthorized })`

- dados brutos em memoria: `cons`, `atend`, `tickets`
- filtros: `dateFrom`, `dateTo`
- navegacao: `tab`
- visibilidade de series: `seriesVis`
- metrica selecionada: `metricSel`
- flag de carregamento: `loaded`
- status de persistencia: `saveStatus`, `incrementalStatus`, `reprocessStatus`
- carregamento de banco: `isRestoring`
- totais agregados da equipe (scope team): `teamTotals`
- refs de upload: `incrementalFileRef`, `reprocessFileRef`

### 4.2 Calculos e agregacoes (model)

- parse das abas do workbook: `parseWorkbookData`
- filtro por periodo: `filterByDateRange`
- KPIs: `buildKpis`
- agregacoes de graficos: `aggregateBy`
- visao de equipe: `buildEquipeData`
- serie diaria: `buildDailyChart`

### 4.3 Regras de negocio relevantes

- `status` de ticket: `Aberto` quando fechamento vazio ou `-`.
- categorias de ticket normalizadas por regex (`normalize`).
- cruzamento telefone x tickets via `AGENT_MAP`.
- datas em pt-BR sem ano dependem de ano de referencia no parser.

---

## 5. Autenticacao e Perfis

Arquivo: `scripts/db/auth.js`

Autenticacao por sessao em memoria (Map no processo Express). Token Bearer enviado em cada requisicao.

Perfis:
- `master`: acesso completo, pode importar dados e gerenciar usuarios.
- `atendente`: acesso limitado aos proprios atendimentos/tickets; pode alternar para ver totais da equipe.

No primeiro start com banco novo, um usuario master inicial e criado automaticamente (sobrescrevivel via `DEFAULT_MASTER_USER` / `DEFAULT_MASTER_PASSWORD`).

---

## 6. API Local

Arquivo: `server/api.js`

### Autenticacao

- `POST /api/auth/login`
  - body: `{ username, password }`
  - retorna: `{ token, user }`

- `POST /api/auth/logout`
  - requer Bearer token; invalida a sessao.

- `GET /api/auth/me`
  - retorna dados do usuario autenticado.

### Gestao de usuarios (master only)

- `GET /api/users`
  - lista todos os usuarios.

- `GET /api/users/link-options`
  - lista atendentes disponiveis para vincular a um usuario.

- `POST /api/users`
  - body: `{ username, password, role, attendantId }`
  - cria novo usuario; para perfil `atendente`, `attendantId` e obrigatorio.

### Dashboard

- `GET /api/health`
  - healthcheck simples.

- `GET /api/dashboard-data`
  - requer Bearer token;
  - query: `?scope=own|team` (master sempre recebe `team`);
  - le dados das tabelas `atplus_cons_daily`, `atplus_attendant_daily`, `ellevo_tickets` e ultimo `import_runs`;
  - retorna tambem `teamTotals` (agregado geral sem filtro de data).

- `POST /api/import-dashboard`
  - master only; upload via multer (limite 25 MB);
  - aceita `.xlsx` e `.xls`;
  - opcional: `year` e `onlyNew`.

---

## 7. SQLite e ETL

### 7.1 Banco

- caminho padrao: `data/sqlite/central_relacionamentos.db`
- tabelas:
  - `import_runs`
  - `atplus_cons_daily`
  - `atplus_attendant_daily`
  - `ellevo_tickets`

### 7.2 Chaves e idempotencia

- `atplus_cons_daily`: `UNIQUE (data_key, fila)`
- `atplus_attendant_daily`: `UNIQUE (data_key, fila, ramal)`
- `ellevo_tickets`: `chamado` unico

### 7.3 Entrada esperada

Workbook com abas:

- `Cola_Atplus_Cons`
- `Cola_Atplus_Atend`
- `Cola_Ellevo`

Leitura via `sheet_to_json(..., { header: 1, range: 3 })`, ou seja, dados a partir da linha 4.

### 7.4 Comandos principais

```bash
npm run dev
npm run dev:web
npm run dev:api
npm run db:init
npm run db:import -- "data/input/Dashboard_-_Central.xlsx"
npm run db:update-daily -- "data/input/Dashboard_-_Central.xlsx"
```

---

## 8. Arquivos de Referencia

- fluxo funcional do produto: `Dashboard_Central_Documentacao.md`
- operacao ETL SQLite: `docs/sqlite-etl.md`
- app React: `src/App.jsx`
- controller principal: `src/controllers/useDashboardController.js`
- modelo de transformacoes: `src/models/dashboardModel.js`
- API local: `server/api.js`
- autenticacao: `scripts/db/auth.js`

---

## 9. Limitacoes Conhecidas (estado atual)

- entrada oficial ainda depende do Excel consolidado (nao ha ingestao direta de CSV Atplus nesta camada).
- regras de categorizacao e mapeamento de agentes sao estaticas em codigo.
- parsing de datas pt-BR sem ano usa `new Date().getFullYear()` — dados que cruzam virada de ano podem precisar de ajuste manual.

## 10. Atualizacoes recentes (16/04/2026)

- Indicadores da aba Resumo ajustados em Telefonia:
  - card de chamadas com foco em atendidas
  - taxa alterada para abandono/nao atendidas
- Novo card duplicado de evolucao diaria na aba Resumo:
  - serie por tipo de ticket (Transferencias, Erros no App, Outros)
  - filtro por atendente (Equipe toda ou individual)
- Otimizacao de bundle:
  - `xlsx` removido do bundle inicial com import dinamico no controller
  - aba Resumo extraida para `src/tabs/ResumoTab.jsx` com lazy loading via `React.lazy`
- Efeito esperado:
  - melhor tempo de carregamento inicial
  - primeiro acesso a Resumo pode exibir fallback curto de carregamento

---

## 11. Resumo da Evolucao para v3

Comparado ao desenho v2, o sistema agora:

- possui autenticacao por perfis (`master` e `atendente`);
- atendente ve apenas seus proprios dados (ou totais da equipe);
- frontend carrega dados exclusivamente do banco (sem parse local do xlsx);
- `teamTotals` retornado pela API para comparacao sem filtro de data.

---

## 12. INSTRUCOES PARA EDICAO CONTINUA

Ao modificar o frontend:

1. Mantenha `src/App.jsx` como shell de navegacao e layout principal.
2. Prefira extrair blocos grandes de UI para componentes em `src/tabs/` para facilitar code splitting.
3. Preserve lazy loading nas abas pesadas (ex.: Resumo) para evitar aumento do bundle inicial.
4. Evite imports pesados no topo do App/controller quando houver opcao de import dinamico.
5. Mantenha estilos inline como padrao atual do projeto.
6. Nao quebre as assinaturas principais de dados vindas de `useDashboardController`.
7. Sempre validar com `npm run build` apos mudancas estruturais.

### Para adicionar nova fonte de dados (ex: CSV direto):

- Use `Papaparse` para parse de CSV
- Mantenha o padrao de state no controller (`useDashboardController`)
- Aplique o mesmo filtro de datas da funcao `filterByDateRange`

### Para adicionar novo agente:

- Adicione entrada em `AGENT_MAP` com nome AtPlus → nome Ellevo
