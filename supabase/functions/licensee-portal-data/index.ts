import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function validateSession(supabase: any, authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const sessionToken = authHeader.replace("Bearer ", "");
  const { data: session, error } = await supabase
    .from("licensee_sessions")
    .select("licensee_id, expires_at")
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (error || !session || new Date(session.expires_at) < new Date()) return null;
  return session.licensee_id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    const licenseeId = await validateSession(supabase, authHeader);

    if (!licenseeId) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let action = "";
    let filterMonth: number | null = null;
    let filterYear: number | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        action = body.action || "";
        filterMonth = body.month || null;
        filterYear = body.year || null;
      } catch { action = ""; }
    }

    console.log(`licensee-portal-data: licensee=${licenseeId}, action=${action}`);

    // Get licensee info (commission rate and tenant_id)
    const { data: licensee, error: licenseeError } = await supabase
      .from("licensees")
      .select("id, name, commission, tenant_id")
      .eq("id", licenseeId)
      .maybeSingle();

    if (licenseeError || !licensee) {
      return new Response(
        JSON.stringify({ error: "Licenciado não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST action: "doctors" - Returns doctors linked to this licensee with billing
    if (action === "doctors") {
      // Get all doctors linked to this licensee
      const { data: doctors, error: doctorsError } = await supabase
        .from("doctors")
        .select("id, name, crm, cpf")
        .eq("licensee_id", licenseeId)
        .eq("tenant_id", licensee.tenant_id);

      if (doctorsError) {
        console.error("Error fetching doctors:", doctorsError);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar médicos" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!doctors || doctors.length === 0) {
        return new Response(
          JSON.stringify({ doctors: [], summary: { totalBilling: 0, totalCommission: 0 } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const doctorIds = doctors.map(d => d.id);

      // Get all accounts_payable for these doctors, excluding cancelled
      // Build date range filter based on invoice issue_date
      let apQuery = supabase
        .from("accounts_payable")
        .select("id, doctor_id, amount_to_pay, status, invoice_id, invoices(gross_value, net_value, status, issue_date)")
        .in("doctor_id", doctorIds)
        .neq("status", "cancelado");

      const { data: accountsPayable, error: apError } = await apQuery;

      console.log(`Found ${accountsPayable?.length || 0} APs for doctors: ${doctorIds.join(', ')}`, JSON.stringify(accountsPayable?.map(ap => ({ id: ap.id, doctor_id: ap.doctor_id, invoice_id: ap.invoice_id, status: ap.status }))));

      if (apError) {
        console.error("Error fetching accounts payable:", apError);
      }

      // Separate cancelled APs and valid APs, applying month/year filter to both
      const allAPs = (accountsPayable || []);
      const cancelledAPs: any[] = [];
      const validAPs: any[] = [];

      for (const ap of allAPs) {
        const invoice = ap.invoices as any;
        // Apply month/year filter
        if (filterMonth && filterYear && invoice?.issue_date) {
          const issueDate = new Date(invoice.issue_date + 'T00:00:00');
          if (issueDate.getMonth() + 1 !== filterMonth || issueDate.getFullYear() !== filterYear) continue;
        }
        if (invoice?.status === 'cancelado' || ap.status === 'cancelado') {
          cancelledAPs.push(ap);
        } else {
          validAPs.push(ap);
        }
      }

      // Calculate total cancelled
      const totalCancelled = cancelledAPs.reduce((sum: number, ap: any) => {
        const invoice = ap.invoices as any;
        return sum + (Number(invoice?.gross_value) || 0);
      }, 0);

      console.log(`Valid APs: ${validAPs.length}, Cancelled APs: ${cancelledAPs.length}`);

      // Get payments for these accounts
      const accountIds = validAPs.map(ap => ap.id);
      let payments: any[] = [];
      if (accountIds.length > 0) {
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("account_payable_id, amount, reversed_at")
          .in("account_payable_id", accountIds)
          .is("reversed_at", null);
        payments = paymentsData || [];
      }

      const paymentsByAccount: Record<string, number> = {};
      for (const p of payments) {
        paymentsByAccount[p.account_payable_id] = (paymentsByAccount[p.account_payable_id] || 0) + Number(p.amount);
      }

      // Calculate per-doctor billing - commission based on rateio (amount_to_pay)
      const commissionRate = Number(licensee.commission) / 100;
      let totalBilling = 0;
      let totalCommission = 0;

      const doctorResults = doctors.map(doctor => {
        const doctorAPs = validAPs.filter(ap => ap.doctor_id === doctor.id);
        
        // Total gross billing from invoices
        const grossBilling = doctorAPs.reduce((sum, ap) => {
          const invoice = ap.invoices as any;
          return sum + (Number(invoice?.gross_value) || 0);
        }, 0);

        // Total amount from rateio (allocation)
        const totalAmountToPay = doctorAPs.reduce((sum, ap) => sum + Number(ap.amount_to_pay), 0);

        // Total paid
        const totalPaid = doctorAPs.reduce((sum, ap) => sum + (paymentsByAccount[ap.id] || 0), 0);

        // Commission based on gross billing
        const commission = grossBilling * commissionRate;

        totalBilling += grossBilling;
        totalCommission += commission;

        return {
          id: doctor.id,
          name: doctor.name,
          crm: doctor.crm,
          cpf: doctor.cpf,
          grossBilling,
          netAmount: totalAmountToPay,
          paidAmount: totalPaid,
          commission,
          allocationCount: doctorAPs.length,
        };
      });

      console.log(`Returning ${doctorResults.length} doctors for licensee ${licenseeId}`);

      return new Response(
        JSON.stringify({
          doctors: doctorResults,
          summary: { totalBilling, totalCommission, totalCancelled },
          commissionRate: licensee.commission,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação não encontrada" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in licensee-portal-data:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
