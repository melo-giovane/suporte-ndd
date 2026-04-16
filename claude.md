# CLAUDE.md — Central de Relacionamentos Dashboard

> Documento de contexto para trabalho contínuo no `App.jsx`.
> Última atualização: 15/04/2026

---

## 1. VISÃO GERAL DO PROJETO

Dashboard operacional React (single-file `App.jsx`) para a **Central de Relacionamentos** da empresa **NDD Cargo / Portal TAC**. Consolida dados de **telefonia** (plataforma AtPlus) e **tickets de suporte** (plataforma Ellevo) em uma interface visual interativa com tema dark.

O app roda como artifact React no Claude.ai — sem build externo, sem backend. O usuário faz upload de um `.xlsx` (o "Dashboard_Central.xlsx") diretamente na interface, e o app parseia e exibe tudo client-side via `SheetJS (xlsx)` + `Recharts`.

---

## 2. ARQUITETURA DO App.jsx

### 2.1 Stack & Dependências

| Lib | Import | Uso |
|-----|--------|-----|
| React | `useState, useMemo, useCallback, useRef` | State & memoização |
| Recharts | `BarChart, PieChart, LineChart, AreaChart, etc.` | Gráficos |

> **SheetJS foi removido.** O app agora lê CSVs brutos diretamente (sem precisar montar o `Dashboard_Central.xlsx`).  
> O parsing é feito com funções nativas — sem dependência de biblioteca de CSV.

### 2.2 Constantes Globais

```js
// Paleta de cores (tema dark)
const P = {
  bg: "#0c0e14",       // fundo geral
  card: "#13161f",      // fundo dos cards
  cardH: "#191d2a",     // card hover
  bdr: "#1e2233",       // bordas
  accent: "#3b82f6",    // azul principal
  green: "#10b981",     // sucesso
  red: "#ef4444",       // erro/alerta
  orange: "#f59e0b",    // warning/TMA
  purple: "#8b5cf6",    // tickets
  cyan: "#06b6d4",      // TME
  pink: "#ec4899",      // responsáveis
  text: "#e2e8f0",      // texto principal
  dim: "#64748b",       // texto secundário
  muted: "#334155",     // texto terciário
};

// Cores para gráficos de pizza/barras (13 cores cíclicas)
const PIE_C = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#6366f1","#14b8a6","#f97316","#a855f7","#22d3ee","#fb7185"];

// Mapeamento nome AtPlus → nome Ellevo (para cruzar telefonia × tickets)
const AGENT_MAP = {
  "Marcos - Central":           "Marcos Costa",
  "Gessica Freitas Becker":     "GESSICA FREITAS BECKER",
  "Matheus - Central":          "Matheus Lucas de Carvalho",
  "Isaque - Central":           "Isaque de Oliveira dos Santos",
  "Diego - Central":            "Diego Dias Fernandes"
};

// Mapeamento de meses em português → número (para parse de datas "14 de Abril")
const MONTHS_PT = {"Janeiro":1,"Fevereiro":2,"Março":3,...,"Dezembro":12};
```

### 2.3 Funções Utilitárias

| Função | O que faz |
|--------|-----------|
| `parseDataPt(s)` | Converte string `"14 de Abril"` → `Date(2026, 3, 14)`. Hardcoded para 2026. |
| `parseSec(v)` | Converte `"178 s"` ou `178` → inteiro `178` (segundos). |
| `fmtSec(s)` | Formata segundos → `"2m54s"` ou `"45s"`. |
| `fmtPct(v)` | Formata decimal → `"82.4%"`. |
| `normalize(cat)` | Classifica título do ticket em categorias normalizadas via regex. |
| `splitTitulo(t)` | Separa `"Transferência - FULANO"` em `["Transferência", "FULANO"]`. |

### 2.4 Componentes Internos

| Componente | Props | Descrição |
|------------|-------|-----------|
| `KPI` | `label, value, sub, color, icon` | Card de indicador com hover effect |
| `Section` | `title, icon, children` | Seção com título e ícone emoji |
| `Table` | `headers, rows` | Tabela responsiva com zebra-striping |
| `TT` | `active, payload, label` | Tooltip customizado para Recharts |
| `ChartCard` | `title, children, h` | Container para gráfico com título |
| `TabBtn` | `id, icon, label` | Botão de aba na navegação |

### 2.5 Estado Principal (`App`)

```
cons[]        ← dados da aba Cola_Atplus_Cons (consolidado diário de chamadas)
atend[]       ← dados da aba Cola_Atplus_Atend (atendentes por dia)
tickets[]     ← dados da aba Cola_Ellevo (tickets Ellevo)
loaded        ← boolean — se arquivo foi carregado
tab           ← "resumo" | "telefonia" | "tickets" | "equipe"
dateFrom      ← filtro data início (string ISO "YYYY-MM-DD")
dateTo        ← filtro data fim
```

### 2.6 Abas do Dashboard

| Aba | Conteúdo |
|-----|----------|
| **Resumo** | KPIs de telefonia + tickets, gráficos de volume diário, TMA/TME, pizza de categorias, barras de severidade |
| **Telefonia** | Tabela detalhamento diário, ranking de atendentes, gráfico taxa de atendimento |
| **Tickets** | Gráficos por categoria/qualificação/natureza/responsável, tabelas detalhadas, tickets em aberto |
| **Equipe** | Visão unificada telefone+tickets por atendente, gráfico produtividade, alertas automáticos |

### 2.7 Fluxo de Dados

```
[Usuário arrasta .xlsx] → handleFile()
  ├── Lê aba "Cola_Atplus_Cons" (header na row 3, dados a partir da row 4)
  │   → setCons([{data, total, atendidas, naoAtendidas, abandonadas, txAbandono, tma, tme, dateReal}])
  ├── Lê aba "Cola_Atplus_Atend" (header na row 3, dados a partir da row 4)
  │   → setAtend([{data, ramal, tentativas, atendidas, perdidas, tma, tme, dateReal}])
  └── Lê aba "Cola_Ellevo" (header na row 3, dados a partir da row 4)
      → setTickets([{chamado, titulo, natureza, responsavel, qualificacao, severidade, categoria, dateReal, status}])

[Filtro de datas] → inRange(date) filtra cons/atend/tickets → fCons, fAtend, fTickets

[KPIs] ← useMemo sobre fCons + fTickets
[Gráficos] ← useMemo: catData, sevData, natData, qualData, respData, equipe, dailyChart
```

---

## 3. ESTRUTURA DO ARQUIVO .XLSX DE ENTRADA

O arquivo `Dashboard_-_Central.xlsx` tem **8 abas**. O App.jsx lê **3 abas de dados brutos**:

### 3.1 Aba `Cola_Atplus_Cons` — Consolidado Diário de Chamadas

> Fonte: relatório exportado do AtPlus (fila de atendimento telefônico)

| Coluna (idx) | Nome | Tipo | Exemplo |
|---|---|---|---|
| A (0) | Data | string pt-BR | `"14 de Abril"` |
| B (1) | Fila | string | `"NDD Cargo - Central de atendimentos"` |
| C (2) | Total de Chamadas | int | `51` |
| D (3) | Chamadas Atendidas | int | `42` |
| E (4) | Chamadas capturadas | int | `0` |
| F (5) | Chamadas não atendidas | int | `0` |
| G (6) | Chamadas Abandonadas | int | `9` |
| H (7) | Tx Abandonadas/Não Atendidas | float | `0.1765` |
| I (8) | TMA | string | `"174 s"` |
| J (9) | TME | string | `"27 s"` |
| K (10) | TMA(s) | int | `174` |
| L (11) | TME(s) | int | `27` |

- **Header**: row 3 (índice de leitura `range:2`)
- **Dados**: row 4+
- **Intervalo atual**: 2 de Janeiro a 14 de Abril (100 dias úteis)
- **App lê colunas por índice**: `r[0]`=data, `r[2]`=total, `r[3]`=atendidas, `r[5]`=naoAtend, `r[6]`=abandon, `r[7]`=txAbandono, `r[8]`=TMA, `r[9]`=TME

### 3.2 Aba `Cola_Atplus_Atend` — Dados por Atendente/Dia

| Coluna (idx) | Nome | Tipo | Exemplo |
|---|---|---|---|
| A (0) | Data | string pt-BR | `"14 de Abril"` |
| B (1) | Fila | string | `"NDD Cargo - Central de atendimentos"` |
| C (2) | Ramal | string | `"Marcos - Central"` |
| D (3) | Total de tentativas | int | `13` |
| E (4) | Tent. Atendidas | int | `11` |
| F (5) | Tent. Perdidas | int | `2` |
| G (6) | Chamadas capturadas | int | `0` |
| H (7) | TMA | string | `"171 s"` |
| I (8) | TME | string | `"8 s"` |
| J (9) | TMA(s) | int | `171` |
| K (10) | TME(s) | int | `8` |
| L (11) | Data Real | Date | `2026-04-14` |

- **Header**: row 3, **Dados**: row 4+
- **~480 registros** (5 agentes × ~100 dias, mais a fila geral)
- **Ramais/Agentes válidos**: `Marcos - Central`, `Gessica Freitas Becker`, `Matheus - Central`, `Isaque - Central`, `Diego - Central`
- Também aparece `"Central de relacionamentos"` como ramal (fila geral, sem atendente) — filtrado pelo app pois não está no AGENT_MAP
- **App lê**: `r[0]`=data, `r[2]`=ramal, `r[3]`=tentativas, `r[4]`=atendidas, `r[5]`=perdidas, `r[7]`=TMA, `r[8]`=TME

### 3.3 Aba `Cola_Ellevo` — Tickets de Suporte

| Coluna (idx) | Nome | Tipo | Exemplo |
|---|---|---|---|
| A (0) | Chamado | int | `641662` |
| B (1) | Data de Fechamento | datetime / "-" | `2026-04-14 10:25` |
| C (2) | Data de abertura | datetime | `2026-04-14 09:46` |
| D (3) | Título | string | `"Aplicativo\xa0travado\xa0-\xa0OLIVEIRA..."` |
| E (4) | Cliente | string | `"PORTAL TAC"` |
| F (5) | Módulo | string | `"Central de relacionamentos"` |
| G (6) | Natureza | string | `"Solicitação"` / `"Problema Ndd"` / `"Informação"` |
| H (7) | Responsável | string | `"Matheus Lucas de Carvalho"` |
| I (8) | Qualificação | string | `"Bug de Versão App"` / `"-"` |
| J (9) | Severidade | string | `"Nível 1"` / `"Nível 2"` / `"Nível 3"` |
| K (10) | Trâmites | string (HTML-like) | histórico de ações |
| L (11) | Descrição | string | detalhes do chamado |

- **Header**: row 3, **Dados**: row 4+
- **~848 tickets** no Dashboard (Jan–14/Abr)
- **Status**: determinado pelo app — se `Data de Fechamento` é vazio ou `"-"` → `"Aberto"`, senão `"Fechado"`
- **Categoria**: extraída do título via `normalize()` usando regex
- **Particularidade**: títulos contêm `\xa0` (non-breaking space) em vez de espaços normais

### 3.4 Abas de Análise (geradas por fórmulas no Excel, NÃO lidas pelo app)

- `📊 Dashboard` — dashboard visual do Excel com KPIs e fórmulas
- `Análise_Telefonia` — ranking de atendentes filtrado
- `Análise_Tickets` — categorias e severidades filtradas
- `Equipe_Unificada` — visão cruzada telefone+tickets
- `❓ Instruções` — guia de uso

---

## 4. FONTES DE DADOS EXTERNAS (para atualização)

### 4.1 Relatório AtPlus (CSV)

Arquivo: `relatorio_fila_atendimento_YYYY-MM-DD_HH-MM-SS_*.csv`

Formato: CSV com separador `;`, encoding UTF-8 com caracteres especiais, duas seções:

**Seção 1 — "Dados das Filas"** (linha 1):
```
Data;Fila;"Total de Chamadas";"Chamadas Atendidas";"Chamadas capturadas";"Chamadas não atendidas";"Chamadas Abandonadas";"Chamadas Abandonadas/Não Atendidas";TMA;TME
"1 de Abril";"NDD Cargo - Central de atendimentos";35;34;0;0;1;2,86%;143s;13s
```
- Tx Abandono vem como `"2,86%"` (string com vírgula decimal)
- TMA/TME vem como `"143s"` (string com sufixo `s`)

**Seção 2 — "Dados dos Ramais"** (após linha em branco):
```
Data;Fila;Ramal;"Total de tentativas";"Tent. Atendidas";"Tent. Perdidas";"Chamadas capturadas";TMA;TME
"1 de Abril";"NDD Cargo - Central de atendimentos";"Marcos - Central";13;10;3;0;117s;6s
```

- **Período do arquivo atual**: 1 a 15 de Abril de 2026 (15 dias)
- Este CSV é a fonte bruta que é colada nas abas `Cola_Atplus_Cons` e `Cola_Atplus_Atend`

### 4.2 Exportação Ellevo (XLSX)

Arquivo: `Exportação.xlsx`

- Uma aba `Exportacao` com headers na row 1
- **Mesma estrutura** da aba `Cola_Ellevo` + coluna extra `Tempos do Chamado` (col M, timedelta)
- **254 tickets** no período de 01/Abr a 15/Abr/2026
- **Sem `\xa0` nos headers** (diferente da Cola_Ellevo que tem dados com `\xa0`)
- Este arquivo é a fonte bruta colada na aba `Cola_Ellevo`

---

## 5. EQUIPE — AGENTES DA CENTRAL

| # | Nome AtPlus (Ramal) | Nome Ellevo (Responsável) |
|---|---------------------|--------------------------|
| 1 | Marcos - Central | Marcos Costa |
| 2 | Gessica Freitas Becker | GESSICA FREITAS BECKER |
| 3 | Matheus - Central | Matheus Lucas de Carvalho |
| 4 | Isaque - Central | Isaque de Oliveira dos Santos |
| 5 | Diego - Central | Diego Dias Fernandes |

Outros responsáveis que aparecem no Ellevo mas **não estão** no AGENT_MAP: `Giovane Melo` (aparece em tickets mais antigos, possivelmente saiu da equipe).

---

## 6. CATEGORIZAÇÃO DE TICKETS (função `normalize`)

O título do ticket é splitado pelo primeiro ` - ` ou `/`, e a parte antes é classificada:

| Regex (case insensitive) | Categoria |
|---|---|
| `TRANSFER\|TRASFER` | Transferência |
| `CONSULTA\|SALDO` | Consulta Saldo |
| `APLICATIVO\|ACESSO\|BLOQUEIO\|LIBERA\|RESET\|SENHA\|USUARIO\|DISPOSITIVO\|CONGELAD\|TRAVAD\|AGUARDE\|INATIVIDADE\|STATUS\|VAZAMENTO\|VERIFICA` | Acesso/App |
| `PIX\|PAGAMENTO` | PIX/TED |
| `CADASTRO\|CONTA\|ABERTURA` | Cadastro |
| `CANCELAMENTO\|CARTÃO\|CARTAO` | Cancelamento |
| `EXTRATO\|RELAT\|INFORME\|RENDIMENTO` | Relatório/Extrato |
| `SUPORTE\|CONTRATANTE` | Suporte |
| `INFORMA\|VALE\|PEDÁGIO\|PEDAGIO` | Informação |
| `COMERCIAL` | Comercial |
| `SOLICITA` | Solicitação |
| `INCIDENTE\|FALHA\|DÉBITO\|DEBITO` | Incidente |
| *(fallback)* | Outros |

---

## 7. MÉTRICAS E KPIs

### 7.1 Telefonia

| KPI | Cálculo | Meta |
|-----|---------|------|
| Total Chamadas | `Σ cons.total` | — |
| Atendidas | `Σ cons.atendidas` | — |
| Tx Atendimento | `atendidas / total` | ≥ 90% (verde ✅ se atingida, vermelho ⚠️ se não) |
| Abandonadas + Não Atend. | `Σ (cons.abandonadas + cons.naoAtendidas)` | — |
| TMA Médio | `média(cons.tma)` em segundos | Alerta se > 300s (5 min) por atendente |
| TME Médio | `média(cons.tme)` em segundos | — |
| NS (Nível de Serviço) | Se `txAtend ≥ 90%` → ✅, senão → ⚠️ | — |

### 7.2 Tickets

| KPI | Cálculo |
|-----|---------|
| Total Tickets | `fTickets.length` |
| Fechados | tickets com `status === "Fechado"` |
| Em Aberto | tickets com `status === "Aberto"` |
| Méd Chamadas/Dia | `total_chamadas / dias_filtrados` |

### 7.3 Alertas da Equipe

- 🔴 Atendente com **> 3 tickets abertos**
- ⏱ Atendente com **TMA > 300 segundos** (5 min)
- ✅ "Equipe dentro dos parâmetros" se nenhum alerta disparar

---

## 8. REGRAS DE NEGÓCIO IMPORTANTES

1. **Datas em português**: AtPlus exporta datas como `"14 de Abril"`, não ISO. O parse assume ano 2026.
2. **\xa0 (non-breaking space)**: Títulos do Ellevo usam `\xa0` em vez de espaço. `splitTitulo()` trata isso.
3. **Status do ticket**: Inferido — sem data de fechamento ou com `"-"` = Aberto.
4. **Cruzamento telefonia × tickets**: Via `AGENT_MAP`. Nomes são diferentes entre sistemas.
5. **Filtro de datas**: Usa `dateReal` (Date object) e filtra por range `[dateFrom, dateTo]` inclusive.
6. **Fila "Central de relacionamentos"**: Aparece como ramal nos dados do AtPlus mas não é um agente real — são chamadas que tocaram na fila sem atendente. Automaticamente excluída porque não está no `AGENT_MAP`.
7. **Tickets derivados de ligações**: O dashboard assume que tickets da Central são gerados a partir de ligações recebidas. Total de tickets ≤ chamadas atendidas.

---

## 9. NATUREZAS DE TICKETS (campo `natureza` do Ellevo)

| Natureza | Descrição |
|----------|-----------|
| Solicitação | Pedido do cliente (transferência, extrato, cadastro) |
| Problema Ndd | Bug ou falha no sistema/app NDD |
| Informação | Consulta informativa |
| Ambiente do cliente | Problema no ambiente do próprio cliente |

---

## 10. QUALIFICAÇÕES COMUNS DE TICKETS

Valores frequentes do campo `qualificacao`:
- `Bug de Versão App`, `Bug de Versão`
- `Lentidão/Instabilidade`
- `Utilização do App nddcargo`
- `Abertura de contas`
- `Alteração Cadastral`
- `Envio de Relatórios/Documentos`
- `Falha na execução do procedimento Contas`
- `-` (sem qualificação)

---

## 11. ESTILO VISUAL DO DASHBOARD

- **Tema**: Dark mode (bg `#0c0e14`)
- **Font**: `'DM Sans', -apple-system, sans-serif`
- **Cards**: `border-radius: 14px`, borda sutil `#1e2233`, hover com borda colorida
- **Layout**: `maxWidth: 1140px`, centrado, responsivo com flexbox wrap
- **Gráficos**: Recharts com tooltip customizado (TT), grid tracejado, labels em `P.dim`
- **Ícones**: Emojis como ícones (📊📞🎫👥🏆📅🔴⚠️✅⏱)
- **Tabs**: Pill buttons com fundo accent quando ativo

---

## 12. LIMITAÇÕES CONHECIDAS E OPORTUNIDADES

### Limitações atuais
- Ano hardcoded como 2026 em `parseDataPt()`
- Não suporta upload de CSV direto (só .xlsx)
- Não persiste dados entre sessões
- `AGENT_MAP` é estático — novo agente precisa alterar o código
- Não há aba/seção para o CSV do AtPlus (fila de atendimento em tempo real)

### O CSV do AtPlus (`relatorio_fila_atendimento_*.csv`) **NÃO é lido pelo app atual**
- Tem dados de Abril/2026 (1–15) que **precisam ser colados no Excel** antes do upload
- Formato diferente do Excel: separador `;`, `%` com vírgula decimal, `TMA` como `"143s"`
- Poderia ser integrado como segunda fonte de upload no app

### Exportação.xlsx **também NÃO é lida diretamente**
- Contém 254 tickets de Abril que precisam ser colados na aba `Cola_Ellevo` do Dashboard
- Tem coluna extra `Tempos do Chamado` (timedelta) não utilizada pelo app
- Poderia ser integrada como fonte alternativa

---

## 13. GLOSSÁRIO

| Termo | Significado |
|-------|-------------|
| **AtPlus** | Sistema de telefonia/PABX da NDD. Gera relatórios de filas e ramais. |
| **Ellevo** | Sistema de help desk/tickets. Gerencia chamados de suporte. |
| **TMA** | Tempo Médio de Atendimento (em segundos) |
| **TME** | Tempo Médio de Espera (em segundos) |
| **NS** | Nível de Serviço (meta ≥ 90% de atendimento) |
| **Tx Atend.** | Taxa de Atendimento = atendidas / total |
| **Tx Ab./NA** | Taxa de Abandono + Não Atendidas |
| **NDD Cargo** | Produto/sistema da empresa — plataforma de gestão de frota/carga |
| **Portal TAC** | Portal do Transportador Autônomo de Carga — cliente principal |
| **Ramal** | Identificador do atendente no sistema AtPlus |
| **Chamado** | ID numérico do ticket no Ellevo |
| **Natureza** | Classificação primária do ticket (Solicitação, Problema, Informação) |
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
