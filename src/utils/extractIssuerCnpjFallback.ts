type ParentNode = Document | Element;

const normalizeCnpj = (value: string): string => {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length === 14 ? digits : '';
};

const findFirstByLocalName = (parent: ParentNode, localName: string): Element | null => {
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el?.localName === localName) return el;
  }
  return null;
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

const extractCnpjFromElement = (el: Element | null): string => {
  if (!el) return '';

  const candidates = [
    // Direto
    getTextByLocalName(el, 'CNPJ'),
    getTextByLocalName(el, 'Cnpj'),

    // Aninhado comum
    getNestedTextByLocalName(el, 'CpfCnpj', 'Cnpj'),
    getNestedTextByLocalName(el, 'CpfCnpj', 'CNPJ'),

    // Algumas variações
    getNestedTextByLocalName(el, 'IdentificacaoPrestador', 'Cnpj'),
    getNestedTextByLocalName(el, 'IdentificacaoPrestador', 'CNPJ'),
  ];

  for (const c of candidates) {
    const normalized = normalizeCnpj(c);
    if (normalized) return normalized;
  }
  return '';
};

/**
 * Fallback de extração do CNPJ do emitente para XMLs NFSe/GISS.
 * Usado quando o parser principal não retorna `companyCnpj`.
 */
export async function extractIssuerCnpjFallback(file: File): Promise<string> {
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const parseError = xml.querySelector('parsererror');
    if (parseError) return '';

    // 1) Excluir o CNPJ do tomador, caso exista (para evitar pegar o errado em listas)
    const tomadorEl =
      findFirstByLocalName(xml, 'Tomador') ||
      findFirstByLocalName(xml, 'TomadorServico') ||
      findFirstByLocalName(xml, 'toma') ||
      findFirstByLocalName(xml, 'dest');
    const tomadorCnpj = extractCnpjFromElement(tomadorEl);

    // 2) Prioridades do emitente (cobre SPED/NFSe Nacional + ABRASF + GISS)
    const emitenteCandidates: Array<Element | null> = [
      findFirstByLocalName(xml, 'emit'), // NFSe Nacional (SPED) / alguns NFSe
      findFirstByLocalName(xml, 'prest'), // NFSe Nacional (SPED)
      findFirstByLocalName(xml, 'PrestadorServico'), // ABRASF
      findFirstByLocalName(xml, 'Prestador'), // GISS (InfDeclaracaoPrestacaoServico)
    ];

    for (const el of emitenteCandidates) {
      const cnpj = extractCnpjFromElement(el);
      if (cnpj && cnpj !== tomadorCnpj) return cnpj;
    }

    // 3) Varre quaisquer tags CNPJ/Cnpj e pega a primeira válida (evita o do tomador quando possível)
    const all = xml.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el?.localName !== 'CNPJ' && el?.localName !== 'Cnpj') continue;
      const cnpj = normalizeCnpj(el.textContent ?? '');
      if (cnpj && cnpj !== tomadorCnpj) return cnpj;
    }

    // 4) Último recurso: regex no XML (ex.: quando o CNPJ aparece em texto/descrição)
    const matches = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}/g) ?? [];
    for (const m of matches) {
      const cnpj = normalizeCnpj(m);
      if (cnpj && cnpj !== tomadorCnpj) return cnpj;
    }

    return '';
  } catch {
    return '';
  }
}
