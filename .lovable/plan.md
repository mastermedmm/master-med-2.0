

# Adicionar `test_send` com template e testar para 5554991896226

## Contexto

Mensagens de texto simples só são entregues dentro da janela de 24h após última interação do usuário. Fora dela, apenas **templates aprovados** podem ser enviados. Portanto, o teste será feito exclusivamente com o template `notificacao_nf_criada`.

## Alteração

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-notify/index.ts` | Adicionar bloco `test_send` após o `test_connection` (protegido por `apikey`), que envia o template com dados fictícios para o número informado |

### Novo bloco `test_send`

Inserido após o bloco `test_connection` (~linha 80), antes da validação JWT:

```typescript
if (action === "test_send") {
  const requestApiKey = req.headers.get("apikey");
  const validApiKeys = [supabaseAnonKey, supabasePublishableKey].filter(Boolean);
  if (!requestApiKey || !validApiKeys.includes(requestApiKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { phone } = body;
  if (!phone) {
    return new Response(JSON.stringify({ error: "Missing phone" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const normalizedPhone = normalizePhone(phone);
  const payload = {
    messaging_product: "whatsapp",
    to: normalizedPhone,
    type: "template",
    template: {
      name: "notificacao_nf_criada",
      language: { code: "pt_BR" },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: "Teste" },
          { type: "text", text: "NF-0001" },
          { type: "text", text: "Hospital Teste" },
          { type: "text", text: "00.000.000/0001-00" },
          { type: "text", text: "R$ 100,00" },
        ]
      }]
    }
  };

  console.log("[whatsapp-notify] test_send to:", normalizedPhone);
  const res = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${whatsappToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log("[whatsapp-notify] test_send response:", res.status, JSON.stringify(data));

  return new Response(JSON.stringify({
    normalized_phone: normalizedPhone,
    request_payload: payload,
    meta_status: res.status,
    meta_response: data
  }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

## Após o deploy

Chamarei o endpoint com:
```json
{ "action": "test_send", "phone": "5554991896226" }
```

E analisarei a resposta da Meta para verificar se o template está sendo aceito e qual `wa_id` é retornado.

