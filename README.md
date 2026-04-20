# Central de Relacionamentos v2

Dashboard React para analise operacional da Central de Relacionamentos (telefonia + tickets), com API local em Express e persistencia historica em SQLite para carga e atualizacao diaria.

- Versao atual: `3.3.0`
- Autor: `Giovane Melo`

## Novidades recentes

- Aba Resumo com novo card de evolucao diaria por tipo de ticket:
  - filtros por tipo: Transferencias, Erros no App, Outros
  - filtro por atendente: Equipe toda ou pessoa especifica
- Indicadores de telefonia na aba Resumo ajustados:
  - card de chamadas com foco em atendidas
  - taxa exibida como abandono/nao atendidas
- Otimizacoes de performance no frontend:
  - import dinamico de `xlsx` (carrega apenas ao processar planilha)
  - aba Resumo extraida para chunk lazy (`src/tabs/ResumoTab.jsx`)

## Aplicacao web

```bash
npm install
npm run dev
```

O comando acima sobe frontend + API local juntos, permitindo salvamento automatico no SQLite ao fazer drop/click na tela inicial.

Para iniciar tudo e abrir o navegador automaticamente no frontend, use:

```bash
npm run dev:open
```

Se estiver no VS Code, use o atalho de tarefa:

- `Ctrl+Shift+B` -> `Iniciar app (dev + abrir frontend)`

No Windows Explorer, voce tambem pode abrir direto com duplo clique no arquivo:

- `Iniciar-Central.cmd`

### Sincronizacao automatica no login master

Ao fazer login com perfil `master`, a API verifica automaticamente se a planilha abaixo foi atualizada:

- `C:\Users\geovane.melo\OneDrive - NDD.Tech\Documentos\NDD Cargo\Relatórios\Dashboard_Central.xlsx`

Regra:

- se a data de modificacao da planilha for mais nova que a ultima importacao desse mesmo arquivo, a importacao e executada automaticamente;
- se nao houve mudanca, nada e reimportado.

Configuracoes opcionais por variavel de ambiente:

- `MASTER_AUTO_SYNC_ENABLED=false` para desativar;
- `MASTER_AUTO_SYNC_FILE="caminho\da\planilha.xlsx"` para trocar o arquivo monitorado;
- `MASTER_AUTO_SYNC_YEAR=2026` para fixar o ano de referencia do parser.

Se quiser rodar apenas o frontend (sem persistencia no banco), use:

```bash
npm run dev:web
```

## Autenticacao e perfis

O sistema agora possui login com dois perfis:

- `master`
  - acesso completo ao dashboard
  - pode atualizar/importar dados
  - pode cadastrar novos usuarios
- `atendente`
  - pode acessar apenas seus atendimentos/tickets proprios
  - pode alternar para visualizar totais da equipe

No primeiro start com banco novo, um usuario master inicial e criado automaticamente:

- usuario: `master`
- senha: `master123`

Voce pode sobrescrever esses valores via variaveis de ambiente:

- `DEFAULT_MASTER_USER`
- `DEFAULT_MASTER_PASSWORD`

Recomendado: criar um novo master e trocar a senha inicial apos o primeiro acesso.

## Banco SQLite (separado do frontend)

### 1. Inicializar schema

```bash
npm run db:init
```

### 2. Importar dados do arquivo consolidado

```bash
npm run db:import -- "data/input/Dashboard_-_Central.xlsx"
```

### 3. Atualizacao diaria (idempotente)

```bash
npm run db:update-daily -- "data/input/Dashboard_-_Central.xlsx"
```

## Upload pela tela inicial e persistencia

- Com a API local ativa (`npm run dev:api` ou `npm run dev:full`), ao dropar ou selecionar o `.xlsx` no frontend o sistema:
  1.  Processa os dados na interface para exibicao imediata.
  2.  Envia o mesmo arquivo para `/api/import-dashboard`.
  3.  Salva no SQLite com upsert e mostra o status na tela.

## Estrutura criada para ETL

- `scripts/db/init-db.js`: cria schema do banco
- `scripts/db/import-dashboard.js`: le o xlsx e faz upsert
- `scripts/db/update-daily.js`: alias para rotina diaria
- `scripts/db/db.js`: conexao e schema
- `scripts/db/parser.js`: parser do layout documentado nos arquivos `.md`
- `data/sqlite/`: banco local (`*.db`, ignorado no Git)
- `data/input/`: pasta de entrada para arquivo diario

## Estrutura frontend (resumo)

- `src/App.jsx`: shell da aplicacao, navegacao por abas e layout principal
- `src/tabs/ResumoTab.jsx`: conteudo da aba Resumo (carregado com lazy import)
- `src/controllers/useDashboardController.js`: estado principal, filtros e integracao API
- `src/models/dashboardModel.js`: parse e agregacoes de negocio
- `src/utils.js`: funcoes utilitarias e normalizacao

## Observacoes de performance

- O bundle inicial foi reduzido com code splitting:
  - parser XLSX saiu do carregamento inicial
  - aba Resumo virou chunk sob demanda
- Primeiro acesso a aba Resumo pode mostrar fallback curto de carregamento.

## Documentacao

- Fluxo operacional geral: `Dashboard_Central_Documentacao.md`
- Contexto do dashboard e regras: `claude.md`
- ETL SQLite: `docs/sqlite-etl.md`
