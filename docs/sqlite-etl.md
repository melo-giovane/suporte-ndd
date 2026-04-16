# SQLite ETL - Central de Relacionamentos

Este projeto agora possui uma base SQLite separada para armazenar historico de dados extraidos dos sistemas (Atplus e Ellevo) a partir do arquivo `Dashboard_-_Central.xlsx`.

## Banco de dados

- Caminho padrao: `data/sqlite/central_relacionamentos.db`
- Tabelas principais:
  - `atplus_cons_daily`
  - `atplus_attendant_daily`
  - `ellevo_tickets`
  - `import_runs`

## Fluxo de carga

1. Coloque o arquivo de entrada em `data/input/` (ou passe um caminho explicito).
2. Execute a carga com upsert (idempotente):

```bash
npm run db:import -- "data/input/Dashboard_-_Central.xlsx"
```

3. Para rotina diaria use o mesmo comando (ou o alias):

```bash
npm run db:update-daily -- "data/input/Dashboard_-_Central.xlsx"
```

Os comandos fazem `INSERT ... ON CONFLICT DO UPDATE`, evitando duplicidade e atualizando registros alterados.

## Integracao com a tela inicial (drop/upload)

- Suba a API local:

```bash
npm run dev:api
```

- Ou rode tudo junto:

```bash
npm run dev:full
```

- Endpoint usado pelo frontend:
  - `POST /api/import-dashboard`
  - Multipart: campo `file` com o arquivo `.xlsx`
  - Opcional: `year` (ano de referencia para datas pt-BR sem ano)

## Inicializacao do schema

```bash
npm run db:init
```

## Parametros opcionais

- `--db=CAMINHO_DB` para usar outro arquivo de banco.
- `--year=AAAA` para definir o ano de referencia ao converter datas pt-BR sem ano (`"15 de Marco"`).

Exemplo:

```bash
npm run db:import -- "data/input/Dashboard_-_Central.xlsx" --year=2026 --db=data/sqlite/central.db
```

## Observacoes de modelagem

- `ellevo_tickets` usa `chamado` como chave unica.
- `atplus_cons_daily` usa chave unica (`data_key`, `fila`).
- `atplus_attendant_daily` usa chave unica (`data_key`, `fila`, `ramal`).
- `import_runs` registra cada execucao de importacao para auditoria.
