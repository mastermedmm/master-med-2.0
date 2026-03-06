import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// URLs da API Nacional NFS-e
const NFSE_API_URLS = {
  homologacao: "https://sefin.producaorestrita.nfse.gov.br/SefinNacional",
  producao: "https://sefin.nfse.gov.br/SefinNacional",
};

// ==================== PFX / Certificate Utilities ====================

interface CertificateData {
  privateKeyPem: string;
  certificatePem: string;
  certificateDer: Uint8Array;
  privateKeyForge: forge.pki.rsa.PrivateKey;
  serialNumber: string;
  issuerDN: string;
  subjectDN: string;
  notAfter: Date;
}

function parsePfxCertificate(pfxBase64: string, password: string): CertificateData {
  console.log(`[nfse-emission] Tentando parsear certificado PFX (base64 length: ${pfxBase64.length}, senha length: ${password.length})`);
  const pfxDer = forge.util.decode64(pfxBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  
  // Try with password directly first, then with strict=false
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
  } catch (e1) {
    console.log(`[nfse-emission] Tentativa 1 falhou, tentando com strict=false...`);
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);
    } catch (e2) {
      console.log(`[nfse-emission] Tentativa 2 falhou, tentando sem senha...`);
      try {
        p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, '');
      } catch (e3) {
        throw new Error(`Não foi possível abrir o certificado PFX. Verifique se a senha está correta. Detalhes: ${(e1 as Error).message}`);
      }
    }
  }

  // Extract private key
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (!keyBag || keyBag.length === 0 || !keyBag[0].key) {
    throw new Error("Chave privada não encontrada no certificado PFX");
  }
  const privateKey = keyBag[0].key as forge.pki.rsa.PrivateKey;

  // Extract certificate
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];
  if (!certBag || certBag.length === 0 || !certBag[0].cert) {
    throw new Error("Certificado não encontrado no arquivo PFX");
  }
  const cert = certBag[0].cert;

  const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
  const certificatePem = forge.pki.certificateToPem(cert);

  // Get certificate DER for digest
  const certAsn1 = forge.pki.certificateToAsn1(cert);
  const certDerBytes = forge.asn1.toDer(certAsn1).getBytes();
  const certificateDer = new Uint8Array(certDerBytes.length);
  for (let i = 0; i < certDerBytes.length; i++) {
    certificateDer[i] = certDerBytes.charCodeAt(i);
  }

  // Format issuer/subject DN
  const formatDN = (attrs: forge.pki.CertificateField[]) =>
    attrs.map((a) => `${a.shortName}=${a.value}`).join(", ");

  return {
    privateKeyPem,
    certificatePem,
    certificateDer,
    privateKeyForge: privateKey,
    serialNumber: cert.serialNumber,
    issuerDN: formatDN(cert.issuer.attributes),
    subjectDN: formatDN(cert.subject.attributes),
    notAfter: cert.validity.notAfter,
  };
}

// ==================== XML Canonicalization (C14N) ====================

/**
 * Simplified Exclusive XML Canonicalization (exc-c14n)
 * For NFS-e DPS signing, we canonicalize the infDPS element
 */
function canonicalizeXml(xml: string): string {
  // Remove XML declaration
  let canonical = xml.replace(/<\?xml[^?]*\?>\s*/g, "");
  // Normalize whitespace between tags (but preserve content)
  canonical = canonical.replace(/>\s+</g, "><");
  // Trim
  canonical = canonical.trim();
  return canonical;
}

function extractElement(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, "m");
  const match = xml.match(regex);
  if (!match) throw new Error(`Elemento <${tagName}> não encontrado no XML`);
  return match[0];
}

// ==================== XMLDSig Signature ====================

async function signXmlDps(
  xml: string,
  certData: CertificateData
): Promise<string> {
  // 1. Extract the infDPS element to sign
  const infDpsContent = extractElement(xml, "infDPS");
  const canonicalInfoDps = canonicalizeXml(infDpsContent);

  // 2. Calculate SHA-256 digest of canonicalized infDPS
  const encoder = new TextEncoder();
  const infDpsBytes = encoder.encode(canonicalInfoDps);
  const digestBuffer = await crypto.subtle.digest("SHA-256", infDpsBytes);
  const digestBase64 = btoa(
    String.fromCharCode(...new Uint8Array(digestBuffer))
  );

  // 3. Build SignedInfo element
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><DigestValue>${digestBase64}</DigestValue></Reference></SignedInfo>`;

  // 4. Sign the SignedInfo using RSA-SHA256 with node-forge
  const canonicalSignedInfo = canonicalizeXml(signedInfo);
  const md = forge.md.sha256.create();
  md.update(canonicalSignedInfo, "utf8");
  const signature = certData.privateKeyForge.sign(md);
  const signatureBase64 = forge.util.encode64(signature);

  // 5. Get X.509 certificate base64 (DER format, without PEM headers)
  const certBase64 = forge.util.encode64(
    forge.asn1.toDer(forge.pki.certificateToAsn1(
      forge.pki.certificateFromPem(certData.certificatePem)
    )).getBytes()
  );

  // 6. Build complete Signature element
  const signatureElement = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureBase64}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo></Signature>`;

  // 7. Insert signature before closing </DPS> tag
  const signedXml = xml.replace("</DPS>", `${signatureElement}</DPS>`);

  return signedXml;
}

// ==================== DPS XML Builder ====================

interface DpsData {
  infDPS: {
    tpAmb: number;
    dhEmi: string;
    verAplic: string;
    serie: string;
    nDPS: string;
    dCompet: string;
    tpEmit: number;
    cLocEmi: string;
    subst?: { chSubstda: string };
    prest: {
      CNPJ: string;
      xNome: string;
      IM?: string;
      end: {
        CEP: string;
        xLgr: string;
        nro: string;
        xBairro: string;
        cMun: string;
        UF: string;
      };
    };
    toma: {
      CNPJ?: string;
      CPF?: string;
      xNome: string;
      end?: {
        CEP?: string;
        xLgr?: string;
        nro?: string;
        xBairro?: string;
        cMun?: string;
        UF?: string;
      };
      fone?: string;
      email?: string;
    };
    serv: {
      cServ: {
        cTribNac: string;
        cTribMun?: string;
        CNAE?: string;
        xDescServ: string;
      };
      cPais?: string;
      cMun?: string;
    };
    valores: {
      vServPrest: {
        vServ: number;
        vDescIncond?: number;
      };
      vDed?: { xDescOutDed?: string; vDed: number };
      trib: {
        tribMun: {
          tribISSQN: number;
          cPaisResult?: string;
          BM?: { pAliq: number; tpRetISSQN: number };
        };
        tribFed?: {
          pPIS?: number; vPIS?: number;
          pCOFINS?: number; vCOFINS?: number;
          pINSS?: number; vINSS?: number;
          pIR?: number; vIR?: number;
          pCSLL?: number; vCSLL?: number;
        };
        totTrib?: { indTotTrib: number; pTotTribSN?: number };
      };
    };
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildDpsXml(dps: DpsData): string {
  const inf = dps.infDPS;
  const prest = inf.prest;
  const toma = inf.toma;
  const serv = inf.serv;
  const val = inf.valores;

  let tomaDoc = "";
  if (toma.CNPJ) tomaDoc = `<CNPJ>${toma.CNPJ}</CNPJ>`;
  else if (toma.CPF) tomaDoc = `<CPF>${toma.CPF}</CPF>`;

  let tomaEnd = "";
  if (toma.end) {
    tomaEnd = `<end>${toma.end.CEP ? `<CEP>${toma.end.CEP}</CEP>` : ""}${toma.end.xLgr ? `<xLgr>${toma.end.xLgr}</xLgr>` : ""}${toma.end.nro ? `<nro>${toma.end.nro}</nro>` : ""}${toma.end.xBairro ? `<xBairro>${toma.end.xBairro}</xBairro>` : ""}${toma.end.cMun ? `<cMun>${toma.end.cMun}</cMun>` : ""}${toma.end.UF ? `<UF>${toma.end.UF}</UF>` : ""}</end>`;
  }

  let tribFed = "";
  if (val.trib.tribFed) {
    const tf = val.trib.tribFed;
    tribFed = `<tribFed>${tf.pPIS !== undefined ? `<pPIS>${tf.pPIS}</pPIS><vPIS>${tf.vPIS}</vPIS>` : ""}${tf.pCOFINS !== undefined ? `<pCOFINS>${tf.pCOFINS}</pCOFINS><vCOFINS>${tf.vCOFINS}</vCOFINS>` : ""}${tf.pINSS !== undefined ? `<pINSS>${tf.pINSS}</pINSS><vINSS>${tf.vINSS}</vINSS>` : ""}${tf.pIR !== undefined ? `<pIR>${tf.pIR}</pIR><vIR>${tf.vIR}</vIR>` : ""}${tf.pCSLL !== undefined ? `<pCSLL>${tf.pCSLL}</pCSLL><vCSLL>${tf.vCSLL}</vCSLL>` : ""}</tribFed>`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
<infDPS>
<tpAmb>${inf.tpAmb}</tpAmb>
<dhEmi>${inf.dhEmi}</dhEmi>
<verAplic>${inf.verAplic}</verAplic>
<serie>${inf.serie}</serie>
<nDPS>${inf.nDPS}</nDPS>
<dCompet>${inf.dCompet}</dCompet>
<tpEmit>${inf.tpEmit}</tpEmit>
<cLocEmi>${inf.cLocEmi}</cLocEmi>
<prest>
<CNPJ>${prest.CNPJ}</CNPJ>
<xNome>${escapeXml(prest.xNome)}</xNome>
${prest.IM ? `<IM>${prest.IM}</IM>` : ""}
</prest>
<toma>
${tomaDoc}
<xNome>${escapeXml(toma.xNome)}</xNome>
${tomaEnd}
${toma.email ? `<email>${escapeXml(toma.email)}</email>` : ""}
</toma>
<serv>
<cServ>
<cTribNac>${serv.cServ.cTribNac}</cTribNac>
${serv.cServ.CNAE ? `<CNAE>${serv.cServ.CNAE}</CNAE>` : ""}
<xDescServ>${escapeXml(serv.cServ.xDescServ)}</xDescServ>
</cServ>
${serv.cMun ? `<cMun>${serv.cMun}</cMun>` : ""}
</serv>
<valores>
<vServPrest>
<vServ>${val.vServPrest.vServ.toFixed(2)}</vServ>
</vServPrest>
${val.vDed ? `<vDed><vDed>${val.vDed.vDed.toFixed(2)}</vDed></vDed>` : ""}
<trib>
<tribMun>
<tribISSQN>${val.trib.tribMun.tribISSQN}</tribISSQN>
${val.trib.tribMun.BM ? `<BM><pAliq>${val.trib.tribMun.BM.pAliq}</pAliq><tpRetISSQN>${val.trib.tribMun.BM.tpRetISSQN}</tpRetISSQN></BM>` : ""}
</tribMun>
${tribFed}
</trib>
</valores>
</infDPS>
</DPS>`;

  return xml;
}

// ==================== API Nacional NFS-e Communication ====================

interface ApiNfseResponse {
  success: boolean;
  protocolo?: string;
  chaveAcesso?: string;
  xmlRetorno?: string;
  status?: string;
  motivo?: string;
  httpStatus?: number;
}

async function enviarDpsApiNacional(
  xmlAssinado: string,
  certData: CertificateData,
  ambiente: string
): Promise<ApiNfseResponse> {
  const baseUrl = ambiente === "producao" ? NFSE_API_URLS.producao : NFSE_API_URLS.homologacao;
  const url = `${baseUrl}/nfse`;

  console.log(`[nfse-emission] Enviando DPS para ${url}`);

  // Compress XML with gzip and encode as base64 (required by API Nacional)
  const xmlBytes = new TextEncoder().encode(xmlAssinado);
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(xmlBytes);
  writer.close();
  const compressedChunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    compressedChunks.push(value);
  }
  const totalLength = compressedChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const compressedBytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of compressedChunks) {
    compressedBytes.set(chunk, offset);
    offset += chunk.length;
  }
  const xmlGzipBase64 = btoa(String.fromCharCode(...compressedBytes));

  // Build JSON payload (API Nacional accepts JSON with gzipped XML)
  const payload = {
    dpsXmlGZipB64: xmlGzipBase64,
  };

  try {
    // Try to create an HTTP client with mTLS (certificate-based auth)
    // Note: This requires Deno.createHttpClient which may not be available in all runtimes
    let response: Response;

    // Extract PEM cert and key for mTLS
    const certPem = certData.certificatePem;
    const keyPem = certData.privateKeyPem;

    try {
      // @ts-ignore - Deno.createHttpClient may not be in type definitions
      const httpClient = Deno.createHttpClient({
        certChain: certPem,
        privateKey: keyPem,
      });

      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
        // @ts-ignore - client option for Deno
        client: httpClient,
      });
    } catch (mtlsError) {
      console.warn("[nfse-emission] mTLS não disponível neste runtime, tentando sem mTLS:", mtlsError);
      // Fallback: try without mTLS (will likely fail with auth error from API)
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });
    }

    const responseText = await response.text();
    console.log(`[nfse-emission] Status: ${response.status}, Resposta: ${responseText.substring(0, 500)}`);

    if (response.ok) {
      // Parse successful response
      try {
        const responseData = JSON.parse(responseText);
        // API Nacional returns chaveAcesso and XML da NFS-e
        return {
          success: true,
          protocolo: responseData.protocolo || responseData.idDPS,
          chaveAcesso: responseData.chaveAcesso || responseData.chNFSe,
          xmlRetorno: responseData.nfseXmlGZipB64
            ? await decompressGzipBase64(responseData.nfseXmlGZipB64)
            : responseText,
          status: "autorizado",
          httpStatus: response.status,
        };
      } catch {
        // Response might be XML
        const chaveMatch = responseText.match(/<chaveAcesso>([^<]+)<\/chaveAcesso>/);
        const protocoloMatch = responseText.match(/<protocolo>([^<]+)<\/protocolo>/);
        return {
          success: true,
          protocolo: protocoloMatch?.[1],
          chaveAcesso: chaveMatch?.[1],
          xmlRetorno: responseText,
          status: "autorizado",
          httpStatus: response.status,
        };
      }
    } else {
      // Parse error response
      let motivo = `HTTP ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        motivo = errorData.mensagem || errorData.message || errorData.erro || JSON.stringify(errorData);
      } catch {
        motivo = responseText.substring(0, 500) || `Erro HTTP ${response.status}`;
      }
      return {
        success: false,
        status: "rejeitado",
        motivo,
        xmlRetorno: responseText,
        httpStatus: response.status,
      };
    }
  } catch (error) {
    console.error("[nfse-emission] Erro na chamada à API Nacional:", error);
    return {
      success: false,
      status: "erro_comunicacao",
      motivo: error instanceof Error ? error.message : "Erro de comunicação com API Nacional",
    };
  }
}

async function decompressGzipBase64(gzipBase64: string): Promise<string> {
  try {
    const binaryString = atob(gzipBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let off = 0;
    for (const c of chunks) {
      result.set(c, off);
      off += c.length;
    }
    return new TextDecoder().decode(result);
  } catch {
    return gzipBase64; // Return as-is if decompression fails
  }
}

// ==================== SHA-256 Helper ====================

async function sha256(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ==================== Main Handler ====================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { nota_fiscal_id } = await req.json();

    if (!nota_fiscal_id) {
      return new Response(
        JSON.stringify({ error: "nota_fiscal_id é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Buscar nota fiscal
    const { data: nota, error: notaError } = await supabase
      .from("notas_fiscais")
      .select("*")
      .eq("id", nota_fiscal_id)
      .single();

    if (notaError || !nota) {
      return new Response(
        JSON.stringify({ error: "Nota fiscal não encontrada" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tenantId = nota.tenant_id;
    const issuerId = nota.issuer_id;

    // 2. Buscar configuração do emitente (certificado + ambiente)
    if (!issuerId) {
      return new Response(
        JSON.stringify({ error: "Nota fiscal sem emitente (issuer_id) definido. Selecione o emitente antes de emitir." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: config, error: configError } = await supabase
      .from("configuracoes_nfse")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("issuer_id", issuerId)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Configuração NFS-e não encontrada para este emitente. Configure o certificado em Configurações NFS-e." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!config.certificado_base64 || !config.certificado_senha) {
      return new Response(
        JSON.stringify({ error: "Certificado digital A1 não configurado para este emitente." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Parse do certificado PFX
    let certData: CertificateData;
    try {
      certData = parsePfxCertificate(config.certificado_base64, config.certificado_senha);
      console.log(`[nfse-emission] Certificado parsed: ${certData.subjectDN}, válido até ${certData.notAfter.toISOString()}`);

      // Verificar validade
      if (certData.notAfter < new Date()) {
        return new Response(
          JSON.stringify({ error: `Certificado digital expirado em ${certData.notAfter.toISOString().split('T')[0]}. Atualize o certificado nas configurações.` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } catch (certError) {
      console.error("[nfse-emission] Erro ao parsear certificado:", certError);
      return new Response(
        JSON.stringify({ error: "Erro ao ler certificado digital. Verifique se o arquivo PFX e a senha estão corretos.", details: certError instanceof Error ? certError.message : "Erro desconhecido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Buscar dados do tomador
    let tomador = null;
    if (nota.tomador_id) {
      const { data } = await supabase
        .from("tomadores_nfse")
        .select("*")
        .eq("id", nota.tomador_id)
        .single();
      tomador = data;
    }

    // 5. Buscar dados do emitente (issuer)
    const { data: issuer } = await supabase
      .from("issuers")
      .select("*")
      .eq("id", issuerId)
      .single();

    // 6. Gerar número sequencial da DPS
    const dpsNumber = `DPS-${Date.now()}`;
    const ambiente = config.ambiente === "producao" ? 1 : 2;

    // 7. Montar estrutura DPS com dados reais do emitente
    const tomaDoc: Record<string, string> = {};
    if (tomador) {
      const doc = tomador.cpf_cnpj.replace(/\D/g, "");
      if (doc.length === 14) tomaDoc.CNPJ = doc;
      else tomaDoc.CPF = doc;
    }

    const prestadorCnpj = config.prestador_cnpj?.replace(/\D/g, "") || issuer?.cnpj?.replace(/\D/g, "") || "";

    const dpsData: DpsData = {
      infDPS: {
        tpAmb: ambiente,
        dhEmi: new Date().toISOString(),
        verAplic: "MasterMed-1.0",
        serie: "NFS",
        nDPS: dpsNumber,
        dCompet: nota.data_emissao || new Date().toISOString().split("T")[0],
        tpEmit: 1,
        cLocEmi: config.municipio_codigo || nota.municipio_codigo || "0000000",
        prest: {
          CNPJ: prestadorCnpj,
          xNome: config.prestador_razao_social || issuer?.name || "Prestador",
          IM: config.inscricao_municipal || undefined,
          end: {
            CEP: "",
            xLgr: "",
            nro: "",
            xBairro: "",
            cMun: config.municipio_codigo || "",
            UF: config.municipio_uf || issuer?.state || "",
          },
        },
        toma: {
          ...tomaDoc,
          xNome: tomador?.nome || nota.tomador_nome || "Tomador",
          end: tomador
            ? {
                CEP: tomador.cep?.replace(/\D/g, "") || undefined,
                xLgr: tomador.logradouro || undefined,
                nro: tomador.numero || undefined,
                xBairro: tomador.bairro || undefined,
                cMun: undefined,
                UF: tomador.uf || undefined,
              }
            : undefined,
          email: tomador?.email || undefined,
        },
        serv: {
          cServ: {
            cTribNac: nota.codigo_servico || "",
            CNAE: nota.codigo_cnae || undefined,
            xDescServ: nota.descricao_servico || "",
          },
          cMun: config.municipio_codigo || nota.municipio_codigo || undefined,
        },
        valores: {
          vServPrest: {
            vServ: nota.valor_servico,
          },
          vDed:
            nota.valor_deducoes > 0
              ? { vDed: nota.valor_deducoes }
              : undefined,
          trib: {
            tribMun: {
              tribISSQN: 1,
              BM: {
                pAliq: nota.aliquota_iss,
                tpRetISSQN: nota.iss_retido ? 1 : 2,
              },
            },
            tribFed:
              nota.valor_pis > 0 ||
              nota.valor_cofins > 0 ||
              nota.valor_inss > 0 ||
              nota.valor_ir > 0 ||
              nota.valor_csll > 0
                ? {
                    vPIS: nota.valor_pis, pPIS: 0,
                    vCOFINS: nota.valor_cofins, pCOFINS: 0,
                    vINSS: nota.valor_inss, pINSS: 0,
                    vIR: nota.valor_ir, pIR: 0,
                    vCSLL: nota.valor_csll, pCSLL: 0,
                  }
                : undefined,
          },
        },
      },
    };

    // 8. Converter para XML
    const xmlDps = buildDpsXml(dpsData);

    // 9. Assinar XML digitalmente
    let xmlAssinado: string;
    try {
      xmlAssinado = await signXmlDps(xmlDps, certData);
      console.log("[nfse-emission] XML assinado com sucesso");
    } catch (signError) {
      console.error("[nfse-emission] Erro ao assinar XML:", signError);
      return new Response(
        JSON.stringify({ error: "Erro ao assinar XML digitalmente", details: signError instanceof Error ? signError.message : "Erro desconhecido" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 10. Registrar DPS enviada
    const { data: dps, error: dpsInsertError } = await supabase
      .from("dps_enviadas")
      .insert({
        tenant_id: tenantId,
        nota_fiscal_id: nota_fiscal_id,
        status: "enviando",
        xml_envio: xmlAssinado,
        enviado_em: new Date().toISOString(),
        numero_lote: dpsNumber,
      })
      .select("id")
      .single();

    if (dpsInsertError) {
      console.error("Erro ao registrar DPS:", dpsInsertError);
      return new Response(
        JSON.stringify({ error: "Erro ao registrar DPS", details: dpsInsertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 11. Enviar para a API Nacional NFS-e
    const apiResponse = await enviarDpsApiNacional(xmlAssinado, certData, config.ambiente);

    // 12. Atualizar DPS com retorno
    await supabase
      .from("dps_enviadas")
      .update({
        status: apiResponse.success ? "concluido" : "falha",
        xml_retorno: apiResponse.xmlRetorno || null,
        protocolo: apiResponse.protocolo || null,
        codigo_retorno: apiResponse.status || null,
        mensagem_retorno: apiResponse.motivo || null,
        retorno_em: new Date().toISOString(),
        tentativas: 1,
      })
      .eq("id", dps.id);

    // 13. Atualizar status da nota fiscal e registrar documentos/eventos
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single();

    const userName = profileData?.full_name || "Sistema";

    if (apiResponse.success) {
      await supabase
        .from("notas_fiscais")
        .update({
          status: "autorizado",
          chave_acesso: apiResponse.chaveAcesso,
          numero_dps: dpsNumber,
          data_autorizacao: new Date().toISOString(),
        })
        .eq("id", nota_fiscal_id);

      // Save XMLs to storage
      if (apiResponse.xmlRetorno) {
        const dataEmissao = nota.data_emissao || new Date().toISOString().split("T")[0];
        const [ano, mes] = dataEmissao.split("-");
        const chaveNfse = apiResponse.chaveAcesso || dpsNumber;
        const basePath = `${tenantId}/${issuerId}/${ano}/${mes}/${chaveNfse}`;

        const dpsHash = await sha256(xmlAssinado);
        const nfseHash = await sha256(apiResponse.xmlRetorno);

        const dpsPath = `${basePath}/dps_${dpsNumber}.xml`;
        const nfsePath = `${basePath}/nfse_${chaveNfse}.xml`;

        await supabase.storage
          .from("nfse-documentos")
          .upload(dpsPath, new Blob([xmlAssinado], { type: "application/xml" }), {
            contentType: "application/xml",
            upsert: false,
          });

        await supabase.storage
          .from("nfse-documentos")
          .upload(nfsePath, new Blob([apiResponse.xmlRetorno], { type: "application/xml" }), {
            contentType: "application/xml",
            upsert: false,
          });

        await supabase.from("documentos_nfse").insert([
          {
            tenant_id: tenantId,
            issuer_id: issuerId,
            nota_fiscal_id,
            tipo: "xml_dps",
            nome_arquivo: `dps_${dpsNumber}.xml`,
            storage_path: dpsPath,
            hash: dpsHash,
            tamanho_bytes: new TextEncoder().encode(xmlAssinado).length,
            conteudo: null,
          },
          {
            tenant_id: tenantId,
            issuer_id: issuerId,
            nota_fiscal_id,
            tipo: "xml_nfse",
            nome_arquivo: `nfse_${chaveNfse}.xml`,
            storage_path: nfsePath,
            hash: nfseHash,
            tamanho_bytes: new TextEncoder().encode(apiResponse.xmlRetorno).length,
            conteudo: null,
          },
        ]);
      }

      // Register authorization event
      await supabase.from("eventos_nfse").insert({
        tenant_id: tenantId,
        nota_fiscal_id,
        tipo: "autorizacao",
        descricao: `NFS-e autorizada com protocolo ${apiResponse.protocolo}`,
        usuario_id: userId,
        codigo_retorno: apiResponse.protocolo,
      });

      await supabase.from("audit_logs").insert({
        tenant_id: tenantId,
        user_id: userId,
        user_name: userName,
        action: "NFSE_EMISSAO",
        table_name: "notas_fiscais",
        record_id: nota_fiscal_id,
        record_label: `Protocolo: ${apiResponse.protocolo}`,
        new_data: { protocolo: apiResponse.protocolo, chave_acesso: apiResponse.chaveAcesso, status: "autorizado" },
      });
    } else {
      await supabase
        .from("notas_fiscais")
        .update({
          status: "rejeitado",
          motivo_rejeicao: apiResponse.motivo || "Erro na emissão",
        })
        .eq("id", nota_fiscal_id);

      await supabase.from("eventos_nfse").insert({
        tenant_id: tenantId,
        nota_fiscal_id,
        tipo: "rejeicao",
        descricao: `NFS-e rejeitada: ${apiResponse.motivo}`,
        usuario_id: userId,
        codigo_retorno: apiResponse.status,
        mensagem: apiResponse.motivo,
      });

      await supabase.from("audit_logs").insert({
        tenant_id: tenantId,
        user_id: userId,
        user_name: userName,
        action: "NFSE_REJEICAO",
        table_name: "notas_fiscais",
        record_id: nota_fiscal_id,
        record_label: apiResponse.motivo || "Rejeitada",
        new_data: { motivo: apiResponse.motivo, status: "rejeitado", httpStatus: apiResponse.httpStatus },
      });
    }

    // 14. Log de integração
    await supabase.from("logs_integracao_nfse").insert({
      tenant_id: tenantId,
      nota_fiscal_id,
      operacao: "emissao_dps",
      endpoint: ambiente === 1 ? NFSE_API_URLS.producao : NFSE_API_URLS.homologacao,
      sucesso: apiResponse.success,
      request_payload: xmlAssinado.substring(0, 5000),
      response_payload: apiResponse.xmlRetorno?.substring(0, 5000) || null,
      erro_mensagem: apiResponse.motivo || null,
      http_status: apiResponse.httpStatus || null,
    });

    return new Response(
      JSON.stringify({
        success: apiResponse.success,
        protocolo: apiResponse.protocolo,
        chave_acesso: apiResponse.chaveAcesso,
        status: apiResponse.success ? "autorizado" : "rejeitado",
        motivo: apiResponse.motivo,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro no serviço de emissão NFS-e:", error);
    return new Response(
      JSON.stringify({
        error: "Erro interno no serviço de emissão",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
