# Atividade/Hora com Tickets — Design

Data: 2026-05-18
Status: aprovado para implementação

## 1. Objetivo

Estender a aba **Atividade/Hora** para também computar tickets (Ellevo) por hora de abertura, permitindo ao usuário alternar entre três fontes:

- **Ambos** (ligações + tickets)
- **Ligações** (comportamento atual)
- **Tickets** (somente tickets)

A nova vista deve respeitar os filtros globais já existentes no topo da página (data e produto) e o escopo (own/team, master/atendente).

## 2. Escopo

- Frontend somente. Nenhuma alteração em API, schema SQLite ou ETL — `ellevo_tickets.data_abertura` já contém timestamp ISO com hora.
- Extração da aba para um componente lazy em `src/tabs/AtividadeHoraTab.jsx` (padrão `ResumoTab`/`TicketsTab`).
- Adição de lógica de agregação de tickets por hora.
- UI: seletor de fonte (3 pills), barras empilhadas no modo "Ambos", coluna extra "Tickets" na tabela de detalhamento.

Fora de escopo:
- Mudanças na aba Resumo (que tem seu próprio gráfico diário).
- Outras tabs (Tickets, Equipe, Atualização).
- Persistência do `sourceMode` entre sessões.

## 3. Arquitetura

### 3.1 Novo componente

`src/tabs/AtividadeHoraTab.jsx` — carregado via `React.lazy` no `App.jsx`, embrulhado em `Suspense` com fallback "Carregando aba Atividade/Hora…".

**Responsabilidades:**
- Estado local `sourceMode` (`"ambos" | "ligacoes" | "tickets"`).
- Estado local `volumeMode` (`"volume" | "media"`) — movido do `App.jsx` (chamado hoje de `hourlyVolumeMode`).
- Render do seletor de fonte, dos dois cards de gráfico e da tabela de detalhamento.
- Empty state baseado no modo selecionado.

**Props recebidas do `App.jsx`:**
- Tema/UI: `P`, `ChartCard`, `Section`, `Table`, `TT`, `Ico`, ícones `Clock`, `ClipboardList`.
- Dados: `fCons`, `fTickets` (já filtrados por data + produto pelo controller).
- Filtros: `dateFrom`, `dateTo`, `produtoFilter`.
- Helpers: `fmtPct`.
- Flags: `isAttendant`.

### 3.2 Função de agregação

Extrair para `src/models/dashboardModel.js`:

```js
export function buildHourlyActivity(fCons, fTickets, { dateFrom, dateTo, resolveHourFromConsEntry, resolveDayGroupFromConsEntry })
```

Retorna `Array<HourlyBucket>` ordenado por hora. Receber os dois helpers como parâmetro evita acoplamento ao módulo (eles continuam vivendo no `App.jsx` por serem usados em outros memos).

**Estrutura do bucket:**
```js
{
  hora: number,             // 0-23
  horaLabel: "HH:00",
  // ligações
  total, atendidas, naoAtendidas, abandonadas, registros,
  mediaTotalHora, mediaAtendidasHora,
  txAtend, txAbandono, indisponiveis,
  daysCount,
  // tickets
  tickets,                  // soma de tickets abertos na hora
  mediaTicketsHora,         // tickets / daysCount (arredondado a 1 casa)
}
```

**Regras:**
- `fCons` alimenta os campos de ligação (igual ao memo atual).
- `fTickets`: para cada ticket, calcular `hora = new Date(t.dataAbertura).getHours()`; descartar se `dataAbertura` inválido ou ausente. Incrementar `bucket.tickets += 1`.
- Buckets vazios (sem ligação e sem ticket naquela hora) **não** entram no array final.
- `daysCount` segue o cálculo atual (`dateTo - dateFrom + 1`, com fallback para min/max dos `data_key` válidos em `fCons`). O range **não** é influenciado por tickets — mantém o comportamento atual e evita que tickets isolados expandam o denominador da média de ligações.

### 3.3 Helper de hora de ticket

Helper interno do `buildHourlyActivity` (não exportado):
```js
function resolveHourFromTicket(t) {
  if (!t?.dataAbertura) return null;
  const d = new Date(t.dataAbertura);
  return Number.isNaN(d.getTime()) ? null : d.getHours();
}
```

## 4. UI

### 4.1 Seletor de fonte

Barra de pills acima do primeiro `ChartCard`, fora dele (controla a aba inteira):

```
Fonte:  [ Ambos ]  [ Ligações ]  [ Tickets ]
```

- Reusa o estilo dos pills existentes (`hourlyVolumeMode`): ativo com borda + bg `${P.accent}22`; inativo com `P.card`.
- Oculto quando `isAttendant === true`. Default para atendente: `"ambos"`.

### 4.2 Gráfico 1 — Barras por hora

| `sourceMode` | Título | Conteúdo |
|---|---|---|
| `ligacoes` | "Ligações por Hora" | Igual ao atual: barras Total + Atendidas em `volume`; Média Total + Média Atendidas em `media`. |
| `tickets` | "Tickets por Hora" | Uma barra: `tickets` (`volume`) ou `mediaTicketsHora` (`media`). |
| `ambos` | "Acionamentos por Hora" | Barras **empilhadas**: Atendidas (verde, `P.green`) + Tickets (nova cor, ex. `P.purple` ou um accent secundário definido em `App.jsx`). Em `media`, usa `mediaAtendidasHora` + `mediaTicketsHora`. |

**Por que empilhar Atendidas + Tickets (e não Total + Tickets) no modo Ambos:** somar `total` (que inclui não-atendidas/abandonadas) com tickets produz um número enganoso. "Atendidas + Tickets" representa o volume real de acionamentos resolvidos pela equipe. Não-atendidas/abandonadas continuam disponíveis no gráfico 2 e na tabela.

Toggle Volume/Média/Hora permanece visível em todos os modos (não-atendente).

### 4.3 Gráfico 2 — Taxa abandono/NA

- Visível em `ligacoes` e `ambos`.
- **Oculto** em `tickets`.
- Comportamento idêntico ao atual (linha com `txAbandono`).

### 4.4 Tabela "Detalhamento por Hora"

| Modo | Colunas |
|---|---|
| `ligacoes` (master) | Hora, Total, Atend., Não At., Aband., Tx Atend., Tx Ab./NA |
| `ligacoes` (atendente) | Hora, Total, Atend., Não At., Aband. |
| `tickets` | Hora, Tickets |
| `ambos` (master) | Hora, Total, Atend., Não At., Aband., Tx Atend., Tx Ab./NA, **Tickets** |
| `ambos` (atendente) | Hora, Total, Atend., Não At., Aband., **Tickets** |

Filtragem de linhas:
- `ligacoes`: somente buckets com `total > 0`.
- `tickets`: somente buckets com `tickets > 0`.
- `ambos`: buckets com `total > 0 || tickets > 0`.

### 4.5 Empty state

A mensagem "Nenhum registro por hora foi encontrado no período filtrado." aparece quando o array filtrado pelo modo está vazio. Texto único para todos os modos — sem variações por fonte selecionada.

## 5. Interação com filtros globais

### 5.1 Filtro de produto

Produto só se aplica a tickets (ligações não têm campo `produto`). Quando há produto específico selecionado (`produtoFilter !== ""`):

- O seletor exibe **apenas** o pill "Tickets".
- `sourceMode` é forçado para `"tickets"` via `useEffect`:
  ```js
  useEffect(() => {
    if (produtoFilter && sourceMode !== "tickets") setSourceMode("tickets");
  }, [produtoFilter]);
  ```
- Hint pequeno (cor `P.dim`, fontSize 11) abaixo do seletor: *"Produto selecionado: ligações não são filtradas por produto."* — só aparece quando há produto filtrado.
- Ao limpar o produto, `sourceMode` **não** volta automaticamente para `ambos` — fica em `tickets` (último estado válido). Usuário escolhe.

### 5.2 Filtro de data

Sem mudanças. `fCons` e `fTickets` chegam já filtrados pelo controller. `daysCount` segue a fórmula atual.

### 5.3 ViewScope (own/team)

Sem mudanças no componente — o controller já entrega `fCons`/`fTickets` no escopo correto.

### 5.4 Atendente sem vínculo

Mesmo comportamento atual: aba acessível, dados vazios, empty state.

## 6. Testes

### 6.1 Unitários

Em `src/models/dashboardModel.test.js`, adicionar testes para `buildHourlyActivity`:

1. `fCons` com 3 horas distintas, sem tickets → 3 buckets com `total`/`atendidas` corretos, `tickets: 0`.
2. `fTickets` com 2 tickets na mesma hora, sem ligações → bucket único com `tickets: 2`.
3. Hora compartilhada por ligação + ticket → bucket único com ambos os campos preenchidos.
4. Ticket com `dataAbertura` inválida (string `""`, `null`, ou data inválida) → descartado, sem bucket criado.
5. `daysCount` calculado a partir de `dateFrom`/`dateTo` → `mediaTicketsHora` ≈ `tickets / daysCount` arredondado a 1 casa.
6. Range vazio (`dateFrom`/`dateTo` ambos null) → fallback para min/max das `data_key` de `fCons`; tickets isolados não expandem o range.

### 6.2 Validação manual (UI)

- Master, sem produto: alternar Ambos/Ligações/Tickets, verificar gráficos e tabela.
- Master, produto filtrado: confirmar que o seletor mostra só "Tickets" e o hint aparece.
- Master, modo Ambos + Média/Hora: barras empilhadas com `mediaAtendidasHora` + `mediaTicketsHora`.
- Atendente vinculado: aba renderiza sem seletor, modo `ambos`, sem gráfico 2.
- Atendente sem vínculo: empty state.
- Filtro de data restrito a 1 dia: `daysCount = 1`, `mediaTicketsHora = tickets`.
- Trocar entre abas (Resumo / Equipe / Tickets) e voltar — confirmar que nada quebrou nelas.

### 6.3 Build

`npm run build` deve passar. Confirmar que o bundle inicial não cresceu significativamente (extração para `tabs/` mantém lazy loading).

## 7. Impacto em arquivos

| Arquivo | Mudança |
|---|---|
| `src/App.jsx` | Remove memo `hourlyActivity` (linhas ~1480-1543), remove estado `hourlyVolumeMode` (linha 833), remove bloco `tab === "atividade-hora"` (linhas ~3143-3327). Adiciona import lazy + bloco `Suspense` para a nova tab. |
| `src/tabs/AtividadeHoraTab.jsx` | Novo. |
| `src/models/dashboardModel.js` | Adiciona `buildHourlyActivity`. |
| `src/models/dashboardModel.test.js` | Adiciona testes da função nova. |

## 8. Riscos e mitigações

- **Cor nova para tickets no gráfico empilhado**: a paleta `P` em `App.jsx` deve ser inspecionada na implementação. Se já houver um accent secundário disponível (ex. roxo/laranja), reusar; caso contrário, adicionar um novo campo (ex. `P.purple`) no objeto da paleta, mantendo o padrão de cores existente.
- **`new Date(t.dataAbertura).getHours()` depende do fuso local**: tickets ISO já trazem timezone; `getHours()` retorna hora local do navegador, que é o comportamento esperado (ligações também usam hora local). Sem mitigação necessária.
- **Verificação:** `hourlyActivity` e `hourlyVolumeMode` foram conferidos via grep — só aparecem dentro do bloco da aba Atividade/Hora. Sem regressão em outras tabs.
