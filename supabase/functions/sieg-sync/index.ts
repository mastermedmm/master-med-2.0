import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SIEG_API_URL = "https://api.sieg.com/BaixarXmls";
const MAX_XMLS_PER_REQUEST = 50;

interface SiegRequest {
  XmlType: number;
  Take: number;
  Skip: number;
  DataEmissaoInicio: string;
  DataEmissaoFim: string;
  CnpjEmit?: string;
  Downloadevent: boolean;
}

interface SyncResult {
  success: boolean;
  logId: string;
  imported: number;
  skipped: number;
  updated: number;
  failed: number;
  totalFound: number;
  errors: string[];
}

// Parse XML string and extract NFS-e data using deno-dom
function parseNFSeXML(xmlContent: string): any {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlContent, "text/xml");

  if (!xml) {
    throw new Error("XML inválido - não foi possível fazer parse");
  }

  // Helper functions
  const getTextByLocalName = (parent: any, localName: string): string => {
    const elements = parent.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const elLocalName = el.localName || el.tagName?.split(':').pop() || '';
      if (elLocalName === localName) {
        return el.textContent?.trim() || "";
      }
    }
    return "";
  };

  const findFirstByLocalName = (parent: any, localName: string): any | null => {
    const elements = parent.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const elLocalName = el.localName || el.tagName?.split(':').pop() || '';
      if (elLocalName === localName) {
        return el;
      }
    }
    return null;
  };

  const parseValue = (value: string): number => {
    if (!value) return 0;
    const normalized = value.includes(",")
      ? value.replace(/\./g, "").replace(",", ".")
      : value;
    const n = parseFloat(normalized);
    return isFinite(n) ? n : 0;
  };

  // Detect format
  const rootName = xml.documentElement?.localName || xml.documentElement?.tagName?.split(':').pop() || "";
  const isNFSeNacional =
    rootName === "NFSe" ||
    !!findFirstByLocalName(xml, "infNFSe") ||
    !!findFirstByLocalName(xml, "DPS");

  // Base element
  const base =
    findFirstByLocalName(xml, "infNFSe") ||
    findFirstByLocalName(xml, "InfNfse") ||
    findFirstByLocalName(xml, "NFSe") ||
    xml;

  // Emitter (company)
  const emitElement =
    findFirstByLocalName(base, "emit") ||
    findFirstByLocalName(base, "prest") ||
    findFirstByLocalName(base, "PrestadorServico");

  const companyName = emitElement
    ? getTextByLocalName(emitElement, "xNome") ||
      getTextByLocalName(emitElement, "RazaoSocial") ||
      getTextByLocalName(emitElement, "NomeFantasia")
    : "";

  let companyCnpj = emitElement
    ? getTextByLocalName(emitElement, "CNPJ") ||
      getTextByLocalName(emitElement, "Cnpj")
    : "";
  companyCnpj = companyCnpj.replace(/\D/g, "");

  const emitEndereco = emitElement
    ? findFirstByLocalName(emitElement, "enderEmit") ||
      findFirstByLocalName(emitElement, "Endereco") ||
      emitElement
    : null;
  const companyCity = emitEndereco
    ? getTextByLocalName(emitEndereco, "xMun") ||
      getTextByLocalName(emitEndereco, "Municipio")
    : "";
  const companyState = emitEndereco
    ? getTextByLocalName(emitEndereco, "UF") ||
      getTextByLocalName(emitEndereco, "Uf")
    : "";

  // Recipient (hospital)
  const destElement =
    findFirstByLocalName(base, "toma") ||
    findFirstByLocalName(base, "Tomador") ||
    findFirstByLocalName(base, "TomadorServico") ||
    findFirstByLocalName(base, "dest");

  const hospitalName = destElement
    ? getTextByLocalName(destElement, "xNome") ||
      getTextByLocalName(destElement, "RazaoSocial")
    : "";

  let hospitalCnpj = destElement
    ? getTextByLocalName(destElement, "CNPJ") ||
      getTextByLocalName(destElement, "Cnpj")
    : "";
  hospitalCnpj = hospitalCnpj.replace(/\D/g, "");

  const destEndereco = destElement
    ? findFirstByLocalName(destElement, "enderDest") ||
      findFirstByLocalName(destElement, "Endereco") ||
      destElement
    : null;
  const hospitalCity = destEndereco
    ? getTextByLocalName(destEndereco, "xMun") ||
      getTextByLocalName(destEndereco, "Municipio")
    : "";
  const hospitalState = destEndereco
    ? getTextByLocalName(destEndereco, "UF") || getTextByLocalName(destEndereco, "Uf")
    : "";

  // Invoice number
  const invoiceNumber =
    getTextByLocalName(base, "Numero") ||
    getTextByLocalName(base, "nNFSe") ||
    getTextByLocalName(base, "nDFSe") ||
    getTextByLocalName(base, "nNF");

  // Issue date
  const dhEmi =
    getTextByLocalName(base, "DataEmissao") ||
    getTextByLocalName(base, "dhEmi") ||
    getTextByLocalName(base, "dhProc") ||
    getTextByLocalName(base, "dCompet");
  const issueDate = dhEmi ? dhEmi.split(/[T\s]/)[0] : "";

  // Calculate expected receipt date (last day of month)
  let expectedReceiptDate = "";
  if (issueDate) {
    const [year, month] = issueDate.split("-").map(Number);
    if (year && month) {
      const lastDay = new Date(year, month, 0);
      expectedReceiptDate = `${lastDay.getFullYear()}-${String(
        lastDay.getMonth() + 1
      ).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
    }
  }

  // Values
  const valoresEl =
    findFirstByLocalName(base, "valores") ||
    findFirstByLocalName(base, "Valores") ||
    findFirstByLocalName(base, "ValoresNfse");

  let grossValue = 0;
  let netValue = 0;
  let issValue = 0;
  let issPercentage = 0;
  let irrfValue = 0;
  let inssValue = 0;
  let csllValue = 0;
  let pisValue = 0;
  let cofinsValue = 0;
  let totalDeductions = 0;
  let isIssRetained = true;

  if (valoresEl) {
    grossValue =
      parseValue(getTextByLocalName(valoresEl, "vBC")) ||
      parseValue(getTextByLocalName(valoresEl, "ValorServicos")) ||
      parseValue(getTextByLocalName(valoresEl, "vServ"));

    netValue =
      parseValue(getTextByLocalName(valoresEl, "vLiq")) ||
      parseValue(getTextByLocalName(valoresEl, "ValorLiquidoNfse")) ||
      parseValue(getTextByLocalName(valoresEl, "ValorLiquido"));

    issValue =
      parseValue(getTextByLocalName(valoresEl, "vISSQN")) ||
      parseValue(getTextByLocalName(valoresEl, "ValorIss"));

    issPercentage =
      parseValue(getTextByLocalName(valoresEl, "pAliqAplic")) ||
      parseValue(getTextByLocalName(valoresEl, "Aliquota"));

    // ISS retention check
    const issRetido = getTextByLocalName(base, "IssRetido");
    const tpRetISSQN = getTextByLocalName(base, "tpRetISSQN");
    if (issRetido === "2" || tpRetISSQN === "1") {
      isIssRetained = false;
    }
  }

  // Federal taxes (from DPS/tribFed)
  const dpsElement =
    findFirstByLocalName(base, "DPS") || findFirstByLocalName(xml, "DPS");
  if (dpsElement) {
    const tribFed = findFirstByLocalName(dpsElement, "tribFed");
    if (tribFed) {
      const piscofins = findFirstByLocalName(tribFed, "piscofins");
      if (piscofins) {
        pisValue = parseValue(getTextByLocalName(piscofins, "vPis"));
        cofinsValue = parseValue(getTextByLocalName(piscofins, "vCofins"));
      }
      irrfValue =
        parseValue(getTextByLocalName(tribFed, "vRetIRRF")) ||
        parseValue(getTextByLocalName(tribFed, "vIRRF"));
      csllValue =
        parseValue(getTextByLocalName(tribFed, "vRetCSLL")) ||
        parseValue(getTextByLocalName(tribFed, "vCSLL"));
      inssValue =
        parseValue(getTextByLocalName(tribFed, "vRetINSS")) ||
        parseValue(getTextByLocalName(tribFed, "vINSS"));
    }
  }

  // Calculate total deductions
  totalDeductions = pisValue + cofinsValue + irrfValue + csllValue + inssValue;

  // If net value not found, calculate it
  if (!netValue && grossValue > 0) {
    netValue = grossValue - totalDeductions - (isIssRetained ? issValue : 0);
  }

  // Determine invoice type
  let invoiceType = "ABRASF";
  if (isNFSeNacional && findFirstByLocalName(xml, "DPS")) {
    invoiceType = "NFS NACIONAL (SPED)";
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
    netValue,
    isIssRetained,
    totalDeductions,
    issValue,
    issPercentage,
    irrfValue,
    inssValue,
    csllValue,
    pisValue,
    cofinsValue,
  };
}

// Generate SHA-256 hash of XML content
async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Robust Base64 decoding with chunked approach for large files
function decodeBase64Safely(base64String: string): string {
  if (!base64String) return "";
  
  // Clean the string
  let cleaned = base64String.trim();
  
  // Remove data URL prefix if present
  if (cleaned.includes(",") && cleaned.startsWith("data:")) {
    cleaned = cleaned.split(",")[1];
  }
  
  // Remove quotes
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  
  // Remove whitespace/newlines
  cleaned = cleaned.replace(/\s/g, "");
  
  // Handle URL-safe Base64 (replace - with + and _ with /)
  cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  
  // Add padding if needed
  const paddingNeeded = (4 - (cleaned.length % 4)) % 4;
  if (paddingNeeded > 0 && paddingNeeded < 4) {
    cleaned += '='.repeat(paddingNeeded);
  }
  
  // Validate base64 format before attempting decode
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error("String Base64 inválida");
  }
  
  // Decode
  try {
    return atob(cleaned);
  } catch (e) {
    throw new Error(`Falha ao decodificar Base64: ${e}`);
  }
}

// Normalize URL - fix common issues like missing slashes
function normalizeUrl(urlString: string): string {
  let url = urlString.trim();
  
  // Fix common typo: https:/ instead of https://
  url = url.replace(/^(https?):\/([^/])/, '$1://$2');
  // Ensure the URL has a protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  return url;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const {
      tenantId,
      cnpjEmit,
      dataEmissaoInicio,
      dataEmissaoFim,
      updateMode = false,
    } = body;

    if (!tenantId || !dataEmissaoInicio || !dataEmissaoFim) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios: tenantId, dataEmissaoInicio, dataEmissaoFim" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SIEG] Starting sync for tenant ${tenantId}`);
    console.log(`[SIEG] Filters: CNPJ=${cnpjEmit || "all"}, Start=${dataEmissaoInicio}, End=${dataEmissaoFim}`);

    // Get API key + optional Web Service URL from system_settings
    const { data: settingsRows, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", ["sieg_api_key", "sieg_webservice_url"]);

    if (settingsError) {
      console.error("[SIEG] Error loading settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Erro ao carregar configurações do SIEG" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings: Record<string, string> = {};
    for (const row of settingsRows || []) {
      if (row?.key && typeof row.value === 'string') settings[row.key] = row.value;
    }

    const rawApiKey = (settings.sieg_api_key || '').trim().replace(/^"+|"+$/g, "");
    if (!rawApiKey) {
      console.error("[SIEG] API key not found");
      return new Response(
        JSON.stringify({ error: "API Key do SIEG não configurada. Configure em Integração SIEG." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const siegApiKey = rawApiKey;
    const rawWebServiceUrl = (settings.sieg_webservice_url || SIEG_API_URL).trim().replace(/^"+|"+$/g, "");
    const webServiceUrl = normalizeUrl(rawWebServiceUrl);

    console.log(`[SIEG] API key loaded (length=${siegApiKey.length})`);
    console.log(`[SIEG] Web service URL (raw): ${rawWebServiceUrl}`);
    console.log(`[SIEG] Web service URL (normalized): ${webServiceUrl}`);

    // Check for running sync
    const { data: runningSync } = await supabase
      .from("sieg_sync_logs")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "running")
      .maybeSingle();

    if (runningSync) {
      return new Response(
        JSON.stringify({ error: "Já existe uma sincronização em andamento" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from("sieg_sync_logs")
      .insert({
        tenant_id: tenantId,
        status: "running",
        filter_cnpj_emit: cnpjEmit || null,
        filter_date_start: dataEmissaoInicio,
        filter_date_end: dataEmissaoFim,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (logError) {
      console.error("[SIEG] Error creating sync log:", logError);
      return new Response(
        JSON.stringify({ error: "Erro ao iniciar sincronização" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const logId = syncLog.id;
    console.log(`[SIEG] Created sync log: ${logId}`);

    // Initialize counters
    let totalFound = 0;
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      // Paginate through SIEG API
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const siegRequest: SiegRequest = {
          XmlType: 3, // NFS-e
          Take: MAX_XMLS_PER_REQUEST,
          Skip: skip,
          DataEmissaoInicio: dataEmissaoInicio,
          DataEmissaoFim: dataEmissaoFim,
          Downloadevent: false,
        };

        if (cnpjEmit) {
          siegRequest.CnpjEmit = cnpjEmit.replace(/\D/g, "");
        }

        console.log(`[SIEG] Fetching batch: skip=${skip}, take=${MAX_XMLS_PER_REQUEST}`);

        // Build URL conforme documentação SIEG: https://api.sieg.com/BaixarXmls?api_key={apikey}
        // A API Key deve ser passada APENAS como query parameter na URL
        const url = new URL(webServiceUrl);
        url.searchParams.set('api_key', siegApiKey);

        const finalUrl = url.toString();
        const safeUrl = (() => {
          const u = new URL(finalUrl);
          u.searchParams.delete('api_key');
          return u.toString();
        })();

        console.log(`[SIEG] Calling URL: ${safeUrl}`);
        console.log(`[SIEG] Request body: ${JSON.stringify(siegRequest)}`);

        let siegResponse: Response | null = null;
        let lastErrorText = '';
        let lastStatus = 0;

        siegResponse = await fetch(finalUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
          },
          body: JSON.stringify(siegRequest),
        });

        if (!siegResponse.ok) {
          lastStatus = siegResponse.status;
          lastErrorText = await siegResponse.text();
          console.error(`[SIEG] API error: ${siegResponse.status} - ${lastErrorText}`);
        }

        if (!siegResponse || !siegResponse.ok) {
          let detail = lastErrorText;
          try {
            const parsed = JSON.parse(lastErrorText);
            detail = parsed?.Message || parsed?.message || lastErrorText;
          } catch {
            // keep raw text
          }

          const safeDetail = String(detail || "").slice(0, 300);
          const hint = lastStatus === 401
            ? ' (API Key inválida/sem permissão no Cofre SIEG ou endpoint incorreto)'
            : '';

          throw new Error(`Erro na API SIEG: ${lastStatus || 0}${safeDetail ? ` - ${safeDetail}` : ""}${hint}`);
        }

        const responseText = await siegResponse.text();
        const contentType = siegResponse.headers.get('content-type') || '';
        
        console.log(`[SIEG] Response content-type: ${contentType}`);
        console.log(`[SIEG] Response length: ${responseText.length} chars`);
        console.log(`[SIEG] Response preview (first 500 chars): ${responseText.slice(0, 500)}`);

        // Empty response means no more data
        if (!responseText || responseText.trim() === "") {
          console.log("[SIEG] Empty response - no more XMLs");
          hasMore = false;
          break;
        }

        // Check if response is HTML (error page) instead of data
        const trimmedResponse = responseText.trim();
        if (trimmedResponse.startsWith('<!doctype') || trimmedResponse.startsWith('<!DOCTYPE') || 
            trimmedResponse.startsWith('<html') || trimmedResponse.startsWith('<HTML')) {
          console.error("[SIEG] Received HTML response instead of data - possible wrong URL or authentication error");
          throw new Error("A API retornou uma página HTML em vez de dados. Verifique se a URL do Web Service está correta e se a API Key é válida.");
        }

        // Try to detect format: JSON array, JSON with Xmls field, or comma-separated base64
        let xmlsBase64: string[] = [];
        
        if (trimmedResponse.startsWith('[')) {
          // JSON array format - each element might be a base64 string or an object with Xml field
          try {
            const jsonArray = JSON.parse(trimmedResponse);
            for (const item of jsonArray) {
              if (typeof item === 'string') {
                xmlsBase64.push(item);
              } else if (item && typeof item === 'object') {
                // Look for common field names
                const xmlField = item.Xml || item.xml || item.XML || item.XmlBase64 || item.xmlBase64 || item.Content || item.content;
                if (xmlField && typeof xmlField === 'string') {
                  xmlsBase64.push(xmlField);
                }
              }
            }
            console.log(`[SIEG] Parsed JSON array with ${xmlsBase64.length} items`);
          } catch (parseError) {
            console.error(`[SIEG] Failed to parse as JSON array: ${parseError}`);
            // Fall back to comma-separated
            xmlsBase64 = trimmedResponse.split(",").filter((x) => x.trim());
          }
        } else if (trimmedResponse.startsWith('{')) {
          // JSON object format - look for Xmls or similar field
          try {
            const jsonObj = JSON.parse(trimmedResponse);
            const xmlsField = jsonObj.Xmls || jsonObj.xmls || jsonObj.XMLs || jsonObj.Data || jsonObj.data || jsonObj.Items || jsonObj.items;
            if (Array.isArray(xmlsField)) {
              for (const item of xmlsField) {
                if (typeof item === 'string') {
                  xmlsBase64.push(item);
                } else if (item && typeof item === 'object') {
                  const xmlField = item.Xml || item.xml || item.XML || item.XmlBase64 || item.xmlBase64 || item.Content || item.content;
                  if (xmlField && typeof xmlField === 'string') {
                    xmlsBase64.push(xmlField);
                  }
                }
              }
            } else if (typeof xmlsField === 'string') {
              // Maybe single XML or comma-separated
              xmlsBase64 = xmlsField.split(",").filter((x) => x.trim());
            }
            console.log(`[SIEG] Parsed JSON object with ${xmlsBase64.length} XMLs`);
          } catch (parseError) {
            console.error(`[SIEG] Failed to parse as JSON object: ${parseError}`);
            xmlsBase64 = trimmedResponse.split(",").filter((x) => x.trim());
          }
        } else {
          // Assume comma-separated base64 strings
          xmlsBase64 = trimmedResponse.split(",").filter((x) => x.trim());
          console.log(`[SIEG] Parsed comma-separated format with ${xmlsBase64.length} items`);
        }

        console.log(`[SIEG] Received ${xmlsBase64.length} XMLs in this batch`);

        if (xmlsBase64.length === 0) {
          hasMore = false;
          break;
        }

        totalFound += xmlsBase64.length;

        // Process each XML
        for (const base64Raw of xmlsBase64) {
          try {
            // Clean and decode Base64
            const base64 = base64Raw.trim();
            
            // Try to decode - if it starts with < it's already XML
            let xmlContent: string;
            if (base64.startsWith('<') || base64.startsWith('<?xml')) {
              xmlContent = base64;
              console.log(`[SIEG] XML is already decoded (not base64)`);
            } else {
              try {
                xmlContent = decodeBase64Safely(base64);
                console.log(`[SIEG] Decoded base64 successfully, length: ${xmlContent.length}`);
              } catch (decodeError: any) {
                console.error(`[SIEG] Failed to decode base64: ${decodeError.message}`);
                throw new Error(`Falha ao decodificar XML: ${decodeError.message}`);
              }
            }
            
            // Validate that the decoded content looks like XML
            if (!xmlContent.includes('<') || !xmlContent.includes('>')) {
              console.error(`[SIEG] Decoded content doesn't look like XML: ${xmlContent.slice(0, 100)}`);
              throw new Error("Conteúdo decodificado não parece ser XML válido");
            }
            
            // Generate hash for duplicate detection
            const hash = await generateHash(xmlContent);

            // Check for duplicate
            const { data: existingInvoice } = await supabase
              .from("invoices")
              .select("id, tenant_id")
              .eq("pdf_hash", hash)
              .maybeSingle();

            if (existingInvoice) {
              if (existingInvoice.tenant_id === tenantId && updateMode) {
                // Update existing invoice (future feature)
                updated++;
                console.log(`[SIEG] Invoice ${existingInvoice.id} already exists - would update`);
              } else {
                skipped++;
                console.log(`[SIEG] Invoice with hash ${hash.slice(0, 8)}... already exists - skipping`);
              }
              continue;
            }

            // Parse XML
            const nfseData = parseNFSeXML(xmlContent);
            console.log(`[SIEG] Parsed invoice: ${nfseData.invoiceNumber} from ${nfseData.companyName}`);

            // Find or create issuer
            let issuerId: string | null = null;
            if (nfseData.companyCnpj) {
              const { data: existingIssuer } = await supabase
                .from("issuers")
                .select("id")
                .eq("cnpj", nfseData.companyCnpj)
                .eq("tenant_id", tenantId)
                .maybeSingle();

              if (existingIssuer) {
                issuerId = existingIssuer.id;
              } else {
                const { data: newIssuer, error: issuerError } = await supabase
                  .from("issuers")
                  .insert({
                    tenant_id: tenantId,
                    name: nfseData.companyName || "Emitente",
                    cnpj: nfseData.companyCnpj,
                    city: nfseData.companyCity || "",
                    state: nfseData.companyState || "",
                    iss_rate: nfseData.issPercentage || 0,
                  })
                  .select("id")
                  .single();

                if (!issuerError && newIssuer) {
                  issuerId = newIssuer.id;
                  console.log(`[SIEG] Created issuer: ${nfseData.companyName}`);
                }
              }
            }

            // Find or create hospital
            let hospitalId: string | null = null;
            if (nfseData.hospitalName) {
              // Try by CNPJ first
              if (nfseData.hospitalCnpj) {
                const { data: byDoc } = await supabase
                  .from("hospitals")
                  .select("id")
                  .eq("document", nfseData.hospitalCnpj)
                  .eq("tenant_id", tenantId)
                  .maybeSingle();

                if (byDoc) hospitalId = byDoc.id;
              }

              // Then by name
              if (!hospitalId) {
                const { data: byName } = await supabase
                  .from("hospitals")
                  .select("id")
                  .eq("name", nfseData.hospitalName)
                  .eq("tenant_id", tenantId)
                  .maybeSingle();

                if (byName) hospitalId = byName.id;
              }

              // Create new
              if (!hospitalId) {
                const { data: newHospital, error: hospError } = await supabase
                  .from("hospitals")
                  .insert({
                    tenant_id: tenantId,
                    name: nfseData.hospitalName,
                    document: nfseData.hospitalCnpj || null,
                  })
                  .select("id")
                  .single();

                if (!hospError && newHospital) {
                  hospitalId = newHospital.id;
                  console.log(`[SIEG] Created hospital: ${nfseData.hospitalName}`);
                }
              }
            }

            // Insert invoice
            const { error: invoiceError } = await supabase.from("invoices").insert({
              tenant_id: tenantId,
              pdf_hash: hash,
              invoice_type: nfseData.invoiceType,
              company_name: nfseData.companyName,
              issuer_id: issuerId,
              hospital_id: hospitalId,
              hospital_name: nfseData.hospitalName,
              issue_date: nfseData.issueDate,
              invoice_number: nfseData.invoiceNumber,
              gross_value: nfseData.grossValue,
              net_value: nfseData.netValue,
              total_deductions: nfseData.totalDeductions,
              iss_value: nfseData.issValue,
              iss_percentage: nfseData.issPercentage,
              irrf_value: nfseData.irrfValue,
              inss_value: nfseData.inssValue,
              csll_value: nfseData.csllValue,
              pis_value: nfseData.pisValue,
              cofins_value: nfseData.cofinsValue,
              is_iss_retained: nfseData.isIssRetained,
              expected_receipt_date: nfseData.expectedReceiptDate,
              created_by: user.id,
            });

            if (invoiceError) {
              console.error(`[SIEG] Error inserting invoice:`, invoiceError);
              errors.push(`NF ${nfseData.invoiceNumber}: ${invoiceError.message}`);
              failed++;
            } else {
              imported++;
              console.log(`[SIEG] Imported invoice: ${nfseData.invoiceNumber}`);
            }
          } catch (xmlError: any) {
            console.error(`[SIEG] Error processing XML:`, xmlError);
            errors.push(xmlError.message || "Erro ao processar XML");
            failed++;
          }
        }

        // Check if we got less than requested (means no more data)
        if (xmlsBase64.length < MAX_XMLS_PER_REQUEST) {
          hasMore = false;
        } else {
          skip += MAX_XMLS_PER_REQUEST;
        }

        // Rate limiting: small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Update sync log with success
      await supabase
        .from("sieg_sync_logs")
        .update({
          status: "completed",
          sync_completed_at: new Date().toISOString(),
          total_xmls_found: totalFound,
          xmls_imported: imported,
          xmls_skipped: skipped,
          xmls_updated: updated,
          xmls_failed: failed,
          error_details: errors.length > 0 ? { errors } : null,
        })
        .eq("id", logId);

      // Update last sync timestamp
      await supabase
        .from("system_settings")
        .upsert({
          tenant_id: tenantId,
          key: "sieg_last_sync",
          value: new Date().toISOString(),
        }, { onConflict: "tenant_id,key" });

      console.log(`[SIEG] Sync completed: imported=${imported}, skipped=${skipped}, failed=${failed}`);

      const result: SyncResult = {
        success: true,
        logId,
        imported,
        skipped,
        updated,
        failed,
        totalFound,
        errors,
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (syncError: any) {
      console.error("[SIEG] Sync error:", syncError);

      // Update sync log with failure
      await supabase
        .from("sieg_sync_logs")
        .update({
          status: "failed",
          sync_completed_at: new Date().toISOString(),
          error_message: syncError.message,
          total_xmls_found: totalFound,
          xmls_imported: imported,
          xmls_skipped: skipped,
          xmls_failed: failed,
        })
        .eq("id", logId);

      return new Response(
        JSON.stringify({
          success: false,
          logId,
          error: syncError.message,
          imported,
          skipped,
          failed,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("[SIEG] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
