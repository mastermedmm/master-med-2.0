import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NFSE_API_BASE = "https://sefin.nfse.gov.br/sefinnacional";

interface SyncResult {
  tenant_id: string;
  total_notas: number;
  atualizadas: number;
  canceladas: number;
  substituidas: number;
  erros: number;
  detalhes: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Support both authenticated (manual) and cron (no auth) calls
    let userId: string | null = null;
    let specificTenantId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ") && !authHeader.includes(supabaseAnonKey)) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await supabaseAuth.auth.getClaims(token);
      if (claimsData?.claims) {
        userId = claimsData.claims.sub as string;
      }
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // No body (cron call)
    }
    specificTenantId = (body.tenant_id as string) || null;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get tenants to sync
    let tenants: { id: string; name: string }[] = [];
    if (specificTenantId) {
      const { data } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("id", specificTenantId)
        .eq("status", "active")
        .single();
      if (data) tenants = [data];
    } else {
      const { data } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("status", "active");
      tenants = data || [];
    }

    const results: SyncResult[] = [];

    for (const tenant of tenants) {
      const result: SyncResult = {
        tenant_id: tenant.id,
        total_notas: 0,
        atualizadas: 0,
        canceladas: 0,
        substituidas: 0,
        erros: 0,
        detalhes: [],
      };

      // Create sync log entry
      const { data: syncLog } = await supabase
        .from("jobs_sincronizacao_nfse")
        .insert({
          tenant_id: tenant.id,
          tipo: "sincronizacao_automatica",
          status: "executando",
          created_by: userId,
          iniciado_em: new Date().toISOString(),
        })
        .select("id")
        .single();

      try {
        // 1. Buscar notas pendentes (enviado) - aguardando retorno da API
        // Notas em fila_emissao devem ser processadas pela nfse-emission, NÃO pela sync
        const { data: notasPendentes } = await supabase
          .from("notas_fiscais")
          .select("id, status, chave_acesso, numero_dps, numero_nfse, tomador_nome, valor_servico")
          .eq("tenant_id", tenant.id)
          .eq("status", "enviado");

        // 2. Buscar notas autorizadas para verificar eventos (cancelamento, substituição)
        const { data: notasAutorizadas } = await supabase
          .from("notas_fiscais")
          .select("id, status, chave_acesso, numero_nfse, tomador_nome, valor_servico, data_autorizacao")
          .eq("tenant_id", tenant.id)
          .eq("status", "autorizado");

        const todasNotas = [...(notasPendentes || []), ...(notasAutorizadas || [])];
        result.total_notas = todasNotas.length;

        for (const nota of todasNotas) {
          try {
            if (nota.status === "enviado" && nota.chave_acesso) {
              // TODO: Consultar status real na API Nacional NFS-e
              // const response = await fetch(
              //   `${NFSE_API_BASE}/contribuinte/nfse/${nota.chave_acesso}`,
              //   { headers: { 'Authorization': `Bearer ${apiKey}` } }
              // );
              // const apiData = await response.json();
              //
              // if (apiData.status === 'autorizado') {
              //   await supabase.from("notas_fiscais").update({
              //     status: "autorizado",
              //     numero_nfse: apiData.numero_nfse,
              //     data_autorizacao: apiData.data_autorizacao,
              //   }).eq("id", nota.id);
              //   result.atualizadas++;
              // } else if (apiData.status === 'rejeitado') {
              //   await supabase.from("notas_fiscais").update({
              //     status: "rejeitado",
              //     motivo_rejeicao: apiData.motivo,
              //   }).eq("id", nota.id);
              // }

              result.detalhes.push(
                `Nota ${nota.id} (enviado): aguardando implementação da consulta à API Nacional`
              );
            } else if (nota.status === "autorizado") {
              // TODO: Verificar eventos na API (cancelamento, substituição)
              // Quando implementado, registrar eventos e audit_logs
              // Sem chamada real, não alterar status
            }
          } catch (notaError) {
            result.erros++;
            result.detalhes.push(
              `Erro na nota ${nota.id}: ${notaError instanceof Error ? notaError.message : "Erro desconhecido"}`
            );
          }
        }

        // Atualizar job como concluído
        if (syncLog) {
          await supabase
            .from("jobs_sincronizacao_nfse")
            .update({
              status: "concluido",
              finalizado_em: new Date().toISOString(),
              dados: {
                total_notas: result.total_notas,
                atualizadas: result.atualizadas,
                canceladas: result.canceladas,
                substituidas: result.substituidas,
                erros: result.erros,
              },
            })
            .eq("id", syncLog.id);
        }

        // Registrar log de integração
        await supabase.from("logs_integracao_nfse").insert({
          tenant_id: tenant.id,
          operacao: "sincronizacao_automatica",
          endpoint: NFSE_API_BASE,
          sucesso: result.erros === 0,
          erro_mensagem: result.erros > 0 ? `${result.erros} erros durante sincronização` : null,
        });
      } catch (tenantError) {
        console.error(`Erro ao sincronizar tenant ${tenant.id}:`, tenantError);

        if (syncLog) {
          await supabase
            .from("jobs_sincronizacao_nfse")
            .update({
              status: "falha",
              finalizado_em: new Date().toISOString(),
              erro_ultima_tentativa:
                tenantError instanceof Error ? tenantError.message : "Erro desconhecido",
            })
            .eq("id", syncLog.id);
        }

        result.erros++;
        result.detalhes.push(
          `Erro geral: ${tenantError instanceof Error ? tenantError.message : "Erro desconhecido"}`
        );
      }

      results.push(result);
    }

    const totalAtualizadas = results.reduce((sum, r) => sum + r.atualizadas, 0);
    const totalErros = results.reduce((sum, r) => sum + r.erros, 0);

    console.log(
      `[nfse-sync] Sincronização concluída: ${tenants.length} tenants, ${totalAtualizadas} atualizadas, ${totalErros} erros`
    );

    return new Response(
      JSON.stringify({
        success: true,
        tenants_processados: tenants.length,
        total_atualizadas: totalAtualizadas,
        total_erros: totalErros,
        resultados: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no serviço de sincronização NFS-e:", error);
    return new Response(
      JSON.stringify({
        error: "Erro interno no serviço de sincronização",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
