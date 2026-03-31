import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("55")) digits = "55" + digits;
  return digits;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const whatsappToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!whatsappToken || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: "WhatsApp credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate user JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invoice_id, allocations, tenant_id } = await req.json();

    if (!invoice_id || !allocations?.length || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "Missing invoice_id, allocations or tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for data lookups
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if notifications are enabled
    const { data: setting } = await adminClient
      .from("system_settings")
      .select("value")
      .eq("tenant_id", tenant_id)
      .eq("key", "whatsapp_notifications_enabled")
      .maybeSingle();

    if (!setting || setting.value !== "true") {
      return new Response(
        JSON.stringify({ message: "WhatsApp notifications disabled", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get invoice data
    const { data: invoice, error: invoiceError } = await adminClient
      .from("invoices")
      .select("invoice_number, hospital_name, hospital_id")
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get hospital CNPJ
    let hospitalCnpj = "N/A";
    if (invoice.hospital_id) {
      const { data: hospital } = await adminClient
        .from("hospitals")
        .select("document")
        .eq("id", invoice.hospital_id)
        .single();
      if (hospital?.document) hospitalCnpj = hospital.document;
    }

    // Get all doctor IDs
    const doctorIds = allocations.map((a: any) => a.doctor_id);
    const { data: doctorsData } = await adminClient
      .from("doctors")
      .select("id, name, phone")
      .in("id", doctorIds);

    const doctorsMap = new Map(
      (doctorsData || []).map((d: any) => [d.id, d])
    );

    const results: any[] = [];

    for (const alloc of allocations) {
      const doctor = doctorsMap.get(alloc.doctor_id);
      if (!doctor || !doctor.phone) {
        // Log skipped - no phone
        await adminClient.from("whatsapp_notifications_log").insert({
          tenant_id,
          invoice_id,
          doctor_id: alloc.doctor_id,
          phone_number: doctor?.phone || "N/A",
          status: "skipped",
          error_message: "Médico sem telefone cadastrado",
        });
        results.push({ doctor_id: alloc.doctor_id, status: "skipped", reason: "no_phone" });
        continue;
      }

      const phone = normalizePhone(doctor.phone);
      const firstName = getFirstName(doctor.name);
      const amountFormatted = formatBRL(alloc.amount_to_pay);

      const payload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "notificacao_nf_criada",
          language: { code: "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: firstName },
                { type: "text", text: invoice.invoice_number },
                { type: "text", text: invoice.hospital_name },
                { type: "text", text: hospitalCnpj },
                { type: "text", text: amountFormatted },
              ],
            },
          ],
        },
      };

      try {
        const response = await fetch(
          `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${whatsappToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        const data = await response.json();

        if (response.ok) {
          const metaMessageId = data?.messages?.[0]?.id || null;
          await adminClient.from("whatsapp_notifications_log").insert({
            tenant_id,
            invoice_id,
            doctor_id: alloc.doctor_id,
            phone_number: phone,
            status: "sent",
            meta_message_id: metaMessageId,
          });
          results.push({ doctor_id: alloc.doctor_id, status: "sent", meta_message_id: metaMessageId });
        } else {
          const errorMsg = JSON.stringify(data?.error || data);
          await adminClient.from("whatsapp_notifications_log").insert({
            tenant_id,
            invoice_id,
            doctor_id: alloc.doctor_id,
            phone_number: phone,
            status: "failed",
            error_message: errorMsg,
          });
          results.push({ doctor_id: alloc.doctor_id, status: "failed", error: errorMsg });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        await adminClient.from("whatsapp_notifications_log").insert({
          tenant_id,
          invoice_id,
          doctor_id: alloc.doctor_id,
          phone_number: phone,
          status: "failed",
          error_message: errorMsg,
        });
        results.push({ doctor_id: alloc.doctor_id, status: "failed", error: errorMsg });
      }
    }

    const sentCount = results.filter((r) => r.status === "sent").length;

    return new Response(
      JSON.stringify({ message: `${sentCount} notificação(ões) enviada(s)`, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("WhatsApp notify error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
