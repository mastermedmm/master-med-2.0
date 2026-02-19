import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // Keep this list in sync with what supabase-js sends from the browser.
  // Missing headers here can make calls fail only in some browsers/environments.
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function validateSession(supabase: any, authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const sessionToken = authHeader.replace("Bearer ", "");

  const { data: session, error } = await supabase
    .from("doctor_sessions")
    .select("doctor_id, expires_at")
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (error || !session || new Date(session.expires_at) < new Date()) {
    return null;
  }

  return session.doctor_id;
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
    const doctorId = await validateSession(supabase, authHeader);

    if (!doctorId) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse action from request body or query param
    let action = "";
    if (req.method === "POST") {
      try {
        const body = await req.json();
        action = body.action || "";
      } catch {
        action = "";
      }
    }
    const url = new URL(req.url);
    if (!action) {
      action = url.searchParams.get("action") || "";
    }

    console.log(`doctor-portal-data request: doctor=${doctorId}, action=${action || '(empty)'}`);

    // POST with action: "summary" - Returns the 3 card totals
    if (action === "summary") {
      // Get all accounts payable for this doctor
      const { data: accountsPayable, error: apError } = await supabase
        .from("accounts_payable")
        .select(`
          id,
          amount_to_pay,
          expected_payment_date,
          status,
          paid_at,
          invoice_id,
          invoices (
            issue_date,
            company_name,
            hospital_name,
            status
          )
        `)
        .eq("doctor_id", doctorId);

      if (apError) {
        console.error("Error fetching accounts payable:", apError);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar dados" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get all payments for this doctor's accounts
      const accountIds = accountsPayable?.map(ap => ap.id) || [];
      let payments: any[] = [];

      if (accountIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select("account_payable_id, amount, reversed_at")
          .in("account_payable_id", accountIds)
          .is("reversed_at", null);

        if (!paymentsError) {
          payments = paymentsData || [];
        }
      }

      // Calculate payments by account
      const paymentsByAccount: Record<string, number> = {};
      for (const payment of payments) {
        const accountId = payment.account_payable_id;
        paymentsByAccount[accountId] = (paymentsByAccount[accountId] || 0) + Number(payment.amount);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let faturando = 0; // Pending to receive (invoice received by company)
      let recebido = 0;  // Already paid to doctor
      let atrasado = 0;  // Overdue

      for (const ap of accountsPayable || []) {
        const amountToPay = Number(ap.amount_to_pay);
        const paidAmount = paymentsByAccount[ap.id] || 0;
        const remainingAmount = amountToPay - paidAmount;
        const invoice = ap.invoices as any;

        // Recebido: sum of valid payments
        recebido += paidAmount;

        // Check if overdue
        const expectedDate = ap.expected_payment_date ? new Date(ap.expected_payment_date) : null;
        const isOverdue = expectedDate && expectedDate < today && ap.status !== 'pago';

        if (remainingAmount > 0) {
          if (isOverdue) {
            // Atrasado: past expected date and not fully paid
            atrasado += remainingAmount;
          } else if (invoice?.status === 'recebido' || ap.status === 'pendente' || ap.status === 'parcialmente_pago') {
            // Faturando: invoice received, waiting for doctor payment
            faturando += remainingAmount;
          }
        }
      }

      console.log(`Summary for doctor ${doctorId}: faturando=${faturando}, recebido=${recebido}, atrasado=${atrasado}`);

      return new Response(
        JSON.stringify({
          faturando,
          recebido,
          atrasado,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST with action: "entries" - Returns list of entries for the doctor
    if (action === "entries") {
      const { data: accountsPayable, error: apError } = await supabase
        .from("accounts_payable")
        .select(`
          id,
          allocated_net_value,
          admin_fee,
          amount_to_pay,
          expected_payment_date,
          status,
          paid_at,
          proportional_iss,
          proportional_deductions,
          invoices (
            id,
            issue_date,
            company_name,
            hospital_name,
            invoice_number,
            gross_value,
            net_value,
            status
          )
        `)
        .eq("doctor_id", doctorId)
        .order("created_at", { ascending: false });

      if (apError) {
        console.error("Error fetching entries:", apError);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar lançamentos" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get payments for these accounts
      const accountIds = accountsPayable?.map(ap => ap.id) || [];
      let payments: any[] = [];

      if (accountIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select("account_payable_id, amount, payment_date, reversed_at")
          .in("account_payable_id", accountIds)
          .is("reversed_at", null);

        if (!paymentsError) {
          payments = paymentsData || [];
        }
      }

      // Calculate payments and determine entry status
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const entries = (accountsPayable || []).map(ap => {
        const invoice = ap.invoices as any;
        const accountPayments = payments.filter(p => p.account_payable_id === ap.id);
        const paidAmount = accountPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const remainingAmount = Number(ap.amount_to_pay) - paidAmount;
        const lastPaymentDate = accountPayments.length > 0
          ? accountPayments.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0].payment_date
          : null;

        // Determine display status
        let displayStatus = ap.status;
        const expectedDate = ap.expected_payment_date ? new Date(ap.expected_payment_date) : null;

        if (ap.status === 'pago') {
          displayStatus = 'pago';
        } else if (expectedDate && expectedDate < today) {
          displayStatus = 'atrasado';
        } else if (paidAmount > 0 && remainingAmount > 0) {
          displayStatus = 'parcialmente_pago';
        } else if (invoice?.status === 'recebido' || ap.status === 'pendente') {
          displayStatus = 'pendente';
        } else {
          displayStatus = 'aguardando_recebimento';
        }

        return {
          id: ap.id,
          invoiceId: invoice?.id,
          issueDate: invoice?.issue_date,
          company: invoice?.company_name,
          hospital: invoice?.hospital_name,
          invoiceNumber: invoice?.invoice_number,
          grossValue: invoice?.gross_value,
          allocatedNetValue: ap.allocated_net_value,
          adminFee: ap.admin_fee,
          amountToPay: ap.amount_to_pay,
          paidAmount,
          remainingAmount,
          expectedPaymentDate: ap.expected_payment_date,
          paidAt: ap.paid_at || lastPaymentDate,
          status: displayStatus,
          proportionalIss: ap.proportional_iss,
          proportionalDeductions: ap.proportional_deductions,
        };
      });

      console.log(`Returning ${entries.length} entries for doctor ${doctorId}`);

      return new Response(
        JSON.stringify({ entries }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST with action: "settings" - Returns portal settings (banner, link)
    if (action === "settings") {
      // First get the doctor's tenant_id
      const { data: doctor, error: doctorError } = await supabase
        .from("doctors")
        .select("tenant_id")
        .eq("id", doctorId)
        .maybeSingle();

      if (doctorError || !doctor?.tenant_id) {
        console.error("Error fetching doctor tenant:", doctorError);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar tenant do médico" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch settings for this tenant
      const { data: settings, error: settingsError } = await supabase
        .from("system_settings")
        .select("key, value")
        .eq("tenant_id", doctor.tenant_id)
        .in("key", ["doctor_portal_link", "doctor_portal_banner"]);

      if (settingsError) {
        console.error("Error fetching settings:", settingsError);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar configurações" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const linkSetting = settings?.find(s => s.key === 'doctor_portal_link');
      const bannerSetting = settings?.find(s => s.key === 'doctor_portal_banner');

      console.log(`Settings for doctor ${doctorId} (tenant ${doctor.tenant_id}): link=${linkSetting?.value}, banner=${bannerSetting?.value ? 'yes' : 'no'}`);

      return new Response(
        JSON.stringify({
          link: linkSetting?.value || null,
          banner: bannerSetting?.value || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Endpoint não encontrado" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in doctor-portal-data:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
