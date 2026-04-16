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
- controlador: `src/controllers/useDashboardController.js`
- regras/modelo: `src/models/dashboardModel.js`
- utilitarios: `src/utils.js`

2. API local (Express)

- arquivo: `server/api.js`
- endpoints:
  - `GET /api/health`
  - `GET /api/dashboard-data`
  - `POST /api/import-dashboard` (multipart com campo `file`)

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

1. Usuario faz upload de `.xlsx` no frontend.
2. Frontend processa o workbook localmente para exibicao imediata.
3. Em paralelo, frontend envia o mesmo arquivo para `POST /api/import-dashboard`.
4. API valida extensao, salva upload e chama `importDashboardToSqlite()`.
5. ETL faz parse das abas e grava no SQLite com `INSERT ... ON CONFLICT DO UPDATE`.
6. Frontend pode restaurar/atualizar estado via `GET /api/dashboard-data`.

Modo incremental:

- envio com `onlyNew=true` importa apenas chaves ainda inexistentes.

---

## 4. Frontend (estado e responsabilidades)

### 4.1 Estado principal (controller)

- dados brutos em memoria: `cons`, `atend`, `tickets`
- filtros: `dateFrom`, `dateTo`
- navegacao: `tab`
- status de persistencia: `saveStatus`, `incrementalStatus`
- carregamento de banco: `isRestoring`

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

## 5. API Local

Arquivo: `server/api.js`

- `GET /api/health`
  - healthcheck simples.

- `GET /api/dashboard-data`
  - le dados das tabelas `atplus_cons_daily`, `atplus_attendant_daily`, `ellevo_tickets` e ultimo `import_runs`.

- `POST /api/import-dashboard`
  - upload via multer (limite 25 MB);
  - aceita `.xlsx` e `.xls`;
  - opcional: `year` e `onlyNew`.

---

## 6. SQLite e ETL

### 6.1 Banco

- caminho padrao: `data/sqlite/central_relacionamentos.db`
- tabelas:
  - `import_runs`
  - `atplus_cons_daily`
  - `atplus_attendant_daily`
  - `ellevo_tickets`

### 6.2 Chaves e idempotencia

- `atplus_cons_daily`: `UNIQUE (data_key, fila)`
- `atplus_attendant_daily`: `UNIQUE (data_key, fila, ramal)`
- `ellevo_tickets`: `chamado` unico

### 6.3 Entrada esperada

Workbook com abas:

- `Cola_Atplus_Cons`
- `Cola_Atplus_Atend`
- `Cola_Ellevo`

Leitura via `sheet_to_json(..., { header: 1, range: 3 })`, ou seja, dados a partir da linha 4.

### 6.4 Comandos principais

```bash
npm run dev
npm run dev:web
npm run dev:api
npm run db:init
npm run db:import -- "data/input/Dashboard_-_Central.xlsx"
npm run db:update-daily -- "data/input/Dashboard_-_Central.xlsx"
```

---

## 7. Arquivos de Referencia

- fluxo funcional do produto: `Dashboard_Central_Documentacao.md`
- operacao ETL SQLite: `docs/sqlite-etl.md`
- app React: `src/App.jsx`
- controller principal: `src/controllers/useDashboardController.js`
- modelo de transformacoes: `src/models/dashboardModel.js`
- API local: `server/api.js`

---

## 8. Limitacoes Conhecidas (estado atual)

- entrada oficial ainda depende do Excel consolidado (nao ha ingestao direta de CSV Atplus nesta camada).
- regras de categorizacao e mapeamento de agentes sao estaticas em codigo.
- parsing de datas pt-BR sem ano depende de ano de referencia enviado/assumido.

---

## 9. Resumo da Evolucao para v2

Comparado ao desenho anterior, o sistema agora:

- nao e mais apenas visualizacao client-side;
- possui API para ingestao e restauracao de dados;
- grava historico em SQLite com importacao idempotente;
- suporta rotina de atualizacao diaria sem duplicar dados.
  | **Qualificação** | Classificação secundária detalhada do ticket |
  | **Severidade** | Nível de urgência: Nível 1 (baixa), Nível 2 (média), Nível 3 (alta) |

---

## 14. INSTRUÇÕES PARA EDIÇÃO CONTÍNUA

Ao modificar o `App.jsx`:

1. **Mantenha o single-file** — tudo em um único arquivo `.jsx` para funcionar como artifact React
2. **Não use localStorage/sessionStorage** — não funciona no ambiente de artifacts
3. **Libs disponíveis**: React, Recharts, SheetJS (xlsx), lodash, d3, Three.js, Papaparse, shadcn/ui, Chart.js, Tone, mammoth, tensorflow, lucide-react, MathJS, Plotly
4. **Tailwind**: apenas classes core utilities (sem compilador)
5. **CSS**: inline styles (padrão atual do app)
6. **Export**: deve ter `export default function App()`
7. **Sem props obrigatórios** no componente raiz
8. **Imagens/assets**: não há acesso a assets externos além de CDN pública

### Para adicionar nova fonte de dados (ex: CSV direto):

- Use `Papaparse` para parse de CSV
- Mantenha o padrão de state: `const [novosDados, setNovosDados] = useState([])`
- Aplique o mesmo filtro de datas via `inRange()`

### Para adicionar novo agente:

- Adicione entrada em `AGENT_MAP` com nome AtPlus → nome Ellevo
