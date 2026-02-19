import * as XLSX from "@e965/xlsx";

export interface ExportGroup {
  id: string;
  name: string;
  type: string;
  order_index: number;
  active: boolean;
}

export interface ExportCategory {
  id: string;
  name: string;
  description: string | null;
  group_id: string | null;
  group_name: string | null;
  order_index: number;
  active: boolean;
}

export interface ImportGroup {
  nome: string;
  tipo: string;
  ordem: number;
  ativo: boolean;
}

export interface ImportCategory {
  nome: string;
  grupo: string;
  descricao: string;
  ativo: boolean;
}

const GROUP_TYPES_PT: Record<string, string> = {
  expense: "Despesa",
  deduction: "Dedução",
  distribution: "Distribuição",
};

const GROUP_TYPES_EN: Record<string, string> = {
  Despesa: "expense",
  Dedução: "deduction",
  Distribuição: "distribution",
};

/**
 * Export Chart of Accounts (groups and categories) to Excel
 */
export function exportChartOfAccountsToExcel(
  groups: ExportGroup[],
  categories: ExportCategory[]
): void {
  // Create workbook
  const wb = XLSX.utils.book_new();

  // ========== GRUPOS SHEET ==========
  const groupsData = [
    ["GRUPOS DO PLANO DE CONTAS"],
    [""],
    ["Nome", "Tipo", "Ordem", "Ativo"],
    ...groups.map((g) => [
      g.name,
      GROUP_TYPES_PT[g.type] || g.type,
      g.order_index,
      g.active ? "Sim" : "Não",
    ]),
  ];

  const wsGroups = XLSX.utils.aoa_to_sheet(groupsData);
  
  // Set column widths
  wsGroups["!cols"] = [
    { wch: 30 }, // Nome
    { wch: 15 }, // Tipo
    { wch: 10 }, // Ordem
    { wch: 10 }, // Ativo
  ];

  XLSX.utils.book_append_sheet(wb, wsGroups, "Grupos");

  // ========== CONTAS SHEET ==========
  const categoriesData = [
    ["CONTAS DO PLANO DE CONTAS"],
    [""],
    ["Nome", "Grupo", "Descrição", "Ativo"],
    ...categories.map((c) => [
      c.name,
      c.group_name || "",
      c.description || "",
      c.active ? "Sim" : "Não",
    ]),
  ];

  const wsCategories = XLSX.utils.aoa_to_sheet(categoriesData);
  
  // Set column widths
  wsCategories["!cols"] = [
    { wch: 30 }, // Nome
    { wch: 25 }, // Grupo
    { wch: 50 }, // Descrição
    { wch: 10 }, // Ativo
  ];

  XLSX.utils.book_append_sheet(wb, wsCategories, "Contas");

  // ========== INSTRUÇÕES SHEET ==========
  const instructionsData = [
    ["INSTRUÇÕES PARA IMPORTAÇÃO"],
    [""],
    ["ATENÇÃO: Para importar, siga as instruções abaixo:"],
    [""],
    ["1. GRUPOS (aba 'Grupos'):"],
    ["   - Nome: Nome do grupo (obrigatório)"],
    ["   - Tipo: Despesa, Dedução ou Distribuição (obrigatório)"],
    ["   - Ordem: Número para ordenação (opcional, padrão: 0)"],
    ["   - Ativo: Sim ou Não (opcional, padrão: Sim)"],
    [""],
    ["2. CONTAS (aba 'Contas'):"],
    ["   - Nome: Nome da conta (obrigatório)"],
    ["   - Grupo: Nome exato do grupo (deve existir na aba Grupos)"],
    ["   - Descrição: Descrição da conta (opcional)"],
    ["   - Ativo: Sim ou Não (opcional, padrão: Sim)"],
    [""],
    ["IMPORTANTE:"],
    ["- Não altere os cabeçalhos das colunas (linha 3)"],
    ["- Linhas em branco serão ignoradas"],
    ["- Grupos são importados primeiro, depois as contas"],
    ["- Grupos/contas com mesmo nome serão atualizados"],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions["!cols"] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instruções");

  // Generate file
  const fileName = `plano_de_contas_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Parse Excel file and return groups and categories
 */
export function parseChartOfAccountsExcel(file: File): Promise<{
  groups: ImportGroup[];
  categories: ImportCategory[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const groups: ImportGroup[] = [];
        const categories: ImportCategory[] = [];

        // Parse Groups sheet
        const groupsSheet = workbook.Sheets["Grupos"];
        if (groupsSheet) {
          const groupsRaw = XLSX.utils.sheet_to_json<Record<string, any>>(groupsSheet, {
            header: 1,
            defval: "",
          }) as any[][];

          // Find header row (row with "Nome", "Tipo", etc.)
          let headerRowIndex = -1;
          for (let i = 0; i < groupsRaw.length; i++) {
            const row = groupsRaw[i];
            if (row[0]?.toString().toLowerCase() === "nome" && 
                row[1]?.toString().toLowerCase() === "tipo") {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex >= 0) {
            for (let i = headerRowIndex + 1; i < groupsRaw.length; i++) {
              const row = groupsRaw[i];
              const nome = row[0]?.toString().trim();
              if (!nome) continue;

              const tipoRaw = row[1]?.toString().trim() || "Despesa";
              const tipo = GROUP_TYPES_EN[tipoRaw] || "expense";
              const ordem = parseInt(row[2]?.toString()) || 0;
              const ativoRaw = row[3]?.toString().toLowerCase().trim();
              const ativo = ativoRaw !== "não" && ativoRaw !== "nao";

              groups.push({ nome, tipo, ordem, ativo });
            }
          }
        }

        // Parse Categories sheet
        const categoriesSheet = workbook.Sheets["Contas"];
        if (categoriesSheet) {
          const categoriesRaw = XLSX.utils.sheet_to_json<Record<string, any>>(categoriesSheet, {
            header: 1,
            defval: "",
          }) as any[][];

          // Find header row
          let headerRowIndex = -1;
          for (let i = 0; i < categoriesRaw.length; i++) {
            const row = categoriesRaw[i];
            if (row[0]?.toString().toLowerCase() === "nome" && 
                row[1]?.toString().toLowerCase() === "grupo") {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex >= 0) {
            for (let i = headerRowIndex + 1; i < categoriesRaw.length; i++) {
              const row = categoriesRaw[i];
              const nome = row[0]?.toString().trim();
              if (!nome) continue;

              const grupo = row[1]?.toString().trim() || "";
              const descricao = row[2]?.toString().trim() || "";
              const ativoRaw = row[3]?.toString().toLowerCase().trim();
              const ativo = ativoRaw !== "não" && ativoRaw !== "nao";

              categories.push({ nome, grupo, descricao, ativo });
            }
          }
        }

        resolve({ groups, categories });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Download template Excel file for import
 */
export function downloadChartOfAccountsTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Template Groups
  const groupsData = [
    ["GRUPOS DO PLANO DE CONTAS"],
    [""],
    ["Nome", "Tipo", "Ordem", "Ativo"],
    ["Custo Fixo", "Despesa", "1", "Sim"],
    ["Impostos", "Dedução", "2", "Sim"],
    ["Distribuição de Lucros", "Distribuição", "3", "Sim"],
  ];

  const wsGroups = XLSX.utils.aoa_to_sheet(groupsData);
  wsGroups["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsGroups, "Grupos");

  // Template Categories
  const categoriesData = [
    ["CONTAS DO PLANO DE CONTAS"],
    [""],
    ["Nome", "Grupo", "Descrição", "Ativo"],
    ["Folha de Pagamento", "Custo Fixo", "Salários e encargos", "Sim"],
    ["Aluguel", "Custo Fixo", "Aluguel do escritório", "Sim"],
    ["ISS", "Impostos", "Imposto sobre serviços", "Sim"],
    ["IRPJ", "Impostos", "Imposto de renda pessoa jurídica", "Sim"],
  ];

  const wsCategories = XLSX.utils.aoa_to_sheet(categoriesData);
  wsCategories["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 50 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsCategories, "Contas");

  // Instructions
  const instructionsData = [
    ["INSTRUÇÕES PARA IMPORTAÇÃO"],
    [""],
    ["ATENÇÃO: Para importar, siga as instruções abaixo:"],
    [""],
    ["1. GRUPOS (aba 'Grupos'):"],
    ["   - Nome: Nome do grupo (obrigatório)"],
    ["   - Tipo: Despesa, Dedução ou Distribuição (obrigatório)"],
    ["   - Ordem: Número para ordenação (opcional, padrão: 0)"],
    ["   - Ativo: Sim ou Não (opcional, padrão: Sim)"],
    [""],
    ["2. CONTAS (aba 'Contas'):"],
    ["   - Nome: Nome da conta (obrigatório)"],
    ["   - Grupo: Nome exato do grupo (deve existir na aba Grupos)"],
    ["   - Descrição: Descrição da conta (opcional)"],
    ["   - Ativo: Sim ou Não (opcional, padrão: Sim)"],
    [""],
    ["IMPORTANTE:"],
    ["- Não altere os cabeçalhos das colunas (linha 3)"],
    ["- Linhas em branco serão ignoradas"],
    ["- Grupos são importados primeiro, depois as contas"],
    ["- Grupos/contas com mesmo nome serão atualizados"],
    [""],
    ["DICA: Apague as linhas de exemplo antes de importar!"],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions["!cols"] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instruções");

  XLSX.writeFile(wb, "modelo_plano_de_contas.xlsx");
}
