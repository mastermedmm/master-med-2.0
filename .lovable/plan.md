

# Verificar App vinculado ao número WhatsApp

## Situação

A Edge Function exige JWT para qualquer chamada, então não consigo executar `test_connection` para consultar os dados do Phone Number ID na Meta. Preciso de uma forma de validar as credenciais.

## O que os logs mostram

- A Meta retorna `200 OK` com `message_status: accepted` para todos os envios
- A Meta está normalizando os números (removendo o 9º dígito): `5554991896226` → `555491896226`
- Template `notificacao_nf_criada` com 5 parâmetros está sendo aceito

## Plano

### Alterar a Edge Function para permitir `test_connection` com validação simplificada

Mover o bloco `test_connection` para **antes** da validação de JWT, protegendo-o apenas com o `apikey` header (que já é enviado automaticamente pelo Supabase). Isso me permitirá chamar o endpoint de diagnóstico diretamente e verificar:

- `display_phone_number` — qual número está vinculado ao token
- `verified_name` — nome da empresa/app verificado
- `quality_rating` — qualidade da conta
- `name_status` — se o nome foi aprovado

Assim sabemos se o token pertence ao app correto e se o número é de produção.

### Alteração

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-notify/index.ts` | Mover `test_connection` para antes do check de JWT, adicionar campo `name_status` na query |

### Após o deploy

Chamarei o endpoint `test_connection` usando `curl_edge_functions` e analisarei a resposta da Meta para confirmar se o app e o número estão corretamente configurados.

