/**
 * Parse Brazilian NF-e (Nota Fiscal Eletrônica) XML files
 * Extracts invoice data directly without AI
 */

export interface NFeData {
  companyName: string;
  hospitalName: string;
  issueDate: string;
  invoiceNumber: string;
  grossValue: number;
  totalDeductions: number;
  issValue: number;
}

/**
 * Parse an NF-e XML file and extract invoice data
 */
export async function parseNFeXML(file: File): Promise<NFeData> {
  const text = await file.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');

  // Check for parsing errors
  const parseError = xml.querySelector('parsererror');
  if (parseError) {
    throw new Error('Arquivo XML inválido');
  }

  // Helper to get text content from a tag, searching through namespaces
  const getText = (tagName: string, parent: Element | Document = xml): string => {
    // Try getElementsByTagName first (works with namespaces)
    let el = parent.getElementsByTagName(tagName)[0];
    
    // Try with namespace prefix variations
    if (!el) {
      el = parent.getElementsByTagName(`ns:${tagName}`)[0];
    }
    if (!el) {
      el = parent.getElementsByTagName(`nfe:${tagName}`)[0];
    }
    
    // Try querySelector as fallback
    if (!el && parent instanceof Element) {
      el = parent.querySelector(tagName);
    }
    
    return el?.textContent?.trim() || '';
  };

  // Get nested text (e.g., emit > xNome) - search for child within parent
  const getNestedText = (parentTag: string, childTag: string): string => {
    // Try to find parent with various namespace approaches
    let parent = xml.getElementsByTagName(parentTag)[0];
    if (!parent) {
      parent = xml.getElementsByTagName(`ns:${parentTag}`)[0];
    }
    if (!parent) {
      parent = xml.getElementsByTagName(`nfe:${parentTag}`)[0];
    }
    if (!parent) return '';
    
    // Now get the child element within the parent
    let child = parent.getElementsByTagName(childTag)[0];
    if (!child) {
      child = parent.getElementsByTagName(`ns:${childTag}`)[0];
    }
    if (!child) {
      child = parent.getElementsByTagName(`nfe:${childTag}`)[0];
    }
    
    return child?.textContent?.trim() || '';
  };

  // Parse values
  const parseValue = (value: string): number => {
    if (!value) return 0;
    return parseFloat(value.replace(',', '.')) || 0;
  };

  // Extract emitter (company) name - try multiple paths
  let companyName = getNestedText('emit', 'xNome');
  if (!companyName) {
    companyName = getNestedText('Remetente', 'xNome');
  }
  
  // Extract recipient (hospital) name - try multiple paths
  let hospitalName = getNestedText('dest', 'xNome');
  if (!hospitalName) {
    hospitalName = getNestedText('Destinatario', 'xNome');
  }
  
  // Extract invoice number - try multiple locations
  let invoiceNumber = getNestedText('ide', 'nNF');
  if (!invoiceNumber) {
    invoiceNumber = getText('nNF');
  }
  if (!invoiceNumber) {
    invoiceNumber = getText('NumeroNota');
  }
  
  // Extract issue date (format: 2024-01-15T10:30:00-03:00)
  let dhEmi = getNestedText('ide', 'dhEmi');
  if (!dhEmi) {
    dhEmi = getNestedText('ide', 'dEmi');
  }
  if (!dhEmi) {
    dhEmi = getText('dhEmi') || getText('dEmi');
  }
  const issueDate = dhEmi ? dhEmi.split('T')[0] : '';
  
  // Extract values - try ISSQN (services) first, then ICMS (products)
  let grossValue = 0;
  let issValue = 0;
  
  // Try to find total section
  const findElement = (tagName: string): Element | null => {
    let el = xml.getElementsByTagName(tagName)[0];
    if (!el) el = xml.getElementsByTagName(`ns:${tagName}`)[0];
    if (!el) el = xml.getElementsByTagName(`nfe:${tagName}`)[0];
    return el || null;
  };
  
  // Check for ISSQNtot (service invoices)
  const issqnTot = findElement('ISSQNtot');
  if (issqnTot) {
    const vServ = issqnTot.getElementsByTagName('vServ')[0]?.textContent || 
                  issqnTot.getElementsByTagName('ns:vServ')[0]?.textContent || '';
    const vBC = issqnTot.getElementsByTagName('vBC')[0]?.textContent || 
                issqnTot.getElementsByTagName('ns:vBC')[0]?.textContent || '';
    const vISS = issqnTot.getElementsByTagName('vISS')[0]?.textContent || 
                 issqnTot.getElementsByTagName('ns:vISS')[0]?.textContent || '';
    
    grossValue = parseValue(vServ) || parseValue(vBC);
    issValue = parseValue(vISS);
  }
  
  // If no ISSQN values, try ICMSTot (product invoices)
  if (!grossValue) {
    const icmsTot = findElement('ICMSTot');
    if (icmsTot) {
      const vNF = icmsTot.getElementsByTagName('vNF')[0]?.textContent || 
                  icmsTot.getElementsByTagName('ns:vNF')[0]?.textContent || '';
      const vProd = icmsTot.getElementsByTagName('vProd')[0]?.textContent || 
                    icmsTot.getElementsByTagName('ns:vProd')[0]?.textContent || '';
      grossValue = parseValue(vNF) || parseValue(vProd);
    }
  }
  
  // Fallback to vNF at any level
  if (!grossValue) {
    grossValue = parseValue(getText('vNF'));
  }
  
  // Calculate total deductions from retention tags
  let totalDeductions = 0;
  
  // Common retention fields in NF-e
  const retentionTags = ['vRetPIS', 'vRetCOFINS', 'vRetCSLL', 'vBCIRRF', 'vIRRF', 'vRetINSS'];
  for (const tag of retentionTags) {
    totalDeductions += parseValue(getText(tag));
  }

  // Debug log for troubleshooting
  console.log('XML Parse Results:', {
    companyName,
    hospitalName,
    invoiceNumber,
    issueDate,
    grossValue,
    issValue,
    totalDeductions
  });

  // Validate required fields
  if (!companyName && !hospitalName && !invoiceNumber) {
    throw new Error('Não foi possível extrair dados do XML. Verifique se é um arquivo NF-e válido.');
  }

  return {
    companyName,
    hospitalName,
    issueDate,
    invoiceNumber,
    grossValue,
    totalDeductions,
    issValue,
  };
}

/**
 * Check if a file is an XML file
 */
export function isXMLFile(file: File): boolean {
  return file.type === 'text/xml' || 
         file.type === 'application/xml' || 
         file.name.toLowerCase().endsWith('.xml');
}

/**
 * Check if a file is a PDF file
 */
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || 
         file.name.toLowerCase().endsWith('.pdf');
}
