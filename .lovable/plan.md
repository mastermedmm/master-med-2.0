

# Diagnóstico WhatsApp: Validar credenciais como o Disparo Pro faz

## Descobertas no Disparo Pro

O Disparo Pro valida a conexão chamando `GET https://graph.facebook.com/v21.0/{phone_number_id}?fields=verified_name,display_phone_number` antes de enviar mensagens. Se o token não tiver permissão para aquele Phone Number ID, a Meta retorna erro — mas no envio de mensagens pode retornar `200 OK` mesmo assim (aceita a requisição mas não entrega).

## Plano

### 1. Adicionar modo diagnóstico na Edge Function `whatsapp-notify`

Aceitar um parâmetro `action: "test_connection"` que faz exatamente o que o Disparo Pro faz: chama `GET /{phone_number_id}?fields=verified_name,display_phone_number` e retorna o resultado. Isso vai revelar:
- Se o token tem acesso ao Phone Number ID `1019527884576976`
- Qual o número real associado ao token
- O nome verificado da conta

### 2. Adicionar `console.log` de diagnóstico no envio

Logar `phoneNumberId`, a URL completa e o response body para confirmar os valores no runtime.

### 3. Chamar a Edge Function em modo teste

Usar `curl_edge_functions` com `action: "test_connection"` para ver a resposta em tempo real.

## Alterações

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-notify/index.ts` | Editar — adicionar action `test_connection` e `console.log` de diagnóstico |

## Detalhes técnicos

Na edge function, antes do fluxo de envio normal, verificar se `action === "test_connection"`:

```typescript
// Se action = test_connection, apenas validar credenciais
if (action === "test_connection") {
  const testRes = await fetch(
    `${WHATSAPP_API_URL}/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
    { headers: { Authorization: `Bearer ${whatsappToken}` } }
  );
  const testData = await testRes.json();
  console.log("[whatsapp-notify] test_connection response:", JSON.stringify(testData));
  return Response with testData;
}
```

No fluxo de envio, adicionar logs:
```typescript
console.log("[whatsapp-notify] phoneNumberId:", phoneNumberId);
console.log("[whatsapp-notify] token length:", whatsappToken?.length);
console.log("[whatsapp-notify] POST URL:", url);
console.log("[whatsapp-notify] Response:", response.status, JSON.stringify(data));
```

Depois do deploy, chamarei `test_connection` para revelar a causa raiz.

