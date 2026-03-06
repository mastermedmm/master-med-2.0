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

// ==================== PKCS#12 Password to bytes (BMPString) ====================

function passwordToBMPBytes(password: string): Uint8Array {
  const buf = new Uint8Array((password.length + 1) * 2);
  for (let i = 0; i < password.length; i++) {
    buf[i * 2] = (password.charCodeAt(i) >> 8) & 0xff;
    buf[i * 2 + 1] = password.charCodeAt(i) & 0xff;
  }
  // null terminator already 0
  return buf;
}

// ==================== PKCS#12 KDF (RFC 7292) ====================

async function pkcs12KDF(
  hashAlgo: string,
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  id: number,
  keyLen: number
): Promise<Uint8Array> {
  // Hash block sizes
  const hashBlockSize = hashAlgo === "SHA-256" ? 64 : 64; // SHA-1 and SHA-256 both use 64-byte blocks
  const hashLen = hashAlgo === "SHA-256" ? 32 : 20;
  const u = hashLen;
  const v = hashBlockSize;

  // Step 1: Construct D
  const D = new Uint8Array(v);
  D.fill(id);

  // Step 2: Construct I = S || P
  const sLen = salt.length > 0 ? v * Math.ceil(salt.length / v) : 0;
  const pLen = password.length > 0 ? v * Math.ceil(password.length / v) : 0;
  const I = new Uint8Array(sLen + pLen);
  for (let i = 0; i < sLen; i++) I[i] = salt[i % salt.length];
  for (let i = 0; i < pLen; i++) I[sLen + i] = password[i % password.length];

  const result = new Uint8Array(keyLen);
  let resultOffset = 0;

  while (resultOffset < keyLen) {
    // Step 3: Hash D || I
    let A = new Uint8Array(v + I.length);
    A.set(D, 0);
    A.set(I, v);

    for (let iter = 0; iter < iterations; iter++) {
      const buf = await crypto.subtle.digest(hashAlgo, A);
      A = new Uint8Array(buf);
    }

    const toCopy = Math.min(keyLen - resultOffset, u);
    result.set(A.subarray(0, toCopy), resultOffset);
    resultOffset += toCopy;

    if (resultOffset >= keyLen) break;

    // Step 4: Construct B from A
    const B = new Uint8Array(v);
    for (let i = 0; i < v; i++) B[i] = A[i % u];

    // Step 5: I = (I_j + B + 1) mod 2^v for each block
    for (let j = 0; j < I.length; j += v) {
      let carry = 1;
      for (let k = v - 1; k >= 0; k--) {
        const sum = I[j + k] + B[k] + carry;
        I[j + k] = sum & 0xff;
        carry = sum >> 8;
      }
    }
  }

  return result;
}

// ==================== ASN1 Helper ====================

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function forgeStringToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

// Safe OID extraction from ASN1 node - fixes "getByte is not a function"
function safeGetOid(asn1Node: any): string {
  try {
    if (typeof asn1Node.value === "string") {
      return forge.asn1.derToOid(forge.util.createBuffer(asn1Node.value));
    }
    return forge.asn1.derToOid(asn1Node);
  } catch (e) {
    // Try raw bytes approach
    try {
      const raw = asn1Node.value || asn1Node;
      if (typeof raw === "string") {
        return forge.asn1.derToOid(forge.util.createBuffer(raw));
      }
    } catch {}
    throw new Error(`Cannot extract OID from ASN1 node (type=${asn1Node?.type}, tagClass=${asn1Node?.tagClass}): ${(e as Error).message}`);
  }
}

// Diagnostic logger that collects messages for later persistence
class DiagnosticLogger {
  private logs: string[] = [];
  
  log(msg: string) {
    const entry = `[${new Date().toISOString()}] ${msg}`;
    this.logs.push(entry);
    console.log(`[nfse-emission] ${msg}`);
  }
  
  error(msg: string, err?: unknown) {
    const errMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err || "");
    const entry = `[${new Date().toISOString()}] ERROR: ${msg} ${errMsg}`;
    this.logs.push(entry);
    console.error(`[nfse-emission] ${msg}`, err);
  }
  
  warn(msg: string) {
    const entry = `[${new Date().toISOString()}] WARN: ${msg}`;
    this.logs.push(entry);
    console.warn(`[nfse-emission] ${msg}`);
  }
  
  getFullLog(): string {
    return this.logs.join("\n");
  }
  
  getLogEntries(): string[] {
    return [...this.logs];
  }
}

function describeAsn1Node(node: any, depth = 0): string {
  if (!node || depth > 3) return "null";
  const indent = "  ".repeat(depth);
  const type = node.type !== undefined ? `0x${node.type.toString(16)}` : "?";
  const tagClass = node.tagClass !== undefined ? `0x${node.tagClass.toString(16)}` : "?";
  const constructed = node.constructed ? "CONSTRUCTED" : "PRIMITIVE";
  const valueType = typeof node.value;
  let info = `${indent}[type=${type}, tagClass=${tagClass}, ${constructed}, valueType=${valueType}`;
  
  if (valueType === "string") {
    info += `, len=${node.value.length}`;
    // Try to extract OID if it looks like one
    if (node.type === 0x06) {
      try { info += `, oid=${safeGetOid(node)}`; } catch {}
    }
  } else if (Array.isArray(node.value)) {
    info += `, children=${node.value.length}`;
  }
  info += "]";
  
  if (Array.isArray(node.value) && depth < 3) {
    for (let i = 0; i < Math.min(node.value.length, 5); i++) {
      info += "\n" + describeAsn1Node(node.value[i], depth + 1);
    }
    if (node.value.length > 5) info += `\n${indent}  ... (${node.value.length - 5} more)`;
  }
  return info;
}

// ==================== PBES2 Decryption with Web Crypto ====================

async function decryptPBES2(
  encryptedData: Uint8Array,
  algorithmAsn1: forge.asn1.Asn1,
  password: string
): Promise<Uint8Array> {
  // Parse PBES2 params
  const params = algorithmAsn1.value as forge.asn1.Asn1[];
  const kdfAsn1 = params[0]; // keyDerivationFunc
  const encSchemeAsn1 = params[1]; // encryptionScheme

  // Parse KDF (PBKDF2)
  const kdfParams = (kdfAsn1 as any).value as forge.asn1.Asn1[];
  const salt = forgeStringToBytes(forge.asn1.derToOid(kdfParams[0] as any) ? "" : ((kdfParams[0] as any).value as string));
  
  // Actually re-parse properly
  const kdfOidAsn1 = (kdfAsn1 as any).value[0];
  const kdfParamsAsn1 = (kdfAsn1 as any).value[1];
  const kdfParamsValues = (kdfParamsAsn1 as any).value as forge.asn1.Asn1[];
  
  const saltBytes = forgeStringToBytes((kdfParamsValues[0] as any).value as string);
  const iterations = forge.asn1.derToInteger(kdfParamsValues[1] as any);
  
  // Detect PRF (default SHA-1, may be SHA-256)
  let prfHash = "SHA-1";
  let keyLength = 0;
  for (let i = 2; i < kdfParamsValues.length; i++) {
    const param = kdfParamsValues[i] as any;
    if (param.type === forge.asn1.Type.INTEGER) {
      keyLength = forge.asn1.derToInteger(param);
    } else if (param.type === forge.asn1.Type.SEQUENCE) {
      const prfOid = forge.asn1.derToOid((param.value as any[])[0]);
      if (prfOid === "1.2.840.113549.2.9") prfHash = "SHA-256";
      else if (prfOid === "1.2.840.113549.2.7") prfHash = "SHA-1";
      else if (prfOid === "1.2.840.113549.2.10") prfHash = "SHA-384";
      else if (prfOid === "1.2.840.113549.2.11") prfHash = "SHA-512";
    }
  }

  // Parse encryption scheme
  const encSchemeValues = (encSchemeAsn1 as any).value as forge.asn1.Asn1[];
  const encOid = forge.asn1.derToOid(encSchemeValues[0]);
  const iv = forgeStringToBytes((encSchemeValues[1] as any).value as string);

  // Determine algorithm
  let algorithm: string;
  let aesKeyLen: number;
  switch (encOid) {
    case "2.16.840.1.101.3.4.1.2": algorithm = "AES-CBC"; aesKeyLen = 16; break; // AES-128-CBC
    case "2.16.840.1.101.3.4.1.22": algorithm = "AES-CBC"; aesKeyLen = 24; break; // AES-192-CBC
    case "2.16.840.1.101.3.4.1.42": algorithm = "AES-CBC"; aesKeyLen = 32; break; // AES-256-CBC
    default: throw new Error(`Algoritmo de criptografia não suportado: OID ${encOid}`);
  }
  if (keyLength > 0) aesKeyLen = keyLength;

  console.log(`[nfse-emission] PBES2: ${algorithm} keyLen=${aesKeyLen}, PRF=${prfHash}, iterations=${iterations}, salt=${saltBytes.length}b, iv=${iv.length}b`);

  // Derive key with PBKDF2
  const passwordBytes = new TextEncoder().encode(password);
  const baseKey = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, ["deriveKey"]);
  const derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: prfHash },
    baseKey,
    { name: algorithm, length: aesKeyLen * 8 },
    false,
    ["decrypt"]
  );

  // Decrypt
  const decrypted = await crypto.subtle.decrypt({ name: algorithm, iv }, derivedKey, encryptedData);
  return new Uint8Array(decrypted);
}

// ==================== PKCS#12 SafeContents decryption (PBE with SHA and 3-key 3DES or AES) ====================

async function decryptPBEData(
  encryptedData: Uint8Array,
  algorithmSeq: forge.asn1.Asn1,
  password: string
): Promise<Uint8Array> {
  const algValues = (algorithmSeq as any).value as forge.asn1.Asn1[];
  const oid = forge.asn1.derToOid(algValues[0]);

  // PBES2
  if (oid === "1.2.840.113549.1.5.13") {
    return decryptPBES2(encryptedData, algValues[1], password);
  }

  // PBE-SHA1-3DES (1.2.840.113549.1.12.1.3) - let forge handle it
  // PBE-SHA1-RC2-40 (1.2.840.113549.1.12.1.6) - let forge handle it
  if (oid === "1.2.840.113549.1.12.1.3" || oid === "1.2.840.113549.1.12.1.6") {
    const params = (algValues[1] as any).value as forge.asn1.Asn1[];
    const salt = forgeStringToBytes((params[0] as any).value as string);
    const iterations = forge.asn1.derToInteger(params[1]);
    const pwdBytes = passwordToBMPBytes(password);

    if (oid === "1.2.840.113549.1.12.1.3") {
      // 3-key 3DES-CBC
      const key = await pkcs12KDF("SHA-1", pwdBytes, salt, iterations, 1, 24);
      const iv = await pkcs12KDF("SHA-1", pwdBytes, salt, iterations, 2, 8);
      
      const cipher = forge.cipher.createDecipher("3DES-CBC", forge.util.createBuffer(key));
      cipher.start({ iv: forge.util.createBuffer(iv) });
      cipher.update(forge.util.createBuffer(encryptedData));
      cipher.finish();
      return forgeStringToBytes(cipher.output.getBytes());
    } else {
      // RC2-40-CBC
      const key = await pkcs12KDF("SHA-1", pwdBytes, salt, iterations, 1, 5);
      const iv = await pkcs12KDF("SHA-1", pwdBytes, salt, iterations, 2, 8);
      
      const cipher = forge.cipher.createDecipher("RC2-CBC" as any, forge.util.createBuffer(key));
      cipher.start({ iv: forge.util.createBuffer(iv) });
      cipher.update(forge.util.createBuffer(encryptedData));
      cipher.finish();
      return forgeStringToBytes(cipher.output.getBytes());
    }
  }

  throw new Error(`Algoritmo PBE não suportado: OID ${oid}`);
}

// ==================== Custom PKCS#12 Parser ====================

async function parsePfxCertificate(pfxBase64: string, password: string): Promise<CertificateData> {
  console.log(`[nfse-emission] Parsing PFX (base64 len: ${pfxBase64.length}, pwd len: ${password.length})`);

  // First try standard forge parsing (works for 3DES-encrypted PFX)
  try {
    return await parsePfxWithForge(pfxBase64, password);
  } catch (forgeError) {
    console.log(`[nfse-emission] Forge standard failed: ${(forgeError as Error).message}`);
    console.log("[nfse-emission] Trying custom ASN1 parser for AES-encrypted PFX...");
  }

  // Custom parser for AES-encrypted PKCS#12
  return await parsePfxCustom(pfxBase64, password);
}

async function parsePfxWithForge(pfxBase64: string, password: string): Promise<CertificateData> {
  const pfxDer = forge.util.decode64(pfxBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);
  } catch {
    p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
  }

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (!keyBag?.length || !keyBag[0].key) throw new Error("Chave privada não encontrada");
  const forgePrivateKey = keyBag[0].key as forge.pki.rsa.PrivateKey;

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];
  if (!certBag?.length || !certBag[0].cert) throw new Error("Certificado não encontrado");
  const cert = certBag[0].cert;

  return await buildCertDataFromForge(forgePrivateKey, cert);
}

async function parsePfxCustom(pfxBase64: string, password: string): Promise<CertificateData> {
  const pfxDer = forge.util.decode64(pfxBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfxSeq = (pfxAsn1 as any).value as forge.asn1.Asn1[];

  // PFX structure: version, authSafe, macData
  const authSafe = pfxSeq[1]; // ContentInfo
  const authSafeContent = (authSafe as any).value as forge.asn1.Asn1[];
  
  // Get content (OctetString wrapped in context [0])
  const contentWrapper = authSafeContent[1];
  let contentOctetString: forge.asn1.Asn1;
  if ((contentWrapper as any).type === 0xa0 || (contentWrapper as any).constructed) {
    contentOctetString = ((contentWrapper as any).value as forge.asn1.Asn1[])[0];
  } else {
    contentOctetString = contentWrapper;
  }

  // Parse the SEQUENCE OF SafeContents
  let authSafeData: forge.asn1.Asn1;
  if (typeof (contentOctetString as any).value === "string") {
    authSafeData = forge.asn1.fromDer((contentOctetString as any).value as string);
  } else {
    authSafeData = contentOctetString;
  }

  const safeContents = (authSafeData as any).value as forge.asn1.Asn1[];
  console.log(`[nfse-emission] Found ${safeContents.length} SafeContents`);

  let privateKeyCrypto: CryptoKey | null = null;
  let privateKeyPem = "";
  let certificate: forge.pki.Certificate | null = null;

  for (const safeContent of safeContents) {
    const contentInfo = (safeContent as any).value as forge.asn1.Asn1[];
    const contentTypeOid = forge.asn1.derToOid(contentInfo[0]);

    if (contentTypeOid === "1.2.840.113549.1.7.1") {
      // data - unencrypted SafeContents
      const dataWrapper = contentInfo[1];
      let dataOctet: forge.asn1.Asn1;
      if ((dataWrapper as any).constructed) {
        dataOctet = ((dataWrapper as any).value as forge.asn1.Asn1[])[0];
      } else {
        dataOctet = dataWrapper;
      }

      let safeBagsAsn1: forge.asn1.Asn1;
      if (typeof (dataOctet as any).value === "string") {
        safeBagsAsn1 = forge.asn1.fromDer((dataOctet as any).value as string);
      } else {
        safeBagsAsn1 = dataOctet;
      }

      const safeBags = (safeBagsAsn1 as any).value as forge.asn1.Asn1[];
      for (const bag of safeBags) {
        const result = await processSafeBag(bag, password);
        if (result.key) { privateKeyCrypto = result.key; privateKeyPem = result.keyPem!; }
        if (result.cert) certificate = result.cert;
      }
    } else if (contentTypeOid === "1.2.840.113549.1.7.6") {
      // encryptedData
      const encDataWrapper = contentInfo[1];
      let encDataSeq: forge.asn1.Asn1;
      if ((encDataWrapper as any).constructed && (encDataWrapper as any).type === 0xa0) {
        encDataSeq = ((encDataWrapper as any).value as forge.asn1.Asn1[])[0];
      } else {
        encDataSeq = encDataWrapper;
      }

      const encDataValues = (encDataSeq as any).value as forge.asn1.Asn1[];
      // version = encDataValues[0]
      const encContentInfo = encDataValues[1];
      const encContentValues = (encContentInfo as any).value as forge.asn1.Asn1[];

      // contentType, encAlgorithm, [0] encryptedContent
      const encAlgorithm = encContentValues[1];
      const encContent = encContentValues[2];

      const encBytes = forgeStringToBytes((encContent as any).value as string);
      
      try {
        const decryptedBytes = await decryptPBEData(encBytes, encAlgorithm, password);
        console.log(`[nfse-emission] Decrypted encryptedData: ${decryptedBytes.length} bytes`);

        const decryptedAsn1 = forge.asn1.fromDer(forge.util.createBuffer(decryptedBytes));
        const safeBags = (decryptedAsn1 as any).value as forge.asn1.Asn1[];
        for (const bag of safeBags) {
          const result = await processSafeBag(bag, password);
          if (result.key) { privateKeyCrypto = result.key; privateKeyPem = result.keyPem!; }
          if (result.cert) certificate = result.cert;
        }
      } catch (decErr) {
        console.warn(`[nfse-emission] Failed to decrypt encryptedData: ${(decErr as Error).message}`);
      }
    }
  }

  if (!privateKeyCrypto) throw new Error("Chave privada não encontrada no PFX (parser customizado)");
  if (!certificate) throw new Error("Certificado não encontrado no PFX (parser customizado)");

  const certificatePem = forge.pki.certificateToPem(certificate);
  const certAsn1 = forge.pki.certificateToAsn1(certificate);
  const certDerBytes = forge.asn1.toDer(certAsn1).getBytes();
  const certificateDer = new Uint8Array(certDerBytes.length);
  for (let i = 0; i < certDerBytes.length; i++) certificateDer[i] = certDerBytes.charCodeAt(i);

  const formatDN = (attrs: forge.pki.CertificateField[]) =>
    attrs.map(a => `${a.shortName}=${a.value}`).join(", ");

  console.log(`[nfse-emission] Custom parser OK: ${formatDN(certificate.subject.attributes)}, válido até ${certificate.validity.notAfter.toISOString()}`);

  return {
    privateKeyPem,
    certificatePem,
    certificateDer,
    privateKeyCrypto,
    serialNumber: certificate.serialNumber,
    issuerDN: formatDN(certificate.issuer.attributes),
    subjectDN: formatDN(certificate.subject.attributes),
    notAfter: certificate.validity.notAfter,
  };
}

async function processSafeBag(bag: forge.asn1.Asn1, password: string): Promise<{ key?: CryptoKey; keyPem?: string; cert?: forge.pki.Certificate }> {
  const bagValues = (bag as any).value as forge.asn1.Asn1[];
  const bagId = forge.asn1.derToOid(bagValues[0]);

  // PKCS8ShroudedKeyBag
  if (bagId === "1.2.840.113549.1.12.10.1.2") {
    console.log("[nfse-emission] Found PKCS8ShroudedKeyBag");
    const keyBagWrapper = bagValues[1];
    let keyBagAsn1: forge.asn1.Asn1;
    if ((keyBagWrapper as any).constructed && ((keyBagWrapper as any).type === 0xa0)) {
      keyBagAsn1 = ((keyBagWrapper as any).value as forge.asn1.Asn1[])[0];
    } else {
      keyBagAsn1 = keyBagWrapper;
    }

    // EncryptedPrivateKeyInfo: algorithm, encryptedData
    const epkiValues = (keyBagAsn1 as any).value as forge.asn1.Asn1[];
    const algorithm = epkiValues[0];
    const encData = forgeStringToBytes((epkiValues[1] as any).value as string);

    const decryptedPkcs8 = await decryptPBEData(encData, algorithm, password);
    console.log(`[nfse-emission] Decrypted PKCS8 key: ${decryptedPkcs8.length} bytes`);

    // Import to Web Crypto
    const key = await crypto.subtle.importKey(
      "pkcs8",
      decryptedPkcs8,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["sign"]
    );

    // Also create PEM
    const keyDer = await crypto.subtle.exportKey("pkcs8", key);
    const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(keyDer)));
    const keyPem = `-----BEGIN PRIVATE KEY-----\n${keyBase64.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----`;

    return { key, keyPem };
  }

  // CertBag
  if (bagId === "1.2.840.113549.1.12.10.1.3") {
    const certBagWrapper = bagValues[1];
    let certBagAsn1: forge.asn1.Asn1;
    if ((certBagWrapper as any).constructed && ((certBagWrapper as any).type === 0xa0)) {
      certBagAsn1 = ((certBagWrapper as any).value as forge.asn1.Asn1[])[0];
    } else {
      certBagAsn1 = certBagWrapper;
    }

    const certBagValues = (certBagAsn1 as any).value as forge.asn1.Asn1[];
    const certTypeOid = forge.asn1.derToOid(certBagValues[0]);

    if (certTypeOid === "1.2.840.113549.1.9.22.1") {
      // x509Certificate
      const certWrapper = certBagValues[1];
      let certOctet: forge.asn1.Asn1;
      if ((certWrapper as any).constructed) {
        certOctet = ((certWrapper as any).value as forge.asn1.Asn1[])[0];
      } else {
        certOctet = certWrapper;
      }

      const certDer = (certOctet as any).value as string;
      const certAsn1 = forge.asn1.fromDer(certDer);
      const cert = forge.pki.certificateFromAsn1(certAsn1);
      console.log(`[nfse-emission] Found certificate: ${cert.subject.getField("CN")?.value || "?"}`);
      return { cert };
    }
  }

  return {};
}

async function buildCertDataFromForge(forgePrivateKey: forge.pki.rsa.PrivateKey, cert: forge.pki.Certificate): Promise<CertificateData> {
  const privateKeyPem = forge.pki.privateKeyToPem(forgePrivateKey);
  const certificatePem = forge.pki.certificateToPem(cert);

  const certAsn1 = forge.pki.certificateToAsn1(cert);
  const certDerBytes = forge.asn1.toDer(certAsn1).getBytes();
  const certificateDer = new Uint8Array(certDerBytes.length);
  for (let i = 0; i < certDerBytes.length; i++) certificateDer[i] = certDerBytes.charCodeAt(i);

  const pkcs8Der = forge.asn1.toDer(forge.pki.privateKeyToAsn1(forgePrivateKey)).getBytes();
  const pkcs8Bytes = new Uint8Array(pkcs8Der.length);
  for (let i = 0; i < pkcs8Der.length; i++) pkcs8Bytes[i] = pkcs8Der.charCodeAt(i);
  const privateKeyCrypto = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  );

  const formatDN = (attrs: forge.pki.CertificateField[]) =>
    attrs.map(a => `${a.shortName}=${a.value}`).join(", ");

  console.log(`[nfse-emission] Forge OK: ${formatDN(cert.subject.attributes)}, válido até ${cert.validity.notAfter.toISOString()}`);

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
