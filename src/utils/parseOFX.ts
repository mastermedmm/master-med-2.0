/**
 * OFX Parser for Brazilian bank statements
 * Supports OFX/OFC format commonly used by Brazilian banks
 */

export interface OFXTransaction {
  id: string;           // FITID - unique transaction ID
  date: Date;           // DTPOSTED - transaction date
  amount: number;       // TRNAMT - transaction amount (positive=credit, negative=debit)
  type: 'credit' | 'debit';
  description: string;  // MEMO or NAME - transaction description
  rawType: string;      // TRNTYPE - original transaction type
  checkNum?: string;    // CHECKNUM - check number if applicable
}

export interface OFXAccountInfo {
  bankId?: string;      // BANKID
  branchId?: string;    // BRANCHID
  accountId?: string;   // ACCTID
  accountType?: string; // ACCTTYPE
}

export interface OFXData {
  account: OFXAccountInfo;
  transactions: OFXTransaction[];
  startDate?: Date;
  endDate?: Date;
  currency?: string;
  balance?: number;
  balanceDate?: Date;
}

/**
 * Parse OFX date format (YYYYMMDD or YYYYMMDDHHMMSS)
 */
function parseOFXDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // Remove timezone info if present (e.g., [-03:EST])
  const cleanDate = dateStr.replace(/\[.*\]/, '').trim();
  
  // Parse YYYYMMDDHHMMSS or YYYYMMDD format
  const year = parseInt(cleanDate.substring(0, 4), 10);
  const month = parseInt(cleanDate.substring(4, 6), 10) - 1; // JS months are 0-indexed
  const day = parseInt(cleanDate.substring(6, 8), 10);
  
  let hours = 0, minutes = 0, seconds = 0;
  if (cleanDate.length >= 14) {
    hours = parseInt(cleanDate.substring(8, 10), 10);
    minutes = parseInt(cleanDate.substring(10, 12), 10);
    seconds = parseInt(cleanDate.substring(12, 14), 10);
  }
  
  return new Date(year, month, day, hours, minutes, seconds);
}

/**
 * Extract value from OFX tag
 */
function extractTag(content: string, tagName: string): string | null {
  // Try self-closing style first: <TAG>value
  const simplePattern = new RegExp(`<${tagName}>([^<\\n]+)`, 'i');
  const simpleMatch = content.match(simplePattern);
  if (simpleMatch) {
    return simpleMatch[1].trim();
  }
  
  // Try XML-style: <TAG>value</TAG>
  const xmlPattern = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i');
  const xmlMatch = content.match(xmlPattern);
  if (xmlMatch) {
    return xmlMatch[1].trim();
  }
  
  return null;
}

/**
 * Extract all transactions from OFX content
 */
function extractTransactions(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];
  
  // Find all STMTTRN blocks
  const transactionPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>|<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/STMTTRNRS>)/gi;
  
  let match;
  while ((match = transactionPattern.exec(content)) !== null) {
    const transBlock = match[1] || match[2];
    if (!transBlock) continue;
    
    const fitid = extractTag(transBlock, 'FITID');
    const trntype = extractTag(transBlock, 'TRNTYPE');
    const dtposted = extractTag(transBlock, 'DTPOSTED');
    const trnamt = extractTag(transBlock, 'TRNAMT');
    const memo = extractTag(transBlock, 'MEMO');
    const name = extractTag(transBlock, 'NAME');
    const checknum = extractTag(transBlock, 'CHECKNUM');
    
    if (!fitid || !trnamt) continue;
    
    const amount = parseFloat(trnamt.replace(',', '.'));
    const description = memo || name || trntype || 'Sem descrição';
    
    transactions.push({
      id: fitid,
      date: parseOFXDate(dtposted || ''),
      amount: Math.abs(amount),
      type: amount >= 0 ? 'credit' : 'debit',
      description: description.trim(),
      rawType: trntype || 'OTHER',
      checkNum: checknum || undefined,
    });
  }
  
  return transactions;
}

/**
 * Extract account information from OFX content
 */
function extractAccountInfo(content: string): OFXAccountInfo {
  // Look for BANKACCTFROM or CCACCTFROM sections
  const bankAcctPattern = /<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>|<BANKACCTFROM>([\s\S]*?)(?=<BANKTRANLIST>)/i;
  const ccAcctPattern = /<CCACCTFROM>([\s\S]*?)<\/CCACCTFROM>|<CCACCTFROM>([\s\S]*?)(?=<BANKTRANLIST>)/i;
  
  const bankMatch = content.match(bankAcctPattern);
  const ccMatch = content.match(ccAcctPattern);
  const acctBlock = bankMatch?.[1] || bankMatch?.[2] || ccMatch?.[1] || ccMatch?.[2] || content;
  
  return {
    bankId: extractTag(acctBlock, 'BANKID') || undefined,
    branchId: extractTag(acctBlock, 'BRANCHID') || undefined,
    accountId: extractTag(acctBlock, 'ACCTID') || undefined,
    accountType: extractTag(acctBlock, 'ACCTTYPE') || undefined,
  };
}

/**
 * Extract balance information
 */
function extractBalance(content: string): { balance?: number; balanceDate?: Date } {
  const ledgerBal = extractTag(content, 'BALAMT');
  const balDate = extractTag(content, 'DTASOF');
  
  return {
    balance: ledgerBal ? parseFloat(ledgerBal.replace(',', '.')) : undefined,
    balanceDate: balDate ? parseOFXDate(balDate) : undefined,
  };
}

/**
 * Extract statement date range
 */
function extractDateRange(content: string): { startDate?: Date; endDate?: Date } {
  const dtstart = extractTag(content, 'DTSTART');
  const dtend = extractTag(content, 'DTEND');
  
  return {
    startDate: dtstart ? parseOFXDate(dtstart) : undefined,
    endDate: dtend ? parseOFXDate(dtend) : undefined,
  };
}

/**
 * Main parser function
 */
export function parseOFX(content: string): OFXData {
  // Normalize line endings and clean up content
  const normalizedContent = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  
  const account = extractAccountInfo(normalizedContent);
  const transactions = extractTransactions(normalizedContent);
  const { startDate, endDate } = extractDateRange(normalizedContent);
  const { balance, balanceDate } = extractBalance(normalizedContent);
  const currency = extractTag(normalizedContent, 'CURDEF') || 'BRL';
  
  // Sort transactions by date (newest first)
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  
  return {
    account,
    transactions,
    startDate,
    endDate,
    currency,
    balance,
    balanceDate,
  };
}

/**
 * Validate if content is a valid OFX file
 */
export function isValidOFX(content: string): boolean {
  // Check for OFX signature tags
  const hasOFXHeader = content.includes('OFXHEADER') || 
                       content.includes('<OFX>') || 
                       content.includes('<OFX ');
  const hasTransactions = content.includes('STMTTRN') || 
                          content.includes('BANKTRANLIST');
  
  return hasOFXHeader || hasTransactions;
}

/**
 * Generate SHA-256 hash of file content for duplicate detection
 */
export async function generateFileHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
