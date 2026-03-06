import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// URL base da API Nacional NFS-e (ambiente de homologação)
const NFSE_API_BASE = "https://sefin.nfse.gov.br/sefinnacional";

interface DpsData {
  infDPS: {
    tpAmb: number; // 1=produção, 2=homologação
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
        vDescIncworking?: number;
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
    tomaEnd = `<end>
      ${toma.end.CEP ? `<CEP>${toma.end.CEP}</CEP>` : ""}
      ${toma.end.xLgr ? `<xLgr>${toma.end.xLgr}</xLgr>` : ""}
      ${toma.end.nro ? `<nro>${toma.end.nro}</nro>` : ""}
      ${toma.end.xBairro ? `<xBairro>${toma.end.xBairro}</xBairro>` : ""}
      ${toma.end.cMun ? `<cMun>${toma.end.cMun}</cMun>` : ""}
      ${toma.end.UF ? `<UF>${toma.end.UF}</UF>` : ""}
    </end>`;
  }

  let tribFed = "";
  if (val.trib.tribFed) {
    const tf = val.trib.tribFed;
    tribFed = `<tribFed>
      ${tf.pPIS !== undefined ? `<pPIS>${tf.pPIS}</pPIS><vPIS>${tf.vPIS}</vPIS>` : ""}
      ${tf.pCOFINS !== undefined ? `<pCOFINS>${tf.pCOFINS}</pCOFINS><vCOFINS>${tf.vCOFINS}</vCOFINS>` : ""}
      ${tf.pINSS !== undefined ? `<pINSS>${tf.pINSS}</pINSS><vINSS>${tf.vINSS}</vINSS>` : ""}
      ${tf.pIR !== undefined ? `<pIR>${tf.pIR}</pIR><vIR>${tf.vIR}</vIR>` : ""}
      ${tf.pCSLL !== undefined ? `<pCSLL>${tf.pCSLL}</pCSLL><vCSLL>${tf.vCSLL}</vCSLL>` : ""}
    </tribFed>`;
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

    // Auth client for user verification
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

    // Service role client for DB operations
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

    // 1. Buscar dados da nota fiscal
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

    // 2. Buscar dados do tomador
    let tomador = null;
    if (nota.tomador_id) {
      const { data } = await supabase
        .from("tomadores_nfse")
        .select("*")
        .eq("id", nota.tomador_id)
        .single();
      tomador = data;
    }

    // 3. Buscar dados do emitente (issuer) via tenant settings ou issuers table
    // Para simplificação, usamos os dados já presentes na nota
    const tenantId = nota.tenant_id;

    // 4. Gerar número sequencial da DPS
    const dpsNumber = `DPS-${Date.now()}`;

    // 5. Montar estrutura DPS
    const tomaDoc: Record<string, string> = {};
    if (tomador) {
      const doc = tomador.cpf_cnpj.replace(/\D/g, "");
      if (doc.length === 14) tomaDoc.CNPJ = doc;
      else tomaDoc.CPF = doc;
    }

    const dpsData: DpsData = {
      infDPS: {
        tpAmb: 2, // homologação
        dhEmi: new Date().toISOString(),
        verAplic: "MasterMed-1.0",
        serie: "NFS",
        nDPS: dpsNumber,
        dCompet: nota.data_emissao || new Date().toISOString().split("T")[0],
        tpEmit: 1,
        cLocEmi: nota.municipio_codigo || "0000000",
        prest: {
          CNPJ: "00000000000000", // será preenchido com dados reais do emitente
          xNome: "Prestador",
          end: {
            CEP: "00000000",
            xLgr: "",
            nro: "",
            xBairro: "",
            cMun: nota.municipio_codigo || "",
            UF: "",
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
          cMun: nota.municipio_codigo || undefined,
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
                    vPIS: nota.valor_pis,
                    pPIS: 0,
                    vCOFINS: nota.valor_cofins,
                    pCOFINS: 0,
                    vINSS: nota.valor_inss,
                    pINSS: 0,
                    vIR: nota.valor_ir,
                    pIR: 0,
                    vCSLL: nota.valor_csll,
                    pCSLL: 0,
                  }
                : undefined,
          },
        },
      },
    };

    // 6. Converter para XML
    const xmlDps = buildDpsXml(dpsData);

    // 7. Registrar DPS enviada
    const { data: dps, error: dpsInsertError } = await supabase
      .from("dps_enviadas")
      .insert({
        tenant_id: tenantId,
        nota_fiscal_id: nota_fiscal_id,
        status: "enviando",
        xml_envio: xmlDps,
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

    // 8. Enviar para a API Nacional NFS-e
    let apiResponse: { success: boolean; protocolo?: string; chaveAcesso?: string; xmlRetorno?: string; status?: string; motivo?: string } = {
      success: false,
    };

    try {
      // TODO: Substituir por chamada real à API Nacional NFS-e quando as credenciais estiverem configuradas
      // const nfseApiKey = Deno.env.get('NFSE_API_KEY');
      // const nfseCert = Deno.env.get('NFSE_CERTIFICATE');
      //
      // const response = await fetch(`${NFSE_API_BASE}/contribuinte/nfse`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/xml',
      //     'Authorization': `Bearer ${nfseApiKey}`,
      //   },
      //   body: xmlDps,
      // });
      //
      // const responseText = await response.text();
      // Parse response XML...

      // Simulação para ambiente de desenvolvimento
      const protocolo = `PROT-${Date.now()}`;
      const chaveAcesso = `NFSe-${tenantId.substring(0, 8)}-${Date.now()}`;
      apiResponse = {
        success: true,
        protocolo,
        chaveAcesso,
        xmlRetorno: `<nfseResultado><protocolo>${protocolo}</protocolo><chaveAcesso>${chaveAcesso}</chaveAcesso><status>autorizado</status></nfseResultado>`,
        status: "autorizado",
      };
    } catch (apiError) {
      console.error("Erro ao chamar API NFS-e:", apiError);
      apiResponse = {
        success: false,
        motivo: apiError instanceof Error ? apiError.message : "Erro desconhecido na API",
        status: "rejeitado",
      };
    }

    // 9. Atualizar DPS com retorno
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

    // 10. Atualizar status da nota fiscal
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

      // Salvar XML da NFS-e como documento
      if (apiResponse.xmlRetorno) {
        await supabase.from("documentos_nfse").insert([
          {
            tenant_id: tenantId,
            nota_fiscal_id,
            tipo: "xml_dps",
            nome_arquivo: `dps_${dpsNumber}.xml`,
            conteudo: xmlDps,
          },
          {
            tenant_id: tenantId,
            nota_fiscal_id,
            tipo: "xml_nfse",
            nome_arquivo: `nfse_${apiResponse.chaveAcesso}.xml`,
            conteudo: apiResponse.xmlRetorno,
          },
        ]);
      }

      // Registrar evento de autorização
      await supabase.from("eventos_nfse").insert({
        tenant_id: tenantId,
        nota_fiscal_id,
        tipo: "autorizacao",
        descricao: `NFS-e autorizada com protocolo ${apiResponse.protocolo}`,
        usuario_id: userId,
        codigo_retorno: apiResponse.protocolo,
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
    }

    // 11. Registrar log de integração
    await supabase.from("logs_integracao_nfse").insert({
      tenant_id: tenantId,
      nota_fiscal_id,
      operacao: "emissao_dps",
      endpoint: NFSE_API_BASE,
      sucesso: apiResponse.success,
      request_payload: xmlDps.substring(0, 5000),
      response_payload: apiResponse.xmlRetorno?.substring(0, 5000) || null,
      erro_mensagem: apiResponse.motivo || null,
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
