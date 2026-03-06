import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const body = await req.json();
    const { action, nota_fiscal_id } = body;

    if (!nota_fiscal_id) {
      return new Response(
        JSON.stringify({ error: "nota_fiscal_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar nota
    const { data: nota, error: notaError } = await supabase
      .from("notas_fiscais")
      .select("*")
      .eq("id", nota_fiscal_id)
      .single();

    if (notaError || !nota) {
      return new Response(
        JSON.stringify({ error: "Nota fiscal não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "cancelar": {
        if (nota.status !== "autorizado") {
          return new Response(
            JSON.stringify({ error: "Apenas notas autorizadas podem ser canceladas" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { motivo } = body;
        if (!motivo || motivo.trim().length < 15) {
          return new Response(
            JSON.stringify({ error: "Motivo do cancelamento deve ter pelo menos 15 caracteres" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // TODO: Enviar evento de cancelamento à API Nacional NFS-e
        // const response = await fetch(`${NFSE_API_BASE}/contribuinte/nfse/${nota.chave_acesso}/cancelar`, { ... });

        await supabase
          .from("notas_fiscais")
          .update({ status: "cancelado" })
          .eq("id", nota_fiscal_id);

        await supabase.from("eventos_nfse").insert({
          tenant_id: nota.tenant_id,
          nota_fiscal_id,
          tipo: "cancelamento",
          descricao: `NFS-e cancelada. Motivo: ${motivo}`,
          usuario_id: userId,
          dados: { motivo },
        });

        await supabase.from("logs_integracao_nfse").insert({
          tenant_id: nota.tenant_id,
          nota_fiscal_id,
          operacao: "cancelamento_nfse",
          sucesso: true,
        });

        return new Response(
          JSON.stringify({ success: true, message: "NFS-e cancelada com sucesso" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "substituir": {
        if (nota.status !== "autorizado") {
          return new Response(
            JSON.stringify({ error: "Apenas notas autorizadas podem ser substituídas" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Marcar nota original como substituída
        await supabase
          .from("notas_fiscais")
          .update({ status: "substituido" })
          .eq("id", nota_fiscal_id);

        // Criar nova nota referenciando a substituída
        const { data: novaNota, error: novaNotaError } = await supabase
          .from("notas_fiscais")
          .insert({
            tenant_id: nota.tenant_id,
            status: "rascunho",
            nfse_substituida_id: nota_fiscal_id,
            valor_servico: nota.valor_servico,
            valor_deducoes: nota.valor_deducoes,
            valor_iss: nota.valor_iss,
            aliquota_iss: nota.aliquota_iss,
            valor_liquido: nota.valor_liquido,
            valor_pis: nota.valor_pis,
            valor_cofins: nota.valor_cofins,
            valor_inss: nota.valor_inss,
            valor_ir: nota.valor_ir,
            valor_csll: nota.valor_csll,
            iss_retido: nota.iss_retido,
            data_emissao: new Date().toISOString().split("T")[0],
            municipio_codigo: nota.municipio_codigo,
            municipio_nome: nota.municipio_nome,
            tomador_id: nota.tomador_id,
            tomador_nome: nota.tomador_nome,
            tomador_documento: nota.tomador_documento,
            descricao_servico: nota.descricao_servico,
            codigo_servico: nota.codigo_servico,
            codigo_cnae: nota.codigo_cnae,
            created_by: userId,
          })
          .select("id")
          .single();

        if (novaNotaError) {
          return new Response(
            JSON.stringify({ error: "Erro ao criar nota substituta", details: novaNotaError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase.from("eventos_nfse").insert({
          tenant_id: nota.tenant_id,
          nota_fiscal_id,
          tipo: "substituicao",
          descricao: `NFS-e substituída. Nova nota: ${novaNota.id}`,
          usuario_id: userId,
          dados: { nova_nota_id: novaNota.id },
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: "NFS-e marcada para substituição",
            nova_nota_id: novaNota.id,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "reprocessar": {
        if (nota.status !== "rejeitado") {
          return new Response(
            JSON.stringify({ error: "Apenas notas rejeitadas podem ser reprocessadas" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase
          .from("notas_fiscais")
          .update({ status: "fila_emissao", motivo_rejeicao: null })
          .eq("id", nota_fiscal_id);

        await supabase.from("eventos_nfse").insert({
          tenant_id: nota.tenant_id,
          nota_fiscal_id,
          tipo: "reprocessamento",
          descricao: "Nota reenviada para fila de emissão",
          usuario_id: userId,
        });

        return new Response(
          JSON.stringify({ success: true, message: "Nota reenviada para processamento" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}. Use: cancelar, substituir, reprocessar` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Erro no serviço de eventos NFS-e:", error);
    return new Response(
      JSON.stringify({
        error: "Erro interno no serviço de eventos",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
