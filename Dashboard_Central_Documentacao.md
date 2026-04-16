# Documentação Técnica — Dashboard_-_Central.xlsx

> **Finalidade deste documento:** servir de contexto completo para uma IA que esteja trabalhando em código (Python, Google Apps Script, VBA, Node, etc.) que leia, escreva ou manipule esta planilha. Descreve todas as abas, todos os campos, todas as fórmulas relevantes e o modelo de dados subjacente.

---

## 1. Visão geral

Este arquivo é um **dashboard operacional de uma Central de Relacionamentos** (atendimento ao cliente) que consolida duas fontes de dados distintas:

1. **Ellevo** — sistema de ticketing/chamados (tickets abertos e fechados, severidade, responsável, qualificação).
2. **Atplus** — sistema de telefonia (URA/call center) que fornece dois tipos de relatórios:
   - **Consolidado diário** (1 linha por dia com totais da fila).
   - **Por atendente** (várias linhas por dia, uma por operador/ramal).

O fluxo operacional esperado é: o usuário cola os dados exportados desses dois sistemas nas abas "Cola_*" e o dashboard recalcula **automaticamente via fórmulas** (não há macros/VBA). Um **filtro de datas** na aba Dashboard (`D3` e `F3`) atua como slicer global, afetando todas as abas de análise.

### 1.1. Stack / tecnologia
- Formato: `.xlsx` (Office Open XML, compatível com Excel, LibreOffice, Google Sheets).
- **Sem macros** (`.xlsx`, não `.xlsm`).
- **Sem tabelas nomeadas** (`Tables`) nem intervalos nomeados (`DefinedNames`).
- Todas as referências são por endereço direto (ex.: `Cola_Ellevo!$A$4:$A$1999`).
- Funções usadas: `SUMIFS`, `COUNTIFS`, `AVERAGEIFS`, `SUMPRODUCT`, `IF`, `IFERROR`, `DATE`, `INT`, `TRIM`, `FIND`, `SEARCH`, `MID`, `LEFT`, `UPPER`, `SUBSTITUTE`, `VALUE`, `TIMEVALUE`, `HOUR`, `MINUTE`, `SECOND`, `MATCH`, `YEAR`, `TODAY`, `CHAR`.

### 1.2. Lista das abas (sheet names)

| # | Nome da aba (literal, com emoji) | Dimensão (linhas × cols) | Papel |
|---|---|---|---|
| 1 | `📊 Dashboard` | 214 × 16 | Apresentação: KPIs + filtro de datas + tabela diária |
| 2 | `Cola_Ellevo` | 1999 × 19 | **Entrada**: dados crus de tickets (Ellevo) |
| 3 | `Cola_Atplus_Cons` | 200 × 13 | **Entrada**: telefonia consolidada diária (Atplus) |
| 4 | `Cola_Atplus_Atend` | 1000 × 12 | **Entrada**: telefonia por atendente (Atplus) |
| 5 | `Análise_Telefonia` | 9 × 7 | Ranking de atendentes por telefonia |
| 6 | `Análise_Tickets` | 40 × 9 | Tickets por categoria, severidade, natureza, responsável, qualificação |
| 7 | `Equipe_Unificada` | 10 × 9 | Telefonia + Tickets por pessoa (cross-referência) |
| 8 | `❓ Instruções` | 25 × 1 | Manual do usuário |

> ⚠️ **Atenção aos emojis nos nomes das abas.** Os nomes começam com emoji (`📊`, `❓`) e devem ser passados **exatos** em qualquer API (openpyxl, pandas `sheet_name=`, Google Sheets API `range`, etc.). Em Excel, referências externas a esses nomes em fórmulas são envolvidas em aspas simples: `'📊 Dashboard'!A1`.

---

## 2. Modelo de dados e relacionamentos

```
┌─────────────────────┐        ┌─────────────────────┐        ┌───────────────────────┐
│  Cola_Ellevo        │        │  Cola_Atplus_Cons   │        │  Cola_Atplus_Atend    │
│  (tickets crus)     │        │  (telefonia/dia)    │        │  (telefonia/operador) │
│  - col A: Chamado   │        │  - col A: Data (pt) │        │  - col A: Data (pt)   │
│  - col R: Data(int) │        │  - col M: Data Real │        │  - col L: Data Real   │
│  - col S: Status    │        │  - cols C..L: KPIs  │        │  - col C: Ramal       │
└──────────┬──────────┘        └──────────┬──────────┘        └──────────┬────────────┘
           │                              │                              │
           │        filtro D3/F3          │        filtro D3/F3          │  filtro D3/F3
           │  do '📊 Dashboard'!          │                              │
           ▼                              ▼                              ▼
    ┌────────────────────────────────────────────────────────────────────────────┐
    │                       '📊 Dashboard' (KPIs agregados)                       │
    │                  + Análise_Telefonia / Análise_Tickets                     │
    │                          + Equipe_Unificada                                │
    └────────────────────────────────────────────────────────────────────────────┘
```

**Chave de data (importante):** o filtro compara datas da seguinte forma:
- Em `Cola_Ellevo`, a coluna **`R` (Data)** contém `=IF(C=\"\",\"\",INT(C))` — trunca o timestamp de abertura para a data-apenas.
- Em `Cola_Atplus_Cons`, a coluna **`M` (Data Real)** converte a string pt-BR (`"15 de Março"`) em `DATE` usando o ano de `TODAY()`.
- Em `Cola_Atplus_Atend`, a coluna **`L` (Data Real)** faz o mesmo que acima.

**Chave de pessoa (importante):** o nome de um mesmo atendente difere entre sistemas. A aba `Equipe_Unificada` mantém duas colunas (`A` = nome Atplus, `B` = nome Ellevo) para fazer o de-para manualmente. Exemplo:
- Atplus: `"Gessica Freitas Becker"` ↔ Ellevo: `"GESSICA FREITAS BECKER"`
- Atplus: `"Marcos - Central"` ↔ Ellevo: `"Marcos Costa"`

---

## 3. Aba 1 — `📊 Dashboard` (apresentação)

**Dimensões:** 214 linhas × 16 colunas. Layout organizado em **blocos visuais**, com linhas em branco como separadores. É a aba "cara do produto".

### 3.1. Cabeçalho (linha 1)

- `A1`: título literal `'CENTRAL DE RELACIONAMENTOS — DASHBOARD OPERACIONAL'`.

### 3.2. Bloco de FILTRO (linha 3) — **ponto crítico**

| Célula | Conteúdo | Papel |
|---|---|---|
| `A3` | `📅 FILTRO:` | rótulo |
| `C3` | `De:` | rótulo |
| **`D3`** | **data inicial** (ex.: `2026-03-15`) | **entrada do usuário** — filtro global |
| `E3` | `Até:` | rótulo |
| **`F3`** | **data final** (ex.: `2026-04-15`) | **entrada do usuário** — filtro global |
| `G3` | texto de instrução | rótulo |

> **Toda a planilha depende de `D3` e `F3`.** Se qualquer célula estiver vazia, o padrão é substituído por `DATE(2000,1,1)` (D3) e `DATE(2100,1,1)` (F3) via `IF($D$3="",DATE(2000,1,1),$D$3)`. Esse padrão de defaulting aparece em **centenas de fórmulas** ao longo do arquivo.

### 3.3. Bloco 📞 TELEFONIA (linhas 5-8)

Título em `A5`. Cabeçalhos em linha 7, valores em linha 8. Colunas em passos de 2 (A, C, E, G, I, K).

| Célula | Rótulo (linha 7) | Fórmula (linha 8) |
|---|---|---|
| `A8` | TOTAL CHAMADAS | `=SUMIFS(Cola_Atplus_Cons!$C$4:$C$200, Cola_Atplus_Cons!$M$4:$M$200, ">="&…D3…, Cola_Atplus_Cons!$M$4:$M$200, "<="&…F3…)` |
| `C8` | ATENDIDAS | igual, somando coluna `D` |
| `E8` | TX ATENDIMENTO | `atendidas / total` com `IFERROR` |
| `G8` | ABANDONADAS + NÃO ATEND. | soma de `F` (não atendidas) + `G` (abandonadas) |
| `I8` | TMA MÉDIO (s) | `AVERAGEIFS` sobre coluna `K` (TMA em segundos) |
| `K8` | TME MÉDIO (s) | `AVERAGEIFS` sobre coluna `L` (TME em segundos) |

### 3.4. Bloco 🎫 TICKETS (linhas 10-13)

Título em `A10`. Cabeçalhos em linha 12, valores em linha 13.

| Célula | Rótulo | Lógica |
|---|---|---|
| `A13` | TOTAL TICKETS | `COUNTIFS` em `Cola_Ellevo!A`, filtrado por `R` (data) no intervalo D3..F3 |
| `C13` | FECHADOS | idem + `S="Fechado"` |
| `E13` | EM ABERTO | idem + `S="Aberto"` |
| `G13` | SOLICITAÇÕES | idem + `G="Solicitação"` |
| `I13` | INFORMAÇÕES | idem + `G="Informação"` |
| `K13` | PROBLEMAS NDD | idem + `G="Problema*"` (wildcard) |

### 3.5. Bloco 📋 SEVERIDADE E MÉDIAS (linhas 15-18)

| Célula | Rótulo | Fórmula |
|---|---|---|
| `A18` | NÍVEL 1 | `COUNTIFS` em `Cola_Ellevo` + `J="Nível 1"` |
| `C18` | NÍVEL 2 | `Cola_Ellevo` + `J="Nível 2"` |
| `E18` | NÍVEL 3 | `Cola_Ellevo` + `J="Nível 3"` |
| `G18` | DIAS | `COUNTIFS` em `Cola_Atplus_Cons!M` (quantos dias caem no filtro) |
| `I18` | MÉD CHAMADAS/DIA | total de chamadas (`C`) ÷ dias |
| `K18` | MÉD TICKETS/DIA | total de tickets ÷ dias |

### 3.6. Bloco 📅 DETALHAMENTO DIÁRIO (linhas 20-214) — tabela gigante

- `A20`: título.
- **Linha 21** = cabeçalhos: `Dia | Total | Atendidas | Capturadas | Não Atend. | Abandon. | Tx Ab./NA | TMA(s) | TME(s) | Tx Atend. | NS`.
- **Linhas 22 até 214** (193 linhas): cada linha **replica** uma linha de `Cola_Atplus_Cons` (offset: `Dashboard!22` ↔ `Cola_Atplus_Cons!4`, `Dashboard!23` ↔ `Cola_Atplus_Cons!5`, etc.) **somente se a data cair no filtro**.

Padrão da fórmula (exemplo da linha 22 referenciando a linha 4 de Cola_Atplus_Cons):

```excel
A22: =IF(AND(Cola_Atplus_Cons!M4>=IF($D$3="",DATE(2000,1,1),$D$3),
             Cola_Atplus_Cons!M4<=IF($F$3="",DATE(2100,1,1),$F$3),
             Cola_Atplus_Cons!A4<>""),
          Cola_Atplus_Cons!A4,"")     ← Dia (string "X de Mês")
B22: …→Cola_Atplus_Cons!C4            ← Total chamadas
C22: …→Cola_Atplus_Cons!D4            ← Atendidas
D22: …→Cola_Atplus_Cons!E4            ← Capturadas
E22: …→Cola_Atplus_Cons!F4            ← Não atend.
F22: …→Cola_Atplus_Cons!G4            ← Abandon.
G22: …→Cola_Atplus_Cons!H4            ← Tx Ab./NA
H22: …→Cola_Atplus_Cons!K4            ← TMA(s)
I22: …→Cola_Atplus_Cons!L4            ← TME(s)
J22: =IFERROR(C22/B22,"")             ← Tx Atend. (calculada localmente)
K22: =IF(J22="","",IF(J22>=0.9,"✅ OK","⚠️ ATENÇÃO"))   ← status NS (Nível de Serviço): ≥90% = OK
```

> **Observação técnica importante:** nas linhas 22-51 (30 primeiras) o padrão `IF(AND(…>=$D$3, …<=$F$3, Cola_Atplus_Cons!A<>""))` é diferente das linhas 52+ que usam `IF(AND(Cola_Atplus_Cons!A<>"", IF($D$3="",TRUE(), …>=$D$3), IF($F$3="",TRUE(), …<=$F$3)))` — resultado equivalente, mas **sintaxes diferentes**. Um script que regenere as fórmulas deve usar apenas uma das duas formas, consistentemente.

> **Limite:** o Dashboard só espelha até a linha 214 (= 193 dias a partir de `Cola_Atplus_Cons!A4`). Se a fonte tiver mais de 193 dias preenchidos, **os excedentes não aparecem no Dashboard** (embora apareçam nos KPIs agregados). Para estender, é preciso adicionar linhas ao Dashboard.

- **Regra de NS (Nível de Serviço):** `≥ 90% atendimento → "✅ OK"`, caso contrário `"⚠️ ATENÇÃO"`.

---

## 4. Aba 2 — `Cola_Ellevo` (entrada: tickets)

**Dimensões:** 1999 × 19 (cabe até ~1996 tickets). **É onde o usuário cola** o export do Ellevo.

### 4.1. Instruções embutidas
- `A1`: `'🎫 COLE AQUI OS DADOS DO ELLEVO'`
- `A2`: `'Exporte → abra → Ctrl+A → Ctrl+C → clique A4 → Ctrl+V. Colunas verdes = automáticas.'`

### 4.2. Schema (linha 3 = cabeçalhos; dados a partir da linha 4)

| Coluna | Cabeçalho | Origem | Tipo | Descrição |
|---|---|---|---|---|
| A | `Chamado` | **colado** | int/string | ID único do chamado (ex.: `"639091"`) |
| B | `Data de Fechamento` | **colado** | datetime ou `"-"` | data/hora do fechamento; `"-"` ou vazio = em aberto |
| C | `Data de abertura` | **colado** | datetime | data/hora de abertura |
| D | `Título` | **colado** | string | Título do chamado (pode conter `CHAR(160)` = NBSP entre partes) |
| E | `Cliente - Cliente - Nome Fantasia` | **colado** | string | nome do cliente/empresa |
| F | `Módulo` | **colado** | string | ex.: `"Central de relacionamentos"` |
| G | `Natureza` | **colado** | string | `Solicitação`, `Informação`, `Problema Ndd`, `Ambiente do cliente`, etc. |
| H | `Responsável` | **colado** | string | nome do atendente (Ellevo) |
| I | `Qualificação do Chamado` | **colado** | string | ex.: `"Utilização do App nddcargo"`, `"Lentidão/Instabilidade"`, `"-"` |
| J | `Severidade` | **colado** | string | `"Nível 1"`, `"Nível 2"`, `"Nível 3"` |
| K | `Trâmites` | **colado** | texto longo | histórico |
| L | `Descrição` | **colado** | texto longo | descrição |
| M | `Tempos do Chamado` | **colado** | número Excel (fração de dia) ou `"HH:MM:SS"` | tempo trabalhado |
| N | `Categoria` | **calculada** | string | primeira parte do Título, antes do separador |
| O | `Cliente Extraído` | **calculada** | string | segunda parte do Título, depois do separador |
| P | `Cat. Normalizada` | **calculada** | string | bucket de categoria (`"Transferência"`, `"Acesso/App"`, etc.) |
| Q | `Tempo(min)` | **calculada** | número | M convertido para minutos |
| R | `Data` | **calculada** | date | `INT(C)` — data-apenas da abertura (chave do filtro) |
| S | `Status` | **calculada** | string | `"Aberto"` se B vazio/"-", senão `"Fechado"` |

### 4.3. Fórmulas das colunas derivadas (linha 4, arrastam até 1999)

**N4 — Categoria (parte antes do separador do Título):**
```excel
=IF(D4="","",TRIM(
   IF(NOT(ISERROR(FIND(CHAR(160)&"-"&CHAR(160),D4))),
      LEFT(D4,FIND(CHAR(160)&"-"&CHAR(160),D4)-1),
   IF(NOT(ISERROR(FIND(" - ",D4))),
      LEFT(D4,FIND(" - ",D4)-1),
   IF(NOT(ISERROR(FIND("/",D4))),
      LEFT(D4,FIND("/",D4)-1),
      D4)))))
```
Ou seja: tenta separar por `NBSP-NBSP` (CHAR(160) + "-" + CHAR(160)), depois por `" - "` (espaços normais), depois por `"/"`.

**O4 — Cliente Extraído (parte depois do separador):** mesma lógica, mas `MID(…, pos+3, 999)`.

**P4 — Cat. Normalizada:** cadeia enorme de `IF(ISNUMBER(SEARCH(…, UPPER(N4))), "categoria", IF(…))` que mapeia palavras-chave para um conjunto fixo de buckets:

| Bucket (saída) | Palavras-chave buscadas em `UPPER(N4)` |
|---|---|
| `Transferência` | `TRANSFER`, `TRASFER` (typo) |
| `Consulta Saldo` | `CONSULTA`, `SALDO` |
| `Acesso/App` | `APLICATIVO`, `ACESSO`, `BLOQUEIO`, `LIBERA`, `RESET`, `SENHA`, `USUARIO`, `DISPOSITIVO`, `CONGELAD`, `TRAVAD`, `AGUARDE`, `INATIVIDADE`, `STATUS`, `VAZAMENTO`, `VERIFICAÇÃO`, `VERIFICACAO` |
| `PIX/TED` | `PIX`, `PAGAMENTO` |
| `Cadastro` | `CADASTRO`, `CONTA`, `ABERTURA` |
| `Cancelamento` | `CANCELAMENTO`, `CARTÃO`, `CARTAO` |
| `Relatório/Extrato` | `EXTRATO`, `RELAT`, `INFORME`, `RENDIMENTO` |
| `Suporte` | `SUPORTE`, `CONTRATANTE` |
| `Informação` | `INFORMA`, `VALE`, `PEDÁGIO`, `PEDAGIO` |
| `Comercial` | `COMERCIAL` |
| `Solicitação` | `SOLICITA` |
| `Incidente` | `INCIDENTE`, `FALHA`, `DÉBITO`, `DEBITO` |
| `Outros` | fallback |

> **Ordem importa**: por ser uma cadeia `IF…IF…IF`, a primeira palavra-chave que casar vence. Exemplo: um título contendo "Cancelamento de cartão" bate em `CANCELAMENTO` (bucket `Cancelamento`), não em `CARTAO` que viria depois.

**Q4 — Tempo(min):**
```excel
=IF(M4="","",
   IF(ISNUMBER(M4), M4*1440,                  ← fração de dia × 1440 min
      IFERROR(HOUR(TIMEVALUE(M4))*60
              + MINUTE(TIMEVALUE(M4))
              + SECOND(TIMEVALUE(M4))/60, 0)))
```

**R4 — Data:** `=IF(C4="","",INT(C4))`.

**S4 — Status:** `=IF(A4="","", IF(OR(B4="-",B4=""), "Aberto", "Fechado"))`.

### 4.4. Observações para quem vai processar programaticamente

- **`CHAR(160)` (NBSP) aparece com frequência** no campo Título (separadores). Ao ler via Python/pandas, não confundir com espaço normal.
- Números da coluna M podem vir como **string** (`"00:05:00"`) ou **número** (`0.00347222…` = 5 min em fração de dia). A fórmula Q trata ambos os casos.
- A coluna B pode conter literalmente a string `"-"` para tickets em aberto.
- A lista de qualificações (coluna I) usadas em relatórios inclui: `Utilização do App nddcargo`, `Abertura de contas`, `Envio de Relatórios/Documentos`, `Alteração Cadastral`, `Análise de incidente pontual`, `Lentidão/Instabilidade`, `Bug de Versão App`, `Bug de Versão`, `Falha na execução do procedimento Contas`, `Falha Compra Débito`, e `"-"` (sem qualificação).

---

## 5. Aba 3 — `Cola_Atplus_Cons` (entrada: telefonia consolidada)

**Dimensões:** 200 × 13 (cabe até ~197 dias). Uma linha por dia da fila.

### 5.1. Instruções embutidas
- `A1`: `'📞 COLE A LINHA CONSOLIDADA DO ATPLUS (1 por dia)'`
- `A2`: `'Cole só a linha consolidada. Acumule dias abaixo.'`

### 5.2. Schema (linha 3 = cabeçalhos, dados a partir da linha 4)

| Coluna | Cabeçalho | Origem | Tipo | Descrição |
|---|---|---|---|---|
| A | `Data` | **colado** | string pt-BR | ex.: `"15 de Março"` (sem ano!) |
| B | `Fila` | **colado** | string | nome da fila, ex.: `"NDD Cargo - Central de atendimentos"` |
| C | `Total de Chamadas` | **colado** | int | |
| D | `Chamadas Atendidas` | **colado** | int | |
| E | `Chamadas capturadas` | **colado** | int | capturadas por outro atendente |
| F | `Chamadas não atendidas` | **colado** | int | |
| G | `Chamadas Abandonadas` | **colado** | int | |
| H | `Chamadas Abandonadas/Não Atendidas` | **colado** | decimal | taxa (ex.: `0.1111`) |
| I | `TMA` | **colado** | string | ex.: `"178 s"` |
| J | `TME` | **colado** | string | ex.: `"17 s"` |
| K | `TMA(s)` | **calculada** | número | I convertido para segundos (remove `" s"`) |
| L | `TME(s)` | **calculada** | número | J convertido para segundos |
| M | `Data Real` | **calculada** | date | A (string pt-BR) convertida para DATE |

### 5.3. Fórmulas derivadas (linha 4)

**K4 — TMA(s):**
```excel
=IF(I4="","", IFERROR(VALUE(SUBSTITUTE(SUBSTITUTE(I4," s",""), CHAR(160), " ")), I4))
```
Remove o sufixo `" s"` e eventuais NBSPs e converte para número.

**L4 — TME(s):** idêntica, referenciando J.

**M4 — Data Real** (conversão pt-BR → date):
```excel
=IF(A4="","",
   IFERROR(
     DATE(
       YEAR(TODAY()),                                                ← ASSUME ano corrente!
       MATCH(TRIM(MID(SUBSTITUTE(A4," de "," ")&" ",
              FIND(" ",SUBSTITUTE(A4," de "," ")&" ")+1, 99)),
             {"Janeiro","Fevereiro","Março","Abril","Maio","Junho",
              "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"}, 0),
       VALUE(LEFT(A4, FIND(" ",A4)-1))
     ), ""))
```

> ⚠️ **Bug conhecido / limitação**: a função usa `YEAR(TODAY())` para obter o ano. Isso significa que ao virar o ano, **todos os dados antigos "mudam" de ano**. Um script que leia esta planilha deve considerar o ano do **timestamp do arquivo** ou pedir ao usuário, e não confiar cegamente na coluna M se a data da abertura do arquivo for posterior ao dado.

---

## 6. Aba 4 — `Cola_Atplus_Atend` (entrada: telefonia por atendente)

**Dimensões:** 1000 × 12 (cabe até ~997 linhas). Uma linha por (dia × atendente).

### 6.1. Instruções embutidas
- `A1`: `'👤 COLE AS LINHAS DOS ATENDENTES DO ATPLUS'`
- `A2`: `'Copie as linhas dos atendentes. Acumule dias abaixo.'`

### 6.2. Schema (linha 3 = cabeçalhos, dados a partir da linha 4)

| Coluna | Cabeçalho | Origem | Tipo |
|---|---|---|---|
| A | `Data` | **colado** | string pt-BR (ex.: `"2 de Janeiro"`) |
| B | `Fila` | **colado** | string |
| C | `Ramal` | **colado** | string | **chave do atendente** (ex.: `"Matheus - Central"`, `"Gessica Freitas Becker"`, `"Central de relacionamentos"`) |
| D | `Total de tentativas` | **colado** | int |
| E | `Tent. Atendidas` | **colado** | int |
| F | `Tent. Perdidas` | **colado** | int |
| G | `Chamadas capturadas` | **colado** | int |
| H | `TMA` | **colado** | string (ex.: `"103 s"`) |
| I | `TME` | **colado** | string |
| J | `TMA(s)` | **calculada** | número (H sem `" s"`) |
| K | `TME(s)` | **calculada** | número (I sem `" s"`) |
| L | `Data Real` | **calculada** | date (igual ao M de Cons) |

Fórmulas de J, K, L são **idênticas** às K, L, M de `Cola_Atplus_Cons` (só mudam as referências de coluna: H→J, I→K, A→L).

---

## 7. Aba 5 — `Análise_Telefonia`

**Dimensões:** 9 × 7. Ranking dos atendentes, filtrado pelo período `D3..F3` do Dashboard.

### 7.1. Layout

- `A1`: título.
- **Linha 3** = cabeçalhos: `Atendente | Tentativas | Atendidas | Tx Atend. | TMA Médio(s) | TME Médio(s) | Alerta`.
- **Linhas 4-8**: 5 atendentes fixos (nomes hard-coded em coluna A): Marcos - Central, Gessica Freitas Becker, Matheus - Central, Isaque - Central, Diego - Central.
- **Linha 9**: totais.

### 7.2. Fórmulas (linha 4, replicadas até 8)

```excel
B4: =SUMIFS(Cola_Atplus_Atend!$D$4:$D$1000,              ← Tentativas (col D)
           Cola_Atplus_Atend!$C$4:$C$1000, A4,            ← filtra pelo nome
           Cola_Atplus_Atend!$L$4:$L$1000, ">="&…D3…,    ← data >= D3
           Cola_Atplus_Atend!$L$4:$L$1000, "<="&…F3…)    ← data <= F3

C4: SUMIFS igual, mas somando coluna E (Atendidas)
D4: =IFERROR(C4/B4,0)                                    ← Tx Atend.
E4: AVERAGEIFS sobre coluna J (TMA(s)), mesmos filtros
F4: AVERAGEIFS sobre coluna K (TME(s)), mesmos filtros
G4: =IF(E4>300, "⏱ TMA Alto", "✅ OK")                   ← regra: TMA > 300s = alerta
```

**Linha 9 (TOTAL):** `SUM(B4:B8)`, `SUM(C4:C8)`, `AVERAGE(E4:E8)`, `AVERAGE(F4:F8)`.

> Para adicionar um novo atendente, basta copiar uma linha e trocar o nome em A. As fórmulas se ajustam via `A$i` sendo usado como chave.

---

## 8. Aba 6 — `Análise_Tickets`

**Dimensões:** 40 × 9. Estrutura em **múltiplas tabelas lado-a-lado** (cols A-C e cols E-G) + seções abaixo.

### 8.1. Seção 1 — POR CATEGORIA (A4:C18) + POR SEVERIDADE (E4:G7)

**A4:C17** — `Categoria | Qtd | % Total`. Categorias (13 linhas, A5..A17): `Transferência`, `Consulta Saldo`, `Acesso/App`, `PIX/TED`, `Cadastro`, `Cancelamento`, `Relatório/Extrato`, `Informação`, `Solicitação`, `Suporte`, `Comercial`, `Incidente`, `Outros`. São **exatamente as 13 saídas** da fórmula P de `Cola_Ellevo`.

Fórmula típica (B5):
```excel
=COUNTIFS(Cola_Ellevo!$A$4:$A$1999, "<>",
         Cola_Ellevo!$R$4:$R$1999, ">="&…D3…,
         Cola_Ellevo!$R$4:$R$1999, "<="&…F3…,
         Cola_Ellevo!$P$4:$P$1999, A5)      ← compara com a célula A5 (= nome da categoria)
C5: =IFERROR(B5/SUM(B5:B17), 0)
```
`A18`: `TOTAL`, `B18: =SUM(B5:B17)`.

**E4:G7** — `Severidade | Qtd | % Total`. E5..E7 = `Nível 1`, `Nível 2`, `Nível 3`. Mesma fórmula, mas filtra em `Cola_Ellevo!$J$4:$J$1999`.

### 8.2. Seção 2 — POR NATUREZA (E10:G14)

Cabeçalho em E10. Linhas E11..E14 = `Solicitação`, `Informação`, `Problema Ndd`, `Ambiente do cliente`. Fórmula usa **wildcard**:
```excel
F11: =COUNTIFS(…, Cola_Ellevo!$G$4:$G$1999, E11&"*")   ← "Solicitação*" casa com variantes
G11: =IFERROR(F11/SUM(F11:F14), 0)
```

### 8.3. Seção 3 — POR RESPONSÁVEL (A20:E25)

Cabeçalhos em linha 20: `Responsável | Total | Fechados | Abertos | Alerta`.
Linhas A21..A25: `GESSICA FREITAS BECKER`, `Marcos Costa`, `Matheus Lucas de Carvalho`, `Isaque de Oliveira dos Santos`, `Diego Dias Fernandes` (note a inconsistência de maiúsculas/minúsculas, que **precisa bater exatamente** com o texto em `Cola_Ellevo!H`).

Fórmulas usam `SUMPRODUCT` (ao invés de `COUNTIFS`) porque precisam aplicar filtros de data **condicionalmente**:

```excel
B21: =SUMPRODUCT(
       (Cola_Ellevo!$A$4:$A$1999<>"")
     * (Cola_Ellevo!$R$4:$R$1999<>"")
     * IF('📊 Dashboard'!$D$3="", 1, (Cola_Ellevo!$R$4:$R$1999 >= '📊 Dashboard'!$D$3))
     * IF('📊 Dashboard'!$F$3="", 1, (Cola_Ellevo!$R$4:$R$1999 <= '📊 Dashboard'!$F$3))
     * (Cola_Ellevo!$H$4:$H$1999 = "GESSICA FREITAS BECKER"))    ← Total

C21: …  * (Cola_Ellevo!$S$4:$S$1999="Fechado")                   ← Fechados
D21: =B21-C21                                                     ← Abertos
E21: =IF(D21>3, "🔴 Acumulando", IF(D21>0, "Pendente", "✅ OK"))   ← regra: >3 abertos = alerta
```

### 8.4. Seção 4 — POR QUALIFICAÇÃO (A28:C40)

- `A28`: título `'Tickets por Qualificação dos Chamados'`.
- Cabeçalhos em linha 29: `Qualificação | Qtd | %`.
- A30..A39: qualificações fixas (ver lista em seção 4.4, item "lista de qualificações").
- A40: `(sem qualificação / '-')` — calculado como `total_geral - SUM(B30:B39)` para capturar o resto.

Fórmulas filtram em `Cola_Ellevo!$I$4:$I$1999` (coluna de qualificação).

---

## 9. Aba 7 — `Equipe_Unificada`

**Dimensões:** 10 × 9. Cruza telefonia (Atplus) e tickets (Ellevo) por pessoa.

### 9.1. Layout

Cabeçalho em linha 4: `Nome (Atplus) | Nome (Ellevo) | Cham. Atend. | Tickets | Tkt Abertos | Total Atend. | TMA Médio(s) | TME Médio(s) | Alerta`.

**Linhas 5-9** (5 atendentes) com de-para manual nas colunas A e B:

| A (Atplus) | B (Ellevo) |
|---|---|
| `Marcos - Central` | `Marcos Costa` |
| `Gessica Freitas Becker` | `GESSICA FREITAS BECKER` |
| `Matheus - Central` | `Matheus Lucas de Carvalho` |
| `Isaque - Central` | `Isaque de Oliveira dos Santos` |
| `Diego - Central` | `Diego Dias Fernandes` |

**Linha 10:** totais.

### 9.2. Fórmulas (linha 5)

```excel
C5: =SUMIFS(Cola_Atplus_Atend!$E$4:$E$1000, ...C=A5..., ...L em D3..F3...)   ← Atend. por telefonia
D5: =COUNTIFS(Cola_Ellevo!..., H=B5, ...R em D3..F3...)                      ← Tickets totais
E5: =COUNTIFS(..., H=B5, S="Aberto", ...R em D3..F3...)                      ← Tickets abertos
F5: =C5+D5                                                                    ← Total de atendimentos
G5: =IFERROR(AVERAGEIFS(Cola_Atplus_Atend!J..., C=A5, L em D3..F3), 0)       ← TMA médio
H5: =IFERROR(AVERAGEIFS(Cola_Atplus_Atend!K..., C=A5, L em D3..F3), 0)       ← TME médio
I5: =IF(E5>3,"🔴 Tkts Acum.","") & IF(G5>300," ⏱ TMA Alto","") &
     IF(AND(E5<=3, G5<=300), "✅ OK", "")                                     ← alerta composto
```

**Regra de alerta:** `tkts_abertos > 3` → `"🔴 Tkts Acum."`; `TMA > 300s` → `"⏱ TMA Alto"`; ambos abaixo → `"✅ OK"`.

---

## 10. Aba 8 — `❓ Instruções`

Texto puro para o usuário final. Pontos-chave:

1. **Fluxo diário:**
   1. Ellevo: exportar .xlsx → Ctrl+A → Ctrl+C → colar em `Cola_Ellevo!A4`.
   2. Atplus consolidado: copiar só a linha consolidada → colar em `Cola_Atplus_Cons!A4`.
   3. Atplus atendentes: copiar as 5 linhas dos atendentes → colar em `Cola_Atplus_Atend!A4`.
   4. As abas de análise recalculam sozinhas.
2. **Filtro de datas:** preencher `D3` e `F3` no Dashboard (formato `DD/MM/AAAA`). Vazio = todos.
3. **Escalabilidade** (conforme documentado na planilha):
   - Ellevo: até 2.000 linhas.
   - Atplus Cons: até 200 dias.
   - Atplus Atend: até 1.000 linhas.
   - Se precisar de mais, estender as fórmulas das colunas verdes.
4. **Novo atendente:** adicionar nas abas `Análise_Telefonia` e `Equipe_Unificada`.

---

## 11. Referência rápida para código

### 11.1. Constantes importantes (para hard-code em scripts)

```python
SHEET_NAMES = {
    "dashboard":      "📊 Dashboard",
    "ellevo":         "Cola_Ellevo",
    "atplus_cons":    "Cola_Atplus_Cons",
    "atplus_atend":   "Cola_Atplus_Atend",
    "analise_tel":    "Análise_Telefonia",
    "analise_tickets":"Análise_Tickets",
    "equipe":         "Equipe_Unificada",
    "instrucoes":     "❓ Instruções",
}

# Filtro global — as duas células que controlam tudo:
FILTER_START_CELL = ("📊 Dashboard", "D3")   # data inicial
FILTER_END_CELL   = ("📊 Dashboard", "F3")   # data final

# Linhas de início dos dados (cabeçalhos na linha 3, dados a partir da 4):
DATA_FIRST_ROW = 4

# Limites atuais das ranges nas fórmulas:
RANGE_LIMITS = {
    "Cola_Ellevo":       1999,  # A4:A1999
    "Cola_Atplus_Cons":  200,   # A4:A200
    "Cola_Atplus_Atend": 1000,  # A4:A1000
}

# Meses pt-BR para converter "15 de Março" → date:
PT_MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
             "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

# Buckets de categoria (saída da coluna P de Cola_Ellevo):
CATEGORIES = ["Transferência","Consulta Saldo","Acesso/App","PIX/TED",
              "Cadastro","Cancelamento","Relatório/Extrato","Informação",
              "Solicitação","Suporte","Comercial","Incidente","Outros"]

SEVERITIES = ["Nível 1", "Nível 2", "Nível 3"]

NATURES    = ["Solicitação", "Informação", "Problema Ndd", "Ambiente do cliente"]

# De-para Atplus ↔ Ellevo (coluna C de Atend vs coluna H de Ellevo):
NAME_MAPPING = {
    "Marcos - Central":        "Marcos Costa",
    "Gessica Freitas Becker":  "GESSICA FREITAS BECKER",
    "Matheus - Central":       "Matheus Lucas de Carvalho",
    "Isaque - Central":        "Isaque de Oliveira dos Santos",
    "Diego - Central":         "Diego Dias Fernandes",
}

# Thresholds de alerta:
SLA_ATENDIMENTO   = 0.90   # Tx Atend. >= 90% → OK; senão ATENÇÃO
TMA_MAX_SEGUNDOS  = 300    # > 300s → "TMA Alto"
TKTS_ABERTOS_MAX  = 3      # > 3 → "Acumulando"
```

### 11.2. Pegadinhas conhecidas

- **Emojis em nomes de aba**: passar exato (`"📊 Dashboard"`, `"❓ Instruções"`).
- **`CHAR(160)` (NBSP)** aparece nos títulos de tickets. Não é espaço comum.
- **Datas em string pt-BR** (`"15 de Março"`): não têm ano; a planilha assume `YEAR(TODAY())` — ver seção 5.3.
- **Colunas derivadas (verdes na UI)**: N, O, P, Q, R, S de `Cola_Ellevo`; K, L, M de `Cola_Atplus_Cons`; J, K, L de `Cola_Atplus_Atend`. **Não escrever nelas** — são fórmulas.
- **Valores colados devem começar em `A4`** de cada aba "Cola_*" (linhas 1-3 são título/instrução/cabeçalho).
- **Limite do Dashboard diário (linhas 22-214)**: mostra no máximo 193 dias de `Cola_Atplus_Cons`. Para além disso, os KPIs agregados continuam corretos, mas a tabela visual trunca.
- **Dois padrões de fórmula** no Dashboard diário (linhas 22-51 vs 52-214) — ver observação no §3.6. Se um script regenerar fórmulas, usar um padrão só.
- **TMA/TME colados vêm como string** `"178 s"`. A fórmula K/L extrai o número removendo `" s"`; ao escrever programaticamente, ou siga o mesmo formato, ou escreva direto em K/L como número (mas aí perde a fórmula).
- **Status `"Aberto"` vs `"Fechado"`** em `Cola_Ellevo!S` é derivado, não colado. Usuário não precisa preencher.
- **A coluna `B` (data de fechamento) em `Cola_Ellevo` pode ter o literal `"-"`** para tickets não fechados, e o campo `S` trata isso.
- **Sensibilidade a maiúsculas nos nomes de responsável** (ex.: `"GESSICA FREITAS BECKER"` vs `"Gessica Freitas Becker"`). Se o Ellevo mudar a capitalização, as fórmulas de `Análise_Tickets` A21..A25 e `Equipe_Unificada` B5..B9 **quebram silenciosamente** (retornam zero).

### 11.3. Recomendações de escrita segura

Se um script for **escrever dados** (popular as abas "Cola_*"):

1. Escrever a partir da **linha 4** em diante.
2. Preservar as colunas calculadas (para `Cola_Ellevo`: N, O, P, Q, R, S; para `Cola_Atplus_Cons`: K, L, M; para `Cola_Atplus_Atend`: J, K, L). Ou re-escrever a fórmula da linha anterior nas novas linhas.
3. Ao usar openpyxl: `load_workbook(…, data_only=False)` para preservar fórmulas; `data_only=True` só se quiser ler **os valores calculados em cache** pelo Excel (que **não existem** se o arquivo nunca foi aberto no Excel; LibreOffice/openpyxl não recalcula).
4. Para **ler valores calculados** de forma confiável em Python sem abrir no Excel, é preciso usar uma engine de fórmulas (`pycel`, `formulas`, `koala`) ou recalcular manualmente as agregações. Como alternativa prática: ler as abas "Cola_*" cruas e replicar os agregados em pandas.

---

## 12. Resumo das fórmulas de agregação (KPIs)

Todas as fórmulas de KPI seguem o mesmo **padrão canônico**:

```excel
=AGREGADOR(
    <coluna_de_valor_em_Cola_*>,
    <coluna_chave_em_Cola_*>, <valor_procurado>,       ← condições opcionais
    <coluna_de_data_em_Cola_*>, ">="&IF($D$3="", DATE(2000,1,1), $D$3),
    <coluna_de_data_em_Cola_*>, "<="&IF($F$3="", DATE(2100,1,1), $F$3))
```

Onde:
- Para dados de tickets, a coluna-chave de data é `R` em `Cola_Ellevo`.
- Para dados de telefonia consolidada, é `M` em `Cola_Atplus_Cons`.
- Para dados de telefonia por atendente, é `L` em `Cola_Atplus_Atend`.
- `AGREGADOR` é `SUMIFS`, `COUNTIFS` ou `AVERAGEIFS` conforme o caso.
- Nas referências cross-sheet ao Dashboard, o nome da aba é citado entre aspas simples: `'📊 Dashboard'!$D$3`.

**Único padrão diferente:** as fórmulas de "Tickets por responsável" em `Análise_Tickets!A20:E25` usam `SUMPRODUCT` + `IF($D$3="", 1, …)`. Funcionalmente equivalente, sintaticamente diferente.

---

**Fim da documentação.**
