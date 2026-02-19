import * as XLSX from '@e965/xlsx';

export interface ParsedDoctor {
  name: string;
  cpf: string;
  crm: string;
  phone: string | null;
  bank_name: string | null;
  pix_key: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  is_freelancer: boolean;
  birth_date: string | null;
  address: string | null;
  neighborhood: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  certificate_expires_at: string | null;
  linked_company: string | null;
  linked_company_2: string | null;
}

export interface ExportDoctor {
  id: string;
  name: string;
  cpf: string;
  crm: string;
  aliquota: number;
  phone: string | null;
  bank_name: string | null;
  pix_key: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  is_freelancer: boolean;
  birth_date: string | null;
  address: string | null;
  neighborhood: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  certificate_expires_at: string | null;
  linked_company: string | null;
  linked_company_2: string | null;
}

// Normalize CPF to digits only
function normalizeCpf(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str.replace(/\D/g, '').padStart(11, '0');
}

// Format CPF for display
function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '').padStart(11, '0');
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// Parse Excel date to ISO string
function parseExcelDate(value: any): string | null {
  if (!value) return null;
  
  // If it's already a Date object (from xlsx)
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  // If it's a number (Excel serial date)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const year = date.y;
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    
    // Try DD/MM/YYYY format
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Try YYYY-MM-DD format
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return trimmed;
    }
  }
  
  return null;
}

// Parse boolean from various formats
function parseBoolean(value: any): boolean {
  if (value === null || value === undefined) return false;
  
  const str = String(value).toLowerCase().trim();
  return str === 'sim' || str === 's' || str === 'yes' || str === 'y' || str === 'true' || str === '1' || str === 'x';
}

// Get string value or null
function getString(value: any): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str || null;
}

// Column mapping from Excel to database
const COLUMN_MAPPING: Record<string, keyof ParsedDoctor> = {
  'nome': 'name',
  'name': 'name',
  'cpf': 'cpf',
  'crm': 'crm',
  'telefone': 'phone',
  'phone': 'phone',
  'banco': 'bank_name',
  'bank': 'bank_name',
  'bank_name': 'bank_name',
  'pix': 'pix_key',
  'chave pix': 'pix_key',
  'pix_key': 'pix_key',
  'agencia': 'bank_agency',
  'agência': 'bank_agency',
  'agency': 'bank_agency',
  'bank_agency': 'bank_agency',
  'conta': 'bank_account',
  'account': 'bank_account',
  'bank_account': 'bank_account',
  'avulso': 'is_freelancer',
  'freelancer': 'is_freelancer',
  'is_freelancer': 'is_freelancer',
  'data nascimento': 'birth_date',
  'data de nascimento': 'birth_date',
  'nascimento': 'birth_date',
  'birth_date': 'birth_date',
  'endereco': 'address',
  'endereço': 'address',
  'address': 'address',
  'bairro': 'neighborhood',
  'neighborhood': 'neighborhood',
  'cep': 'zip_code',
  'zip_code': 'zip_code',
  'cidade': 'city',
  'city': 'city',
  'estado': 'state',
  'uf': 'state',
  'state': 'state',
  'validade certificado': 'certificate_expires_at',
  'certificado expira': 'certificate_expires_at',
  'certificado expira em': 'certificate_expires_at',
  'certificate_expires_at': 'certificate_expires_at',
  'empresa vinculada': 'linked_company',
  'linked_company': 'linked_company',
  'empresa 2': 'linked_company_2',
  'linked_company_2': 'linked_company_2',
};

// Parse Excel file and return array of doctors
export async function parseDoctorsExcel(file: File): Promise<ParsedDoctor[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with raw values
        const rawData = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: null });
        
        if (rawData.length === 0) {
          throw new Error('Planilha vazia ou sem dados');
        }
        
        // Get headers and create mapping
        const firstRow = rawData[0] as Record<string, any>;
        const headers = Object.keys(firstRow);
        
        const columnMap: Record<string, keyof ParsedDoctor> = {};
        for (const header of headers) {
          const normalizedHeader = header.toLowerCase().trim();
          if (COLUMN_MAPPING[normalizedHeader]) {
            columnMap[header] = COLUMN_MAPPING[normalizedHeader];
          }
        }
        
        // Check required columns
        const requiredFields: (keyof ParsedDoctor)[] = ['name', 'cpf', 'crm'];
        const mappedFields = Object.values(columnMap);
        const missingFields = requiredFields.filter(f => !mappedFields.includes(f));
        
        if (missingFields.length > 0) {
          throw new Error(`Colunas obrigatórias não encontradas: ${missingFields.join(', ')}`);
        }
        
        // Parse each row
        const doctors: ParsedDoctor[] = [];
        
        for (const row of rawData as Record<string, any>[]) {
          const doctor: Partial<ParsedDoctor> = {};
          
          for (const [excelCol, dbCol] of Object.entries(columnMap)) {
            const value = row[excelCol];
            
            switch (dbCol) {
              case 'name':
                doctor.name = getString(value) || '';
                break;
              case 'cpf':
                doctor.cpf = formatCpf(normalizeCpf(value));
                break;
              case 'crm':
                doctor.crm = getString(value) || '';
                break;
              case 'is_freelancer':
                doctor.is_freelancer = parseBoolean(value);
                break;
              case 'birth_date':
              case 'certificate_expires_at':
                doctor[dbCol] = parseExcelDate(value);
                break;
              default:
                doctor[dbCol] = getString(value);
            }
          }
          
          // Only add if has required fields
          if (doctor.name && doctor.cpf && doctor.crm) {
            // Ensure all fields exist
            doctors.push({
              name: doctor.name,
              cpf: doctor.cpf,
              crm: doctor.crm,
              phone: doctor.phone || null,
              bank_name: doctor.bank_name || null,
              pix_key: doctor.pix_key || null,
              bank_agency: doctor.bank_agency || null,
              bank_account: doctor.bank_account || null,
              is_freelancer: doctor.is_freelancer || false,
              birth_date: doctor.birth_date || null,
              address: doctor.address || null,
              neighborhood: doctor.neighborhood || null,
              zip_code: doctor.zip_code || null,
              city: doctor.city || null,
              state: doctor.state || null,
              certificate_expires_at: doctor.certificate_expires_at || null,
              linked_company: doctor.linked_company || null,
              linked_company_2: doctor.linked_company_2 || null,
            });
          }
        }
        
        if (doctors.length === 0) {
          throw new Error('Nenhum médico válido encontrado na planilha');
        }
        
        resolve(doctors);
      } catch (error: any) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// Export doctors to Excel file
export function exportDoctorsToExcel(doctors: ExportDoctor[]): void {
  const exportData = doctors.map((doc) => ({
    'Nome': doc.name,
    'CPF': doc.cpf,
    'CRM': doc.crm,
    'Alíquota (%)': doc.aliquota,
    'Telefone': doc.phone || '',
    'Banco': doc.bank_name || '',
    'Agência': doc.bank_agency || '',
    'Conta': doc.bank_account || '',
    'PIX': doc.pix_key || '',
    'Avulso': doc.is_freelancer ? 'Sim' : 'Não',
    'Data Nascimento': doc.birth_date || '',
    'Endereço': doc.address || '',
    'Bairro': doc.neighborhood || '',
    'CEP': doc.zip_code || '',
    'Cidade': doc.city || '',
    'Estado': doc.state || '',
    'Certificado Expira Em': doc.certificate_expires_at || '',
    'Empresa Vinculada': doc.linked_company || '',
    'empresa 2': doc.linked_company_2 || '',
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Médicos');
  
  // Auto-size columns
  const colWidths = [
    { wch: 35 }, // Nome
    { wch: 15 }, // CPF
    { wch: 12 }, // CRM
    { wch: 12 }, // Alíquota
    { wch: 15 }, // Telefone
    { wch: 20 }, // Banco
    { wch: 10 }, // Agência
    { wch: 15 }, // Conta
    { wch: 25 }, // PIX
    { wch: 8 },  // Avulso
    { wch: 12 }, // Data Nascimento
    { wch: 40 }, // Endereço
    { wch: 20 }, // Bairro
    { wch: 10 }, // CEP
    { wch: 20 }, // Cidade
    { wch: 6 },  // Estado
    { wch: 18 }, // Certificado
    { wch: 25 }, // Empresa Vinculada
    { wch: 25 }, // empresa 2
  ];
  worksheet['!cols'] = colWidths;
  
  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `medicos_${today}.xlsx`);
}

// Download empty template
export function downloadDoctorsTemplate(): void {
  const templateData = [
    {
      'Nome': 'Dr. João Silva',
      'CPF': '123.456.789-00',
      'CRM': '12345/PE',
      'Telefone': '(81) 99999-9999',
      'Banco': 'Banco do Brasil',
      'Agência': '1234-5',
      'Conta': '12345-6',
      'PIX': 'joao@email.com',
      'Avulso': 'Não',
      'Data Nascimento': '15/03/1980',
      'Endereço': 'Rua Exemplo, 123',
      'Bairro': 'Centro',
      'CEP': '50000-000',
      'Cidade': 'Recife',
      'Estado': 'PE',
      'Certificado Expira Em': '31/12/2025',
      'Empresa Vinculada': 'MaisMed Gestão',
      'empresa 2': '',
    },
  ];
  
  // Create instructions sheet
  const instructions = [
    { 'Instruções de Preenchimento': '' },
    { 'Instruções de Preenchimento': '1. Preencha os dados dos médicos a partir da linha 2' },
    { 'Instruções de Preenchimento': '2. Campos obrigatórios: Nome, CPF, CRM' },
    { 'Instruções de Preenchimento': '3. CPF pode ser com ou sem formatação (123.456.789-00 ou 12345678900)' },
    { 'Instruções de Preenchimento': '4. Datas no formato DD/MM/AAAA' },
    { 'Instruções de Preenchimento': '5. Avulso: "Sim" ou "Não"' },
    { 'Instruções de Preenchimento': '6. Estado: sigla (PE, SP, RJ, etc.)' },
    { 'Instruções de Preenchimento': '' },
    { 'Instruções de Preenchimento': 'Novos médicos serão inseridos com alíquota padrão de 15%.' },
    { 'Instruções de Preenchimento': 'Médicos existentes (mesmo CPF) terão seus dados atualizados,' },
    { 'Instruções de Preenchimento': 'preservando a alíquota e senha do portal.' },
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const instrSheet = XLSX.utils.json_to_sheet(instructions);
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Médicos');
  XLSX.utils.book_append_sheet(workbook, instrSheet, 'Instruções');
  
  // Auto-size columns
  const colWidths = [
    { wch: 35 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 20 },
    { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 8 }, { wch: 12 },
    { wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 6 }, { wch: 18 },
    { wch: 25 }, { wch: 25 },
  ];
  worksheet['!cols'] = colWidths;
  instrSheet['!cols'] = [{ wch: 60 }];
  
  XLSX.writeFile(workbook, 'modelo_medicos.xlsx');
}
