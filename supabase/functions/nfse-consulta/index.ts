import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NFSE_API_BASE = "https://sefin.nfse.gov.br/sefinnacional";

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
    const { nota_fiscal_id, chave_acesso, protocolo } = await req.json();

    if (!nota_fiscal_id && !chave_acesso && !protocolo) {
      return new Response(
        JSON.stringify({ error: "Informe nota_fiscal_id, chave_acesso ou protocolo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar nota fiscal
    let nota;
    if (nota_fiscal_id) {
      const { data } = await supabase.from("notas_fiscais").select("*").eq("id", nota_fiscal_id).single();
      nota = data;
    } else if (chave_acesso) {
      const { data } = await supabase.from("notas_fiscais").select("*").eq("chave_acesso", chave_acesso).single();
      nota = data;
    }

    if (!nota) {
      return new Response(
        JSON.stringify({ error: "Nota fiscal não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Consultar API Nacional NFS-e real
    // const response = await fetch(`${NFSE_API_BASE}/contribuinte/nfse/${nota.chave_acesso}`, {
    //   method: 'GET',
    //   headers: { 'Authorization': `Bearer ${apiKey}` },
    // });

    // Simulação da consulta
    let statusNfse = nota.status;
    let xmlNfse = null;
    let numeroNfse = nota.numero_nfse;

    // Se a nota está em fila_emissao ou enviado, simular retorno
    if (nota.status === "fila_emissao" || nota.status === "enviado") {
      statusNfse = "autorizado";
      numeroNfse = `NFSE-${Date.now()}`;
      xmlNfse = `<nfse><numero>${numeroNfse}</numero><chaveAcesso>${nota.chave_acesso || ""}</chaveAcesso><status>autorizado</status></nfse>`;

      // Atualizar a nota
      await supabase
        .from("notas_fiscais")
        .update({
          status: "autorizado",
          numero_nfse: numeroNfse,
          data_autorizacao: new Date().toISOString(),
          xml_nfse: xmlNfse,
        })
        .eq("id", nota.id);

      // Salvar XML
      if (xmlNfse) {
        await supabase.from("documentos_nfse").insert({
          tenant_id: nota.tenant_id,
          nota_fiscal_id: nota.id,
          tipo: "xml_nfse",
          nome_arquivo: `nfse_${numeroNfse}.xml`,
          conteudo: xmlNfse,
        });
      }

      // Registrar evento
      await supabase.from("eventos_nfse").insert({
        tenant_id: nota.tenant_id,
        nota_fiscal_id: nota.id,
        tipo: "consulta",
        descricao: `Consulta retornou NFS-e autorizada: ${numeroNfse}`,
        usuario_id: userId,
      });
    }

    // Buscar DPS relacionada
    const { data: dps } = await supabase
      .from("dps_enviadas")
      .select("*")
      .eq("nota_fiscal_id", nota.id)
      .order("created_at", { ascending: false })
      .limit(1);

    // Buscar eventos
    const { data: eventos } = await supabase
      .from("eventos_nfse")
      .select("*")
      .eq("nota_fiscal_id", nota.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Log de integração
    await supabase.from("logs_integracao_nfse").insert({
      tenant_id: nota.tenant_id,
      nota_fiscal_id: nota.id,
      operacao: "consulta_nfse",
      endpoint: NFSE_API_BASE,
      sucesso: true,
    });

    return new Response(
      JSON.stringify({
        nota: {
          id: nota.id,
          status: statusNfse,
          numero_nfse: numeroNfse,
          chave_acesso: nota.chave_acesso,
          numero_dps: nota.numero_dps,
          data_autorizacao: nota.data_autorizacao,
          valor_servico: nota.valor_servico,
          valor_liquido: nota.valor_liquido,
        },
        dps: dps?.[0] || null,
        eventos: eventos || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no serviço de consulta NFS-e:", error);
    return new Response(
      JSON.stringify({
        error: "Erro interno no serviço de consulta",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
