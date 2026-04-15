import { describe, it, expect } from "vitest";
import {
  parseDataPt,
  parseSec,
  fmtSec,
  fmtPct,
  normalize,
  splitTitulo,
  isTransferencia,
  isErroApp,
  AGENT_MAP,
} from "./utils.js";

// ---------------------------------------------------------------------------
// parseDataPt
// ---------------------------------------------------------------------------
describe("parseDataPt", () => {
  it("converte data em português para Date", () => {
    const d = parseDataPt("14 de Abril");
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // abril = índice 3
    expect(d.getDate()).toBe(14);
  });

  it("converte corretamente cada mês", () => {
    const casos = [
      ["2 de Janeiro", 0, 2],
      ["28 de Fevereiro", 1, 28],
      ["1 de Março", 2, 1],
      ["30 de Junho", 5, 30],
      ["31 de Dezembro", 11, 31],
    ];
    for (const [str, mes, dia] of casos) {
      const d = parseDataPt(str);
      expect(d.getMonth(), str).toBe(mes);
      expect(d.getDate(), str).toBe(dia);
    }
  });

  it("retorna null para string vazia", () => {
    expect(parseDataPt("")).toBeNull();
  });

  it("retorna null para null/undefined", () => {
    expect(parseDataPt(null)).toBeNull();
    expect(parseDataPt(undefined)).toBeNull();
  });

  it("retorna null para string sem mês reconhecível", () => {
    expect(parseDataPt("2026-04-14")).toBeNull();
    expect(parseDataPt("14/04")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseSec
// ---------------------------------------------------------------------------
describe("parseSec", () => {
  it("converte string '178 s' para 178", () => {
    expect(parseSec("178 s")).toBe(178);
  });

  it("converte string '27s' (sem espaço) para 27", () => {
    expect(parseSec("27s")).toBe(27);
  });

  it("aceita número direto", () => {
    expect(parseSec(174)).toBe(174);
    expect(parseSec(0)).toBe(0);
  });

  it("trata non-breaking space (\\xa0) como espaço", () => {
    expect(parseSec("143\xa0s")).toBe(143);
  });

  it("retorna 0 para valor nulo/vazio", () => {
    expect(parseSec(null)).toBe(0);
    expect(parseSec("")).toBe(0);
    expect(parseSec(undefined)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fmtSec
// ---------------------------------------------------------------------------
describe("fmtSec", () => {
  it("formata segundos abaixo de 60 sem minutos", () => {
    expect(fmtSec(0)).toBe("0s");
    expect(fmtSec(45)).toBe("45s");
    expect(fmtSec(59)).toBe("59s");
  });

  it("formata 60s como '1m0s'", () => {
    expect(fmtSec(60)).toBe("1m0s");
  });

  it("formata 174s como '2m54s'", () => {
    expect(fmtSec(174)).toBe("2m54s");
  });

  it("formata 300s como '5m0s'", () => {
    expect(fmtSec(300)).toBe("5m0s");
  });

  it("formata 3661s como '61m1s'", () => {
    expect(fmtSec(3661)).toBe("61m1s");
  });
});

// ---------------------------------------------------------------------------
// fmtPct
// ---------------------------------------------------------------------------
describe("fmtPct", () => {
  it("formata 0 como '0.0%'", () => {
    expect(fmtPct(0)).toBe("0.0%");
  });

  it("formata 1 como '100.0%'", () => {
    expect(fmtPct(1)).toBe("100.0%");
  });

  it("formata 0.9 como '90.0%'", () => {
    expect(fmtPct(0.9)).toBe("90.0%");
  });

  it("formata 0.1765 como '17.6%' (0.1765*100 = 17.649... → arredonda para baixo)", () => {
    expect(fmtPct(0.1765)).toBe("17.6%");
  });

  it("formata 0.8243 como '82.4%'", () => {
    expect(fmtPct(0.8243)).toBe("82.4%");
  });
});

// ---------------------------------------------------------------------------
// normalize
// ---------------------------------------------------------------------------
describe("normalize", () => {
  it("retorna 'Outros' para entrada vazia ou null", () => {
    expect(normalize("")).toBe("Outros");
    expect(normalize(null)).toBe("Outros");
    expect(normalize(undefined)).toBe("Outros");
  });

  it("classifica transferências", () => {
    expect(normalize("Transferência")).toBe("Transferência");
    expect(normalize("TRANSFERENCIA")).toBe("Transferência");
    expect(normalize("Trasferencia boleto")).toBe("Transferência");
  });

  it("classifica problemas de acesso/app", () => {
    expect(normalize("Aplicativo travado")).toBe("Acesso/App");
    expect(normalize("Acesso bloqueado")).toBe("Acesso/App");
    expect(normalize("Reset de senha")).toBe("Acesso/App");
    expect(normalize("Dispositivo inativo")).toBe("Acesso/App");
    expect(normalize("Status do app")).toBe("Acesso/App");
    expect(normalize("Verificação pendente")).toBe("Acesso/App");
    expect(normalize("App congelado")).toBe("Acesso/App");
  });

  it("classifica PIX/TED", () => {
    expect(normalize("PIX não processado")).toBe("PIX/TED");
    expect(normalize("Pagamento recusado")).toBe("PIX/TED");
  });

  it("classifica cadastro", () => {
    expect(normalize("Cadastro novo")).toBe("Cadastro");
    expect(normalize("Abertura de conta")).toBe("Cadastro");
  });

  it("classifica extrato/relatório", () => {
    expect(normalize("Extrato mensal")).toBe("Relatório/Extrato");
    expect(normalize("Relatório financeiro")).toBe("Relatório/Extrato");
    expect(normalize("Informe de rendimentos")).toBe("Relatório/Extrato");
  });

  it("classifica incidente/falha", () => {
    expect(normalize("Falha no sistema")).toBe("Incidente");
    expect(normalize("Incidente crítico")).toBe("Incidente");
    expect(normalize("Débito indevido")).toBe("Incidente");
  });

  it("classifica consulta de saldo", () => {
    expect(normalize("Consulta saldo")).toBe("Consulta Saldo");
    expect(normalize("Saldo incorreto")).toBe("Consulta Saldo");
  });

  it("retorna 'Outros' para título não reconhecido", () => {
    expect(normalize("Lorem ipsum")).toBe("Outros");
    expect(normalize("xyz")).toBe("Outros");
  });

  it("é case-insensitive", () => {
    expect(normalize("transferência")).toBe("Transferência");
    expect(normalize("APLICATIVO")).toBe("Acesso/App");
    expect(normalize("pix")).toBe("PIX/TED");
  });
});

// ---------------------------------------------------------------------------
// splitTitulo
// ---------------------------------------------------------------------------
describe("splitTitulo", () => {
  it("divide pelo primeiro ' - '", () => {
    expect(splitTitulo("Transferência - FULANO")).toEqual([
      "Transferência",
      "FULANO",
    ]);
  });

  it("divide pelo primeiro '/' quando não há ' - '", () => {
    expect(splitTitulo("PIX/TED pendente")).toEqual(["PIX", "TED pendente"]);
  });

  it("retorna string inteira quando não há separador", () => {
    expect(splitTitulo("Sem separador")).toEqual(["Sem separador", ""]);
  });

  it("trata \\xa0 como espaço normal no separador", () => {
    expect(splitTitulo("Transferência\xa0-\xa0FULANO")).toEqual([
      "Transferência",
      "FULANO",
    ]);
  });

  it("retorna par vazio para entrada nula/vazia", () => {
    expect(splitTitulo(null)).toEqual(["", ""]);
    expect(splitTitulo("")).toEqual(["", ""]);
  });

  it("faz trim nos dois lados", () => {
    expect(splitTitulo("  Categoria  -  Pessoa  ")).toEqual([
      "Categoria",
      "Pessoa",
    ]);
  });
});

// ---------------------------------------------------------------------------
// isTransferencia
// ---------------------------------------------------------------------------
describe("isTransferencia", () => {
  it("retorna true para ticket com categoria 'Transferência'", () => {
    expect(isTransferencia({ categoria: "Transferência" })).toBe(true);
  });

  it("retorna false para outras categorias", () => {
    expect(isTransferencia({ categoria: "Acesso/App" })).toBe(false);
    expect(isTransferencia({ categoria: "Cadastro" })).toBe(false);
    expect(isTransferencia({ categoria: "Outros" })).toBe(false);
  });

  it("retorna false para categoria ausente", () => {
    expect(isTransferencia({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isErroApp
// ---------------------------------------------------------------------------
describe("isErroApp", () => {
  it("retorna true para categoria 'Acesso/App'", () => {
    expect(isErroApp({ categoria: "Acesso/App", natureza: "Solicitação" })).toBe(
      true,
    );
  });

  it("retorna true para natureza 'Problema Ndd'", () => {
    expect(isErroApp({ categoria: "Cadastro", natureza: "Problema Ndd" })).toBe(
      true,
    );
  });

  it("retorna true quando ambas as condições são verdadeiras", () => {
    expect(
      isErroApp({ categoria: "Acesso/App", natureza: "Problema Ndd" }),
    ).toBe(true);
  });

  it("retorna false para ticket sem nenhuma das condições", () => {
    expect(
      isErroApp({ categoria: "Transferência", natureza: "Solicitação" }),
    ).toBe(false);
    expect(isErroApp({ categoria: "Cadastro", natureza: "Informação" })).toBe(
      false,
    );
  });

  it("retorna false para campos ausentes", () => {
    expect(isErroApp({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AGENT_MAP — integridade dos dados
// ---------------------------------------------------------------------------
describe("AGENT_MAP", () => {
  it("contém exatamente 5 agentes", () => {
    expect(Object.keys(AGENT_MAP)).toHaveLength(5);
  });

  it("mapeia corretamente os nomes AtPlus → Ellevo", () => {
    expect(AGENT_MAP["Marcos - Central"]).toBe("Marcos Costa");
    expect(AGENT_MAP["Matheus - Central"]).toBe("Matheus Lucas de Carvalho");
    expect(AGENT_MAP["Isaque - Central"]).toBe(
      "Isaque de Oliveira dos Santos",
    );
    expect(AGENT_MAP["Diego - Central"]).toBe("Diego Dias Fernandes");
    expect(AGENT_MAP["Gessica Freitas Becker"]).toBe("GESSICA FREITAS BECKER");
  });

  it("não inclui 'Central de relacionamentos' (fila geral, não é agente)", () => {
    expect(AGENT_MAP["Central de relacionamentos"]).toBeUndefined();
  });
});
