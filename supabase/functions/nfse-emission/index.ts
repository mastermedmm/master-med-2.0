import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NFSE_API_URLS = {
  homologacao: "https://sefin.producaorestrita.nfse.gov.br/SefinNacional",
  producao: "https://sefin.nfse.gov.br/SefinNacional",
};

// ==================== Certificate Types ====================

interface CertificateData {
  privateKeyPem: string;
  certificatePem: string;
  certificateDer: Uint8Array;
  privateKeyCrypto: CryptoKey;
  serialNumber: string;
  issuerDN: string;
  subjectDN: string;
  notAfter: Date;
}

// ==================== PFX Parsing with node-forge ====================

async function parsePfxCertificate(pfxBase64: string, password: string): Promise<CertificateData> {
  console.log(`[nfse-emission] Parsing PFX (base64 len: ${pfxBase64.length}, pwd len: ${password.length})`);

  const pfxDer = forge.util.decode64(pfxBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);

  // Try multiple parsing strategies
  let p12: forge.pkcs12.Pkcs12Pfx | null = null;
  const errors: string[] = [];

  // Strategy 1: standard password
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
    console.log("[nfse-emission] Strategy 1 (standard) OK");
  } catch (e1) {
    errors.push(`standard: ${(e1 as Error).message}`);
    // Strategy 2: non-strict mode
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);
      console.log("[nfse-emission] Strategy 2 (non-strict) OK");
    } catch (e2) {
      errors.push(`non-strict: ${(e2 as Error).message}`);
      // Strategy 3: trimmed password
      try {
        p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password.trim());
        console.log("[nfse-emission] Strategy 3 (trimmed) OK");
      } catch (e3) {
        errors.push(`trimmed: ${(e3 as Error).message}`);
        // Strategy 4: empty password (some test certs)
        try {
          p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, "");
          console.log("[nfse-emission] Strategy 4 (empty) OK");
        } catch (e4) {
          errors.push(`empty: ${(e4 as Error).message}`);
        }
      }
    }
  }

  if (!p12) {
    throw new Error(
      `Não foi possível abrir o certificado PFX. Verifique se a senha está correta e se o certificado não usa criptografia AES (apenas 3DES é suportado). Tentativas: ${errors.join("; ")}`
    );
  }

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (!keyBag?.length || !keyBag[0].key) throw new Error("Chave privada não encontrada no PFX");
  const forgePrivateKey = keyBag[0].key as forge.pki.rsa.PrivateKey;

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];
  if (!certBag?.length || !certBag[0].cert) throw new Error("Certificado não encontrado no PFX");
  const cert = certBag[0].cert;

  const privateKeyPem = forge.pki.privateKeyToPem(forgePrivateKey);
  const certificatePem = forge.pki.certificateToPem(cert);

  const certAsn1 = forge.pki.certificateToAsn1(cert);
  const certDerBytes = forge.asn1.toDer(certAsn1).getBytes();
  const certificateDer = new Uint8Array(certDerBytes.length);
  for (let i = 0; i < certDerBytes.length; i++) {
    certificateDer[i] = certDerBytes.charCodeAt(i);
  }

  // Import private key to Web Crypto for signing
  const pkcs8Der = forge.asn1.toDer(forge.pki.privateKeyToAsn1(forgePrivateKey)).getBytes();
  const pkcs8Bytes = new Uint8Array(pkcs8Der.length);
  for (let i = 0; i < pkcs8Der.length; i++) {
    pkcs8Bytes[i] = pkcs8Der.charCodeAt(i);
  }
  const privateKeyCrypto = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  );

  const formatDN = (attrs: forge.pki.CertificateField[]) =>
    attrs.map(a => `${a.shortName}=${a.value}`).join(", ");

  console.log(`[nfse-emission] Cert OK: ${formatDN(cert.subject.attributes)}, válido até ${cert.validity.notAfter.toISOString()}`);

  return {
    privateKeyPem,
    certificatePem,
    certificateDer,
    privateKeyCrypto,
    serialNumber: cert.serialNumber,
    issuerDN: formatDN(cert.issuer.attributes),
    subjectDN: formatDN(cert.subject.attributes),
    notAfter: cert.validity.notAfter,
  };
}

// ==================== XML Canonicalization (C14N) ====================

function canonicalizeXml(xml: string): string {
  let canonical = xml.replace(/<\?xml[^?]*\?>\s*/g, "");
  canonical = canonical.replace(/>\s+</g, "><");
  canonical = canonical.trim();
  return canonical;
}

function extractElement(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, "m");
  const match = xml.match(regex);
  if (!match) throw new Error(`Elemento <${tagName}> não encontrado no XML`);
  return match[0];
}

// ==================== XMLDSig Signature (Web Crypto) ====================

async function signXmlDps(xml: string, certData: CertificateData): Promise<string> {
  // 1. Extract and canonicalize infDPS
  const infDpsContent = extractElement(xml, "infDPS");
  const canonicalInfoDps = canonicalizeXml(infDpsContent);

  // 2. SHA-256 digest
  const encoder = new TextEncoder();
  const digestBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(canonicalInfoDps));
  const digestBase64 = btoa(String.fromCharCode(...new Uint8Array(digestBuffer)));

  // 3. Build SignedInfo
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><DigestValue>${digestBase64}</DigestValue></Reference></SignedInfo>`;

  // 4. Sign with Web Crypto API (RSA-SHA256)
  const canonicalSignedInfo = canonicalizeXml(signedInfo);
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    certData.privateKeyCrypto,
    encoder.encode(canonicalSignedInfo)
  );
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  // 5. Certificate base64
  const certBase64 = btoa(String.fromCharCode(...certData.certificateDer));

  // 6. Build Signature element
  const signatureElement = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureBase64}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo></Signature>`;

  // 7. Insert before </DPS>
  return xml.replace("</DPS>", `${signatureElement}</DPS>`);
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
    prest: {
      CNPJ: string;
      xNome: string;
      IM?: string;
      end: { CEP: string; xLgr: string; nro: string; xBairro: string; cMun: string; UF: string };
    };
    toma: {
      CNPJ?: string;
      CPF?: string;
      xNome: string;
      end?: { CEP?: string; xLgr?: string; nro?: string; xBairro?: string; cMun?: string; UF?: string };
      email?: string;
    };
    serv: {
      cServ: { cTribNac: string; CNAE?: string; xDescServ: string };
      cMun?: string;
    };
    valores: {
      vServPrest: { vServ: number };
      vDed?: { vDed: number };
      trib: {
        tribMun: { tribISSQN: number; BM?: { pAliq: number; tpRetISSQN: number } };
        tribFed?: {
          pPIS?: number; vPIS?: number;
          pCOFINS?: number; vCOFINS?: number;
          pINSS?: number; vINSS?: number;
          pIR?: number; vIR?: number;
          pCSLL?: number; vCSLL?: number;
        };
      };
    };
  };
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function buildDpsXml(dps: DpsData): string {
  const inf = dps.infDPS;
  const prest = inf.prest;
  const toma = inf.toma;
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

  return `<?xml version="1.0" encoding="UTF-8"?>
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
<cTribNac>${inf.serv.cServ.cTribNac}</cTribNac>
${inf.serv.cServ.CNAE ? `<CNAE>${inf.serv.cServ.CNAE}</CNAE>` : ""}
<xDescServ>${escapeXml(inf.serv.cServ.xDescServ)}</xDescServ>
</cServ>
${inf.serv.cMun ? `<cMun>${inf.serv.cMun}</cMun>` : ""}
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
}

// ==================== API Nacional NFS-e ====================

interface ApiNfseResponse {
  success: boolean;
  protocolo?: string;
  chaveAcesso?: string;
  xmlRetorno?: string;
  status?: string;
  motivo?: string;
  httpStatus?: number;
}

async function enviarDpsApiNacional(xmlAssinado: string, certData: CertificateData, ambiente: string): Promise<ApiNfseResponse> {
  const baseUrl = ambiente === "producao" ? NFSE_API_URLS.producao : NFSE_API_URLS.homologacao;
  const url = `${baseUrl}/nfse`;
  console.log(`[nfse-emission] Enviando DPS para ${url}`);

  // Compress XML with gzip
  const xmlBytes = new TextEncoder().encode(xmlAssinado);
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(xmlBytes);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLen = chunks.reduce((a, c) => a + c.length, 0);
  const compressed = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) { compressed.set(c, off); off += c.length; }
  const xmlGzipBase64 = btoa(String.fromCharCode(...compressed));

  try {
    let response: Response;
    try {
      // @ts-ignore - Deno mTLS
      const httpClient = Deno.createHttpClient({
        certChain: certData.certificatePem,
        privateKey: certData.privateKeyPem,
      });
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ dpsXmlGZipB64: xmlGzipBase64 }),
        // @ts-ignore
        client: httpClient,
      });
    } catch (mtlsError) {
      console.warn("[nfse-emission] mTLS fallback:", mtlsError);
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ dpsXmlGZipB64: xmlGzipBase64 }),
      });
    }

    const responseText = await response.text();
    console.log(`[nfse-emission] Status: ${response.status}, Response: ${responseText.substring(0, 500)}`);

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        return {
          success: true,
          protocolo: data.protocolo || data.idDPS,
          chaveAcesso: data.chaveAcesso || data.chNFSe,
          xmlRetorno: data.nfseXmlGZipB64
            ? await decompressGzipBase64(data.nfseXmlGZipB64)
            : responseText,
          status: "autorizado",
          httpStatus: response.status,
        };
      } catch {
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
      let motivo = `HTTP ${response.status}`;
      try {
        const errData = JSON.parse(responseText);
        motivo = errData.mensagem || errData.message || errData.erro || JSON.stringify(errData);
      } catch {
        motivo = responseText.substring(0, 500) || motivo;
      }
      return { success: false, status: "rejeitado", motivo, xmlRetorno: responseText, httpStatus: response.status };
    }
  } catch (error) {
    console.error("[nfse-emission] API error:", error);
    return { success: false, status: "erro_comunicacao", motivo: error instanceof Error ? error.message : "Erro de comunicação" };
  }
}

async function decompressGzipBase64(gzipBase64: string): Promise<string> {
  try {
    const bytes = Uint8Array.from(atob(gzipBase64), c => c.charCodeAt(0));
    const ds = new DecompressionStream("gzip");
    const w = ds.writable.getWriter();
    w.write(bytes);
    w.close();
    const r = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const result = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) { result.set(c, o); o += c.length; }
    return new TextDecoder().decode(result);
  } catch { return gzipBase64; }
}

async function sha256(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { nota_fiscal_id } = await req.json();
    if (!nota_fiscal_id) {
      return new Response(JSON.stringify({ error: "nota_fiscal_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch nota fiscal
    const { data: nota, error: notaError } = await supabase
      .from("notas_fiscais").select("*").eq("id", nota_fiscal_id).single();
    if (notaError || !nota) {
      return new Response(JSON.stringify({ error: "Nota fiscal não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = nota.tenant_id;
    const issuerId = nota.issuer_id;

    if (!issuerId) {
      return new Response(JSON.stringify({ error: "Nota fiscal sem emitente definido." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch config
    const { data: config, error: configError } = await supabase
      .from("configuracoes_nfse").select("*").eq("tenant_id", tenantId).eq("issuer_id", issuerId).single();
    if (configError || !config) {
      return new Response(JSON.stringify({ error: "Configuração NFS-e não encontrada para este emitente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!config.certificado_base64 || !config.certificado_senha) {
      return new Response(JSON.stringify({ error: "Certificado digital A1 não configurado." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Parse PFX certificate
    let certData: CertificateData;
    try {
      certData = await parsePfxCertificate(config.certificado_base64, config.certificado_senha);
      console.log(`[nfse-emission] Cert OK: ${certData.subjectDN}, até ${certData.notAfter.toISOString()}`);

      if (certData.notAfter < new Date()) {
        return new Response(JSON.stringify({ error: `Certificado expirado em ${certData.notAfter.toISOString().split("T")[0]}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (certError) {
      console.error("[nfse-emission] Cert error:", certError);
      return new Response(JSON.stringify({
        error: "Erro ao ler certificado digital. Verifique se o arquivo PFX e a senha estão corretos.",
        details: certError instanceof Error ? certError.message : "Erro desconhecido",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch tomador
    let tomador = null;
    if (nota.tomador_id) {
      const { data } = await supabase.from("tomadores_nfse").select("*").eq("id", nota.tomador_id).single();
      tomador = data;
    }

    // 5. Fetch issuer
    const { data: issuer } = await supabase.from("issuers").select("*").eq("id", issuerId).single();

    // 6. Build DPS
    const dpsNumber = `DPS-${Date.now()}`;
    const ambiente = config.ambiente === "producao" ? 1 : 2;

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
            CEP: "", xLgr: "", nro: "", xBairro: "",
            cMun: config.municipio_codigo || "",
            UF: config.municipio_uf || issuer?.state || "",
          },
        },
        toma: {
          ...tomaDoc,
          xNome: tomador?.nome || nota.tomador_nome || "Tomador",
          end: tomador ? {
            CEP: tomador.cep?.replace(/\D/g, "") || undefined,
            xLgr: tomador.logradouro || undefined,
            nro: tomador.numero || undefined,
            xBairro: tomador.bairro || undefined,
            cMun: undefined,
            UF: tomador.uf || undefined,
          } : undefined,
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
          vServPrest: { vServ: nota.valor_servico },
          vDed: nota.valor_deducoes > 0 ? { vDed: nota.valor_deducoes } : undefined,
          trib: {
            tribMun: {
              tribISSQN: 1,
              BM: { pAliq: nota.aliquota_iss, tpRetISSQN: nota.iss_retido ? 1 : 2 },
            },
            tribFed: (nota.valor_pis > 0 || nota.valor_cofins > 0 || nota.valor_inss > 0 || nota.valor_ir > 0 || nota.valor_csll > 0)
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

    // 7. Build XML
    const xmlDps = buildDpsXml(dpsData);

    // 8. Sign XML
    let xmlAssinado: string;
    try {
      xmlAssinado = await signXmlDps(xmlDps, certData);
      console.log("[nfse-emission] XML assinado com sucesso");
    } catch (signError) {
      console.error("[nfse-emission] Sign error:", signError);
      return new Response(JSON.stringify({ error: "Erro ao assinar XML", details: (signError as Error).message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Register DPS
    const { data: dps, error: dpsErr } = await supabase
      .from("dps_enviadas")
      .insert({ tenant_id: tenantId, nota_fiscal_id, status: "enviando", xml_envio: xmlAssinado, enviado_em: new Date().toISOString(), numero_lote: dpsNumber })
      .select("id").single();
    if (dpsErr) {
      return new Response(JSON.stringify({ error: "Erro ao registrar DPS", details: dpsErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. Send to API Nacional
    const apiResponse = await enviarDpsApiNacional(xmlAssinado, certData, config.ambiente);

    // 11. Update DPS
    await supabase.from("dps_enviadas").update({
      status: apiResponse.success ? "concluido" : "falha",
      xml_retorno: apiResponse.xmlRetorno || null,
      protocolo: apiResponse.protocolo || null,
      codigo_retorno: apiResponse.status || null,
      mensagem_retorno: apiResponse.motivo || null,
      retorno_em: new Date().toISOString(),
      tentativas: 1,
    }).eq("id", dps.id);

    // 12. Update nota fiscal
    const { data: profileData } = await supabase.from("profiles").select("full_name").eq("user_id", userId).single();
    const userName = profileData?.full_name || "Sistema";

    if (apiResponse.success) {
      await supabase.from("notas_fiscais").update({
        status: "autorizado",
        chave_acesso: apiResponse.chaveAcesso,
        numero_dps: dpsNumber,
        data_autorizacao: new Date().toISOString(),
      }).eq("id", nota_fiscal_id);

      // Save XMLs to storage
      if (apiResponse.xmlRetorno) {
        const dataEmissao = nota.data_emissao || new Date().toISOString().split("T")[0];
        const [ano, mes] = dataEmissao.split("-");
        const chaveNfse = apiResponse.chaveAcesso || dpsNumber;
        const basePath = `${tenantId}/${issuerId}/${ano}/${mes}/${chaveNfse}`;

        const dpsHash = await sha256(xmlAssinado);
        const nfseHash = await sha256(apiResponse.xmlRetorno);

        await supabase.storage.from("nfse-documentos").upload(
          `${basePath}/dps_${dpsNumber}.xml`,
          new Blob([xmlAssinado], { type: "application/xml" }),
          { contentType: "application/xml", upsert: false }
        );
        await supabase.storage.from("nfse-documentos").upload(
          `${basePath}/nfse_${chaveNfse}.xml`,
          new Blob([apiResponse.xmlRetorno], { type: "application/xml" }),
          { contentType: "application/xml", upsert: false }
        );

        await supabase.from("documentos_nfse").insert([
          { tenant_id: tenantId, issuer_id: issuerId, nota_fiscal_id, tipo: "xml_dps", nome_arquivo: `dps_${dpsNumber}.xml`, storage_path: `${basePath}/dps_${dpsNumber}.xml`, hash: dpsHash, tamanho_bytes: new TextEncoder().encode(xmlAssinado).length },
          { tenant_id: tenantId, issuer_id: issuerId, nota_fiscal_id, tipo: "xml_nfse", nome_arquivo: `nfse_${chaveNfse}.xml`, storage_path: `${basePath}/nfse_${chaveNfse}.xml`, hash: nfseHash, tamanho_bytes: new TextEncoder().encode(apiResponse.xmlRetorno).length },
        ]);
      }

      await supabase.from("eventos_nfse").insert({
        tenant_id: tenantId, nota_fiscal_id, tipo: "autorizacao",
        descricao: `NFS-e autorizada com protocolo ${apiResponse.protocolo}`,
        usuario_id: userId, codigo_retorno: apiResponse.protocolo,
      });
      await supabase.from("audit_logs").insert({
        tenant_id: tenantId, user_id: userId, user_name: userName, action: "NFSE_EMISSAO",
        table_name: "notas_fiscais", record_id: nota_fiscal_id,
        record_label: `Protocolo: ${apiResponse.protocolo}`,
        new_data: { protocolo: apiResponse.protocolo, chave_acesso: apiResponse.chaveAcesso, status: "autorizado" },
      });
    } else {
      await supabase.from("notas_fiscais").update({
        status: "rejeitado",
        motivo_rejeicao: apiResponse.motivo || "Erro na emissão",
      }).eq("id", nota_fiscal_id);

      await supabase.from("eventos_nfse").insert({
        tenant_id: tenantId, nota_fiscal_id, tipo: "rejeicao",
        descricao: `NFS-e rejeitada: ${apiResponse.motivo}`,
        usuario_id: userId, codigo_retorno: apiResponse.status, mensagem: apiResponse.motivo,
      });
      await supabase.from("audit_logs").insert({
        tenant_id: tenantId, user_id: userId, user_name: userName, action: "NFSE_REJEICAO",
        table_name: "notas_fiscais", record_id: nota_fiscal_id,
        record_label: apiResponse.motivo || "Rejeitada",
        new_data: { motivo: apiResponse.motivo, status: "rejeitado", httpStatus: apiResponse.httpStatus },
      });
    }

    // 13. Integration log
    await supabase.from("logs_integracao_nfse").insert({
      tenant_id: tenantId, nota_fiscal_id, operacao: "emissao_dps",
      endpoint: ambiente === 1 ? NFSE_API_URLS.producao : NFSE_API_URLS.homologacao,
      sucesso: apiResponse.success,
      request_payload: xmlAssinado.substring(0, 5000),
      response_payload: apiResponse.xmlRetorno?.substring(0, 5000) || null,
      erro_mensagem: apiResponse.motivo || null,
      http_status: apiResponse.httpStatus || null,
    });

    return new Response(JSON.stringify({
      success: apiResponse.success,
      protocolo: apiResponse.protocolo,
      chave_acesso: apiResponse.chaveAcesso,
      status: apiResponse.success ? "autorizado" : "rejeitado",
      motivo: apiResponse.motivo,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro geral:", error);
    return new Response(JSON.stringify({
      error: "Erro interno no serviço de emissão",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
