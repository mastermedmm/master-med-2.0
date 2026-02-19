/**
 * Parse Brazilian NF-e (Nota Fiscal Eletrônica) and NFSe Nacional (SPED) XML files
 * Extracts invoice data directly (no AI)
 * 
 * Supported formats:
 * - NFSe Nacional (SPED) - http://www.sped.fazenda.gov.br/nfse
 * - NFSe São Paulo (Prefeitura SP) - http://www.prefeitura.sp.gov.br/nfe
 * - NFSe ABRASF
 * - NF-e tradicional
 */

export type InvoiceType = 'NFS NACIONAL (SPED)' | 'NFSE SAO PAULO' | 'ABRASF' | 'NF-e';

export interface NFeData {
  invoiceType: InvoiceType;
  companyName: string;
  companyCnpj: string;
  companyCity: string;
  companyState: string;
  hospitalName: string;
  hospitalCnpj: string;
  hospitalCity: string;
  hospitalState: string;
  issueDate: string;
  expectedReceiptDate: string;
  invoiceNumber: string;
  grossValue: number;
  netValueFromXml: number; // Valor líquido original do XML
  hasRetention: boolean; // Se houve qualquer retenção efetiva (federais e/ou ISS retido)
  isIssRetained: boolean; // Se o ISS foi efetivamente retido (deduzido do líquido)
  totalDeductions: number;
  issValue: number;
  issPercentage: number;
  irrfValue: number;
  inssValue: number;
  csllValue: number;
  pisValue: number;
  cofinsValue: number;
}

const getLastDayOfMonth = (dateString: string): string => {
  if (!dateString) return '';
  const [year, month] = dateString.split('-').map(Number);
  if (!year || !month) return '';
  const lastDay = new Date(year, month, 0);
  const y = lastDay.getFullYear();
  const m = String(lastDay.getMonth() + 1).padStart(2, '0');
  const d = String(lastDay.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

type ParentNode = Document | Element;

const parseValue = (value: string): number => {
  const v = (value ?? '').trim();
  if (!v) return 0;
  const normalized = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

const findFirstByLocalName = (parent: ParentNode, localName: string): Element | null => {
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el?.localName === localName) return el;
  }
  return null;
};

const findAllByLocalName = (parent: ParentNode, localName: string): Element[] => {
  const all = parent.getElementsByTagName('*');
  const results: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el?.localName === localName) results.push(el);
  }
  return results;
};

const getTextByLocalName = (parent: ParentNode, localName: string): string => {
  const el = findFirstByLocalName(parent, localName);
  return el?.textContent?.trim() ?? '';
};

const getNestedTextByLocalName = (root: ParentNode, parentLocal: string, childLocal: string): string => {
  const parent = findFirstByLocalName(root, parentLocal);
  if (!parent) return '';
  return getTextByLocalName(parent, childLocal);
};

// Try multiple tag names and return the first non-zero value
const getValueFromTags = (parent: ParentNode, tagNames: string[]): number => {
  for (const tag of tagNames) {
    const value = parseValue(getTextByLocalName(parent, tag));
    if (value > 0) return value;
  }
  return 0;
};

export async function parseNFeXML(file: File): Promise<NFeData> {
  const text = await file.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');

  const parseError = xml.querySelector('parsererror');
  if (parseError) throw new Error('Arquivo XML inválido');

  // Detect NF-e vs NFSe format
  const rootName = xml.documentElement?.localName ?? '';
  const rootNamespace = xml.documentElement?.namespaceURI ?? '';
  
  // NFSe São Paulo (Prefeitura SP) - formato flat com tags diretas
  // Root: <RetornoConsulta> ou <NFe> com namespace prefeitura.sp.gov.br
  const isNFSeSaoPaulo = 
    rootNamespace.includes('prefeitura.sp.gov.br') ||
    (rootName === 'RetornoConsulta' && !!findFirstByLocalName(xml, 'RazaoSocialPrestador')) ||
    (rootName === 'NFe' && !!findFirstByLocalName(xml, 'RazaoSocialPrestador') && 
     !!findFirstByLocalName(xml, 'ValorServicos'));
  
  // NFSe Nacional (SPED) pode vir tanto com raiz <NFSe> quanto embrulhado em listas
  // (ex: <ListaNfseCompetencia> contendo múltiplos <NFSe><infNFSe><DPS>...)
  const hasSpedMarkers =
    !!findFirstByLocalName(xml, 'DPS') ||
    !!findFirstByLocalName(xml, 'infDPS');

  const isNFSeNacional = !isNFSeSaoPaulo && (
    (rootName === 'NFSe' &&
      (xml.documentElement?.namespaceURI?.includes('sped.fazenda.gov.br') ||
        !!findFirstByLocalName(xml, 'infNFSe'))) ||
    // Wrapper roots (lista/competência) sem namespace, mas com estrutura DPS
    (hasSpedMarkers && !!findFirstByLocalName(xml, 'infNFSe')));
  
  const isNFSe = isNFSeNacional || 
                 isNFSeSaoPaulo ||
                 rootName === 'NFSe' || 
                 rootName === 'ConsultarNfseResposta' ||
                 !!findFirstByLocalName(xml, 'InfNfse') ||
                 !!findFirstByLocalName(xml, 'infNFSe');

  // Base element for searching
  const base: ParentNode = isNFSeSaoPaulo
    ? findFirstByLocalName(xml, 'NFe') ?? xml
    : isNFSeNacional
      ? findFirstByLocalName(xml, 'infNFSe') ?? xml
      : isNFSe
        ? findFirstByLocalName(xml, 'InfNfse') ??
          findFirstByLocalName(xml, 'infNFSe') ?? 
          findFirstByLocalName(xml, 'NFSe') ?? xml
        : findFirstByLocalName(xml, 'infNFe') ?? findFirstByLocalName(xml, 'NFe') ?? xml;

  // Helper to get emitter element
  const getEmitElement = () => {
    if (isNFSeSaoPaulo) {
      // NFSe São Paulo uses flat structure - no separate emit element
      return null;
    }
    if (isNFSeNacional) {
      return findFirstByLocalName(base, 'emit') || findFirstByLocalName(base, 'prest');
    }
    if (isNFSe) {
      return findFirstByLocalName(base, 'PrestadorServico') || 
             findFirstByLocalName(base, 'emit') || 
             findFirstByLocalName(base, 'prest');
    }
    return findFirstByLocalName(base, 'emit');
  };

  // Helper to get recipient element
  const getDestElement = () => {
    if (isNFSeSaoPaulo) {
      // NFSe São Paulo uses flat structure - no separate dest element
      return null;
    }
    if (isNFSeNacional) {
      return findFirstByLocalName(base, 'toma') || 
             findFirstByLocalName(findFirstByLocalName(xml, 'DPS') || xml, 'toma');
    }
    if (isNFSe) {
      // ABRASF uses 'Tomador' or 'TomadorServico'
      return findFirstByLocalName(base, 'Tomador') ||
             findFirstByLocalName(base, 'TomadorServico') || 
             findFirstByLocalName(base, 'toma') || 
             findFirstByLocalName(base, 'dest');
    }
    return findFirstByLocalName(base, 'dest');
  };

  const emitElement = getEmitElement();
  const destElement = getDestElement();

  // Company / Emitter
  let companyName = '';
  if (isNFSeSaoPaulo) {
    // NFSe São Paulo: flat tags
    companyName = getTextByLocalName(base, 'RazaoSocialPrestador') ||
                  getTextByLocalName(base, 'NomeFantasiaPrestador');
  } else if (emitElement) {
    companyName = getTextByLocalName(emitElement, 'xNome') || 
                  getTextByLocalName(emitElement, 'RazaoSocial') ||
                  getTextByLocalName(emitElement, 'NomeFantasia');
  }

  // Company CNPJ - multiple search strategies
  let companyCnpj = '';
  
  if (isNFSeSaoPaulo) {
    // NFSe São Paulo: flat structure <CPFCNPJPrestador><CNPJ>
    companyCnpj = getNestedTextByLocalName(base, 'CPFCNPJPrestador', 'CNPJ') ||
                  getNestedTextByLocalName(base, 'CPFCNPJPrestador', 'CPF');
  } else if (emitElement) {
    // Strategy 1: Direct CNPJ in emitter element (NF-e and some NFSe)
    companyCnpj = getTextByLocalName(emitElement, 'CNPJ') || 
      getNestedTextByLocalName(emitElement, 'CpfCnpj', 'Cnpj') ||
      getNestedTextByLocalName(emitElement, 'IdentificacaoPrestador', 'Cnpj');
  }
  
  // Strategy 2: GISS format - CNPJ in separate <Prestador> element inside <InfDeclaracaoPrestacaoServico>
  // This is common in northeastern Brazilian municipalities (Alagoas, etc.)
  // The structure is: CompNfse > Nfse > InfNfse > DeclaracaoPrestacaoServico > InfDeclaracaoPrestacaoServico > Prestador > CpfCnpj > Cnpj
  if (!companyCnpj && isNFSe && !isNFSeSaoPaulo) {
    // Search in multiple possible locations
    const infDeclaracao = findFirstByLocalName(base, 'InfDeclaracaoPrestacaoServico') ||
                          findFirstByLocalName(xml, 'InfDeclaracaoPrestacaoServico');
    if (infDeclaracao) {
      const prestadorEl = findFirstByLocalName(infDeclaracao, 'Prestador');
      if (prestadorEl) {
        companyCnpj = getNestedTextByLocalName(prestadorEl, 'CpfCnpj', 'Cnpj');
      }
    }
    
    // Also try searching in DeclaracaoPrestacaoServico
    if (!companyCnpj) {
      const declaracao = findFirstByLocalName(xml, 'DeclaracaoPrestacaoServico');
      if (declaracao) {
        const infDecl = findFirstByLocalName(declaracao, 'InfDeclaracaoPrestacaoServico');
        if (infDecl) {
          const prestadorEl = findFirstByLocalName(infDecl, 'Prestador');
          if (prestadorEl) {
            companyCnpj = getNestedTextByLocalName(prestadorEl, 'CpfCnpj', 'Cnpj');
          }
        }
      }
    }
  }
  
  // Clean CNPJ (remove punctuation)
  companyCnpj = companyCnpj.replace(/[.\-\/]/g, '');

  // Company address (city/state)
  let companyCity = '';
  let companyState = '';
  
  if (isNFSeSaoPaulo) {
    // NFSe São Paulo: flat structure in <EnderecoPrestador>
    const enderecoPrestador = findFirstByLocalName(base, 'EnderecoPrestador');
    if (enderecoPrestador) {
      companyCity = getTextByLocalName(enderecoPrestador, 'Cidade') ||
                    getTextByLocalName(enderecoPrestador, 'xMun');
      companyState = getTextByLocalName(enderecoPrestador, 'UF');
    }
  } else {
    const emitEndereco = emitElement 
      ? findFirstByLocalName(emitElement, 'enderEmit') || 
        findFirstByLocalName(emitElement, 'Endereco') ||
        findFirstByLocalName(emitElement, 'end') ||
        emitElement
      : null;
    companyCity = emitEndereco 
      ? getTextByLocalName(emitEndereco, 'xMun') || 
        getTextByLocalName(emitEndereco, 'Municipio') ||
        getTextByLocalName(emitEndereco, 'cMun')
      : '';
    companyState = emitEndereco 
      ? getTextByLocalName(emitEndereco, 'UF') || 
        getTextByLocalName(emitEndereco, 'Uf')
      : '';
  }

  // Hospital / Recipient
  let hospitalName = '';
  if (isNFSeSaoPaulo) {
    // NFSe São Paulo: flat structure
    hospitalName = getTextByLocalName(base, 'RazaoSocialTomador') ||
                   getTextByLocalName(base, 'NomeFantasiaTomador');
  } else if (destElement) {
    hospitalName = getTextByLocalName(destElement, 'xNome') || 
                   getTextByLocalName(destElement, 'RazaoSocial') ||
                   getTextByLocalName(destElement, 'NomeFantasia');
  }

  // Hospital CNPJ - normalize by removing punctuation
  let rawHospitalCnpj = '';
  if (isNFSeSaoPaulo) {
    // NFSe São Paulo: flat structure <CPFCNPJTomador><CNPJ>
    rawHospitalCnpj = getNestedTextByLocalName(base, 'CPFCNPJTomador', 'CNPJ') ||
                      getNestedTextByLocalName(base, 'CPFCNPJTomador', 'CPF');
  } else if (destElement) {
    rawHospitalCnpj = getTextByLocalName(destElement, 'CNPJ') || 
                      getNestedTextByLocalName(destElement, 'CpfCnpj', 'Cnpj') ||
                      getNestedTextByLocalName(destElement, 'IdentificacaoTomador', 'Cnpj') ||
                      // ABRASF: nested in IdentificacaoTomador > CpfCnpj > Cnpj
                      (() => {
                        const idTomador = findFirstByLocalName(destElement, 'IdentificacaoTomador');
                        if (idTomador) {
                          return getNestedTextByLocalName(idTomador, 'CpfCnpj', 'Cnpj');
                        }
                        return '';
                      })();
  }
  // Remove punctuation from CNPJ
  const hospitalCnpj = rawHospitalCnpj.replace(/[.\-\/]/g, '');

  // Hospital address (city/state)
  let hospitalCity = '';
  let hospitalState = '';
  
  if (isNFSeSaoPaulo) {
    // NFSe São Paulo: flat structure in <EnderecoTomador>
    const enderecoTomador = findFirstByLocalName(base, 'EnderecoTomador');
    if (enderecoTomador) {
      hospitalCity = getTextByLocalName(enderecoTomador, 'Cidade') ||
                     getTextByLocalName(enderecoTomador, 'xMun');
      hospitalState = getTextByLocalName(enderecoTomador, 'UF');
    }
  } else {
    const destEndereco = destElement 
      ? findFirstByLocalName(destElement, 'enderDest') || 
        findFirstByLocalName(destElement, 'Endereco') ||
        findFirstByLocalName(destElement, 'end') ||
        destElement
      : null;
    hospitalCity = destEndereco 
      ? getTextByLocalName(destEndereco, 'xMun') || 
        getTextByLocalName(destEndereco, 'Municipio') ||
        getTextByLocalName(destEndereco, 'cMun')
      : '';
    hospitalState = destEndereco 
      ? getTextByLocalName(destEndereco, 'UF') || 
        getTextByLocalName(destEndereco, 'Uf')
      : '';
  }

  // Invoice number
  let invoiceNumber = '';
  if (isNFSeSaoPaulo) {
    // NFSe São Paulo: <NumeroNFe> inside <ChaveNFe> or directly in <NFe>
    invoiceNumber = getNestedTextByLocalName(base, 'ChaveNFe', 'NumeroNFe') ||
                    getTextByLocalName(base, 'NumeroNFe') ||
                    getTextByLocalName(base, 'Numero');
  } else if (isNFSeNacional) {
    invoiceNumber = getTextByLocalName(base, 'nNFSe') ||
                    getTextByLocalName(base, 'nDFSe');
  } else if (isNFSe) {
    invoiceNumber = getTextByLocalName(base, 'Numero') ||
                    getTextByLocalName(base, 'nNFSe') ||
                    getTextByLocalName(base, 'nDFSe') ||
                    getTextByLocalName(base, 'nDPS');
  } else {
    invoiceNumber = getNestedTextByLocalName(base, 'ide', 'nNF') ||
                    getTextByLocalName(base, 'nNF');
  }

  // Issue date
  let dhEmi = '';
  if (isNFSeSaoPaulo) {
    // NFSe São Paulo: <DataEmissaoNFe> or <DataEmissaoRPS>
    dhEmi = getTextByLocalName(base, 'DataEmissaoNFe') ||
            getTextByLocalName(base, 'DataEmissaoRPS') ||
            getTextByLocalName(base, 'DataEmissao');
  } else if (isNFSeNacional) {
    dhEmi = getTextByLocalName(base, 'dhProc') ||
            getNestedTextByLocalName(base, 'infDPS', 'dhEmi') ||
            getTextByLocalName(base, 'dCompet');
  } else if (isNFSe) {
    dhEmi = getTextByLocalName(base, 'DataEmissao') ||
            getNestedTextByLocalName(base, 'infDPS', 'dhEmi') ||
            getTextByLocalName(base, 'dhEmi') ||
            getTextByLocalName(base, 'dhProc');
  } else {
    dhEmi = getNestedTextByLocalName(base, 'ide', 'dhEmi') ||
            getNestedTextByLocalName(base, 'ide', 'dEmi') ||
            getTextByLocalName(base, 'dhEmi');
  }
  
  // Parse issue date - handle both ISO (2026-01-14) and Brazilian (14/01/2026) formats
  const parseIssueDate = (dateStr: string): string => {
    if (!dateStr) return '';
    // Remove time portion if present (handles "14/01/2026 10:35:08" or "2026-01-14T10:35:08")
    const datePart = dateStr.split(/[T\s]/)[0];
    // Check if it's in Brazilian format (dd/mm/yyyy)
    if (datePart.includes('/')) {
      const parts = datePart.split('/');
      if (parts.length === 3 && parts[0].length <= 2) {
        // Convert dd/mm/yyyy to yyyy-mm-dd
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return datePart;
  };
  
  const issueDate = parseIssueDate(dhEmi);
  const expectedReceiptDate = getLastDayOfMonth(issueDate);

  // Initialize values
  let grossValue = 0;
  let netValueFromXml = 0;
  let issValue = 0;
  let issPercentage = 0;
  let irrfValue = 0;
  let inssValue = 0;
  let csllValue = 0;
  let pisValue = 0;
  let cofinsValue = 0;
  let totalDeductions = 0;

  if (isNFSeSaoPaulo) {
    // NFSe São Paulo (Prefeitura SP) format
    // Estrutura flat com tags diretas: ValorServicos, ValorPIS, ValorCOFINS, etc.
    
    grossValue = parseValue(getTextByLocalName(base, 'ValorServicos'));
    
    // Impostos federais - tags diretas
    pisValue = parseValue(getTextByLocalName(base, 'ValorPIS'));
    cofinsValue = parseValue(getTextByLocalName(base, 'ValorCOFINS'));
    irrfValue = parseValue(getTextByLocalName(base, 'ValorIR'));
    csllValue = parseValue(getTextByLocalName(base, 'ValorCSLL'));
    inssValue = parseValue(getTextByLocalName(base, 'ValorINSS'));
    
    // ISS
    issValue = parseValue(getTextByLocalName(base, 'ValorISS'));
    issPercentage = parseValue(getTextByLocalName(base, 'AliquotaServicos'));
    
    // ISS Retention - São Paulo uses explicit boolean <ISSRetido>true/false</ISSRetido>
    const issRetidoStr = getTextByLocalName(base, 'ISSRetido')?.toLowerCase();
    if (issRetidoStr === 'true' || issRetidoStr === '1') {
      (base as any).__explicitIssRetido = true;
      (base as any).__explicitIssNaoRetido = false;
    } else if (issRetidoStr === 'false' || issRetidoStr === '0') {
      (base as any).__explicitIssNaoRetido = true;
      (base as any).__explicitIssRetido = false;
    }
    
    // Calcula deduções totais
    totalDeductions = pisValue + cofinsValue + irrfValue + csllValue + inssValue;
    
    // Valor líquido - São Paulo não tem campo específico, calculamos
    netValueFromXml = grossValue - totalDeductions;
    if ((base as any).__explicitIssRetido) {
      netValueFromXml -= issValue;
    }
    
    console.log('NFSe São Paulo - Valores extraídos:', {
      grossValue,
      issValue,
      issPercentage,
      pisValue,
      cofinsValue,
      irrfValue,
      csllValue,
      inssValue,
      totalDeductions,
      netValueFromXml,
      issRetido: (base as any).__explicitIssRetido
    });
    
  } else if (isNFSeNacional) {
    // NFSe Nacional (SPED) format
    // Suporta múltiplas variantes municipais:
    // - Formato completo: <valores> com vBC, pAliqAplic, vISSQN, vTotalRet, vLiq
    // - Formato Salvador/BA: <valores><vLiq> no infNFSe e <vServPrest><vServ> no DPS
    // - tribMun com tribISSQN e tpRetISSQN para status de retenção
    // - totTrib com vTotTribFed, vTotTribEst, vTotTribMun para totais tributários
    
    let vTotalRetFromXml = 0;
    
    // IMPORTANTE: buscar o DPS relacionado ao mesmo bloco base ANTES de processar valores
    const dpsElement =
      findFirstByLocalName(base, 'DPS') ||
      findFirstByLocalName(base, 'infDPS') ||
      findFirstByLocalName(xml, 'DPS') ||
      findFirstByLocalName(xml, 'infDPS');
    
    const valoresElements = findAllByLocalName(base, 'valores');
    
    // First valores element - main values (infNFSe level)
    if (valoresElements.length > 0) {
      const mainValores = valoresElements[0];
      grossValue = parseValue(getTextByLocalName(mainValores, 'vBC')) ||
                   parseValue(getTextByLocalName(mainValores, 'vServ'));
      netValueFromXml = parseValue(getTextByLocalName(mainValores, 'vLiq'));
      
      issValue = parseValue(getTextByLocalName(mainValores, 'vISSQN'));
      issPercentage = parseValue(getTextByLocalName(mainValores, 'pAliqAplic'));
      
      // vTotalRet contém APENAS impostos FEDERAIS retidos (PIS, COFINS, IRRF, CSLL, INSS)
      vTotalRetFromXml = parseValue(getTextByLocalName(mainValores, 'vTotalRet'));
    }
    
    // Processar DPS para valores e impostos
    if (dpsElement) {
      // Buscar valores dentro do DPS
      const dpsValores = findFirstByLocalName(dpsElement, 'valores');
      
      // Obter valor bruto do serviço se não encontrado anteriormente
      // Formato Salvador/BA: <valores><vServPrest><vServ>
      if (dpsValores) {
        if (grossValue === 0) {
          grossValue = parseValue(getNestedTextByLocalName(dpsValores, 'vServPrest', 'vServ'));
        }
        
        // Se ainda não temos valor bruto, tentar diretamente
        if (grossValue === 0) {
          const vServPrest = findFirstByLocalName(dpsValores, 'vServPrest');
          if (vServPrest) {
            grossValue = parseValue(getTextByLocalName(vServPrest, 'vServ'));
          }
        }
      }
      
      // Buscar impostos federais em tribFed
      const tribFed = findFirstByLocalName(dpsElement, 'tribFed');
      if (tribFed) {
        // PIS and COFINS are inside piscofins
        const piscofins = findFirstByLocalName(tribFed, 'piscofins');
        if (piscofins) {
          pisValue = parseValue(getTextByLocalName(piscofins, 'vPis'));
          cofinsValue = parseValue(getTextByLocalName(piscofins, 'vCofins'));
        }
        
        // IRRF and CSLL are directly in tribFed
        irrfValue = parseValue(getTextByLocalName(tribFed, 'vRetIRRF')) ||
                    parseValue(getTextByLocalName(tribFed, 'vIRRF'));
        csllValue = parseValue(getTextByLocalName(tribFed, 'vRetCSLL')) ||
                    parseValue(getTextByLocalName(tribFed, 'vCSLL'));
        
        // INSS might be in tribFed or separate element
        inssValue = parseValue(getTextByLocalName(tribFed, 'vRetINSS')) ||
                    parseValue(getTextByLocalName(tribFed, 'vINSS')) ||
                    parseValue(getTextByLocalName(tribFed, 'vRetCP'));
      }
      
      // Buscar tribMun para ISS e status de retenção
      // Formato Salvador/BA: <trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun>
      const tribElement = findFirstByLocalName(dpsValores || dpsElement, 'trib');
      let tribMun = tribElement 
        ? findFirstByLocalName(tribElement, 'tribMun')
        : findFirstByLocalName(dpsValores || dpsElement, 'tribMun');
      
      if (!tribMun && dpsElement) {
        tribMun = findFirstByLocalName(dpsElement, 'tribMun');
      }
      if (!tribMun) {
        tribMun = findFirstByLocalName(base, 'tribMun');
      }
      
      if (tribMun) {
        // tribISSQN: 1 = Exigível, 2 = Não incidência, etc.
        // tpRetISSQN: 1 = Não retido (ISS devido pelo prestador), 2 = Retido pelo tomador
        const tribISSQN = getTextByLocalName(tribMun, 'tribISSQN');
        const tpRetISSQN = getTextByLocalName(tribMun, 'tpRetISSQN');
        
        console.log('NFSe Nacional - tribMun encontrado:', { tribISSQN, tpRetISSQN });
        
        // 1 = NÃO retido, 2 = Retido
        if (tpRetISSQN === '1') {
          (base as any).__explicitIssNaoRetido = true;
          (base as any).__explicitIssRetido = false;
        } else if (tpRetISSQN === '2') {
          (base as any).__explicitIssRetido = true;
          (base as any).__explicitIssNaoRetido = false;
        }
      } else {
        console.log('NFSe Nacional - tribMun NÃO encontrado');
      }
      
      // Buscar totTrib para valores totais de tributos (Formato Salvador/BA)
      // <totTrib><vTotTrib><vTotTribFed>0.00</vTotTribFed><vTotTribMun>0.00</vTotTribMun>
      const totTrib = findFirstByLocalName(tribElement || dpsValores || dpsElement, 'totTrib');
      if (totTrib) {
        const vTotTrib = findFirstByLocalName(totTrib, 'vTotTrib');
        if (vTotTrib) {
          const vTotTribFed = parseValue(getTextByLocalName(vTotTrib, 'vTotTribFed'));
          const vTotTribMun = parseValue(getTextByLocalName(vTotTrib, 'vTotTribMun'));
          
          console.log('NFSe Nacional - totTrib encontrado:', { vTotTribFed, vTotTribMun });
          
          // Se não temos impostos federais individuais mas temos o total, usar como fallback
          if (pisValue === 0 && cofinsValue === 0 && irrfValue === 0 && csllValue === 0 && inssValue === 0) {
            if (vTotalRetFromXml === 0 && vTotTribFed > 0) {
              vTotalRetFromXml = vTotTribFed;
            }
          }
          
          // Se não temos ISS mas temos tributo municipal, pode ser ISS
          if (issValue === 0 && vTotTribMun > 0) {
            // Nota: vTotTribMun pode não ser ISS retido, apenas o valor do ISS devido
            // Não sobrescrever issValue automaticamente
            console.log('NFSe Nacional - vTotTribMun disponível (pode ser ISS devido):', vTotTribMun);
          }
        }
      }
    }
    
    // Calcular totalDeductions: SEMPRE preferir a soma dos impostos individuais quando disponíveis
    const sumOfFederalTaxes = pisValue + cofinsValue + irrfValue + csllValue + inssValue;
    
    // Se temos impostos individuais detalhados, usar a soma deles
    // Caso contrário, usar vTotalRet como fallback
    if (sumOfFederalTaxes > 0) {
      totalDeductions = sumOfFederalTaxes;
    } else {
      totalDeductions = vTotalRetFromXml;
    }
  } else if (isNFSe) {
    // ABRASF format - search in multiple Valores elements
    
    // 1. Buscar ValoresNfse primeiro para o líquido
    const valoresNfse = findFirstByLocalName(base, 'ValoresNfse');
    if (valoresNfse) {
      netValueFromXml = getValueFromTags(valoresNfse, ['ValorLiquidoNfse', 'ValorLiquido']);
      // ISS também pode estar aqui
      issValue = getValueFromTags(valoresNfse, ['ValorIss']);
    }
    
    // 2. Buscar elemento Servico para impostos detalhados
    const servicoEl = findFirstByLocalName(base, 'Servico');
    const valoresServico = servicoEl 
      ? findFirstByLocalName(servicoEl, 'Valores') 
      : null;
    
    // 3. Buscar primeiro Valores como fallback
    const valoresEl = findFirstByLocalName(base, 'Valores') || 
                      findFirstByLocalName(base, 'valores');
    
    // Combinar busca: primeiro em Servico/Valores, depois em ValoresNfse, depois no Valores genérico
    const searchElements = [valoresServico, valoresNfse, valoresEl].filter(Boolean) as Element[];
    
    // Função helper para buscar em múltiplos elementos
    const getValueFromMultiple = (tagNames: string[]): number => {
      for (const el of searchElements) {
        if (el) {
          const val = getValueFromTags(el, tagNames);
          if (val > 0) return val;
        }
      }
      return 0;
    };
    
    // Bruto
    grossValue = getValueFromMultiple(['ValorServicos', 'BaseCalculo', 'vBC', 'vServ']);
    
    // Líquido (já obtido acima de ValoresNfse)
    if (netValueFromXml === 0) {
      netValueFromXml = getValueFromMultiple(['ValorLiquidoNfse', 'ValorLiquido', 'vLiq']);
    }
    
    // ISS - Suporta padrão Salvador que usa ValorIssRetido ao invés de ValorIss
    if (issValue === 0) {
      issValue = getValueFromMultiple(['ValorIss', 'ValorIssRetido', 'vISSQN']);
    }
    
    // Impostos federais - buscar em todos os elementos
    pisValue = getValueFromMultiple(['ValorPis', 'Pis', 'vPis', 'vRetPIS']);
    cofinsValue = getValueFromMultiple(['ValorCofins', 'Cofins', 'vCofins', 'vRetCOFINS']);
    inssValue = getValueFromMultiple(['ValorInss', 'Inss', 'vInss', 'vRetINSS', 'ValorCp']);
    irrfValue = getValueFromMultiple(['ValorIr', 'Ir', 'vIr', 'vIRRF', 'ValorIrrf', 'vRetIRRF']);
    csllValue = getValueFromMultiple(['ValorCsll', 'Csll', 'vCsll', 'vRetCSLL']);
    
    totalDeductions = pisValue + cofinsValue + inssValue + irrfValue + csllValue;
    
    // Fallback to total if individual not found
    if (totalDeductions === 0) {
      totalDeductions = getValueFromMultiple(['ValorTotalTributos', 'TotalRetencoes', 'vTotalRet']);
    }
    
    const outrasRet = getValueFromMultiple(['OutrasRetencoes', 'OutrasRet']);
    totalDeductions += outrasRet;
    
    // 4. LER O FLAG IssRetido EXPLICITAMENTE (1 = retido, 2 = não retido)
    const issRetidoFlag = servicoEl 
      ? getTextByLocalName(servicoEl, 'IssRetido')
      : getTextByLocalName(base, 'IssRetido');
    
    // Armazenar para uso posterior na detecção
    const explicitIssRetido = issRetidoFlag === '1';
    const explicitIssNaoRetido = issRetidoFlag === '2';
    
    // Store in a way we can access later for ISS retention detection
    (base as any).__explicitIssRetido = explicitIssRetido;
    (base as any).__explicitIssNaoRetido = explicitIssNaoRetido;
    
    issPercentage = grossValue > 0 ? (issValue / grossValue) * 100 : 0;
    
  } else {
    // NF-e tradicional
    grossValue = parseValue(getNestedTextByLocalName(base, 'ICMSTot', 'vNF')) ||
                 parseValue(getNestedTextByLocalName(base, 'ICMSTot', 'vProd')) ||
                 parseValue(getTextByLocalName(base, 'vNF'));
    netValueFromXml = grossValue; // NF-e tradicional não tem líquido separado
    issValue = parseValue(getNestedTextByLocalName(base, 'ISSQNtot', 'vISS')) ||
               parseValue(getTextByLocalName(base, 'vISS'));
    
    pisValue = parseValue(getTextByLocalName(base, 'vRetPIS'));
    cofinsValue = parseValue(getTextByLocalName(base, 'vRetCOFINS'));
    csllValue = parseValue(getTextByLocalName(base, 'vRetCSLL'));
    irrfValue = parseValue(getTextByLocalName(base, 'vIRRF')) || parseValue(getTextByLocalName(base, 'vBCIRRF'));
    inssValue = parseValue(getTextByLocalName(base, 'vRetINSS'));
    
    totalDeductions = pisValue + cofinsValue + csllValue + irrfValue + inssValue;
    issPercentage = grossValue > 0 ? (issValue / grossValue) * 100 : 0;
  }

  // Determine invoice type
  const invoiceType: InvoiceType = isNFSeSaoPaulo
    ? 'NFSE SAO PAULO'
    : isNFSeNacional 
      ? 'NFS NACIONAL (SPED)' 
      : isNFSe 
        ? 'ABRASF' 
        : 'NF-e';

  // If netValueFromXml is 0, fallback to grossValue (no net value in XML)
  if (netValueFromXml === 0) {
    netValueFromXml = grossValue;
  }

  // Detect if ISS was retained
  // PRIORIDADE 1: Flag explícito do XML
  // - ABRASF: IssRetido (1 = retido, 2 = não retido)
  // - NFSe Nacional (SPED): tpRetISSQN (1 = NÃO retido, 2 = retido)
  // PRIORIDADE 2: Validação matemática como fallback
  const explicitIssRetido = (base as any).__explicitIssRetido === true;
  const explicitIssNaoRetido = (base as any).__explicitIssNaoRetido === true;
  
  const netWithoutIss = grossValue - totalDeductions;
  const netWithIss = grossValue - totalDeductions - issValue;

  let isIssRetained = false;
  
  // PRIORIDADE 1: Flag explícito no XML (ABRASF ou NFSe Nacional)
  if (explicitIssRetido) {
    isIssRetained = true;
    console.log('ISS Retention: Flag explícito indica RETIDO');
  } else if (explicitIssNaoRetido) {
    isIssRetained = false;
    console.log('ISS Retention: Flag explícito indica NÃO RETIDO');
  } else if (issValue > 0.01) {
    // PRIORIDADE 2: Validação matemática (fallback quando não há flag)
    const matchesWithIss = Math.abs(netValueFromXml - netWithIss) < 0.01;
    const matchesWithoutIss = Math.abs(netValueFromXml - netWithoutIss) < 0.01;

    console.log('ISS Retention Math Check:', {
      netValueFromXml,
      netWithIss,
      netWithoutIss,
      matchesWithIss,
      matchesWithoutIss
    });

    if (matchesWithIss) {
      isIssRetained = true;
    } else if (matchesWithoutIss) {
      isIssRetained = false;
    } else {
      // Fallback: escolhe o cenário mais próximo do líquido informado
      const diffWithIss = Math.abs(netValueFromXml - netWithIss);
      const diffWithoutIss = Math.abs(netValueFromXml - netWithoutIss);
      isIssRetained = diffWithIss < diffWithoutIss;
      console.log('ISS Retention Fallback:', { diffWithIss, diffWithoutIss, isIssRetained });
    }
  }

  // hasRetention = qualquer retenção efetiva (federais e/ou ISS retido)
  const hasRetention = totalDeductions > 0.01 || isIssRetained;

  // Debug log
  console.log('XML Parse Results:', {
    invoiceType,
    companyName,
    companyCnpj,
    companyCity,
    companyState,
    hospitalName,
    hospitalCnpj,
    hospitalCity,
    hospitalState,
    invoiceNumber,
    issueDate,
    expectedReceiptDate,
    grossValue,
    netValueFromXml,
    hasRetention,
    isIssRetained,
    issValue,
    issPercentage: Math.round(issPercentage * 100) / 100,
    pisValue,
    cofinsValue,
    irrfValue,
    csllValue,
    inssValue,
    totalDeductions,
  });

  if (!companyName && !hospitalName && !invoiceNumber) {
    throw new Error('Não foi possível extrair dados do XML. Verifique se é um arquivo NF-e válido.');
  }

  return {
    invoiceType,
    companyName,
    companyCnpj,
    companyCity,
    companyState,
    hospitalName,
    hospitalCnpj,
    hospitalCity,
    hospitalState,
    issueDate,
    expectedReceiptDate,
    invoiceNumber,
    grossValue,
    netValueFromXml,
    hasRetention,
    isIssRetained,
    totalDeductions,
    issValue,
    issPercentage: Math.round(issPercentage * 100) / 100,
    irrfValue,
    inssValue,
    csllValue,
    pisValue,
    cofinsValue,
  };
}

export function isXMLFile(file: File): boolean {
  return file.type === 'text/xml' || file.type === 'application/xml' || file.name.toLowerCase().endsWith('.xml');
}

export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
