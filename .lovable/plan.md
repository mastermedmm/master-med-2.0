

# Correções na Edge Function `whatsapp-notify`

A implementação atual tem o mapeamento correto das 5 variáveis do template, mas contém **3 bugs** que impedirão o funcionamento em produção.

## Variáveis do Template — Mapeamento (correto)

| Variável | Valor enviado | Origem |
|----------|--------------|--------|
| `{{1}}` | `firstName` | Primeiro nome do médico (`doctors.name`, split por espaço) |
| `{{2}}` | `invoice.invoice_number` | Número da nota fiscal |
| `{{3}}` | `invoice.hospital_name` | Nome do hospital |
| `{{4}}` | `hospitalCnpj` | CNPJ do hospital (`hospitals.document` via `hospital_id`) |
| `{{5}}` | `amountFormatted` | Valor formatado em R$ (`formatBRL(amount_to_pay)`) |

O mapeamento está correto e alinhado com o template aprovado na Meta.

## Bugs a Corrigir

### 1. Import de CORS inválido
A linha `import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors"` não existe nesse path do esm.sh. Precisa definir `corsHeaders` manualmente.

### 2. `auth.getClaims()` não existe
O método `getClaims` não faz parte do supabase-js client. A validação de JWT deve usar `auth.getUser()` que valida o token automaticamente.

### 3. Possível `hospital_id` nulo
Se a invoice não tiver `hospital_id` preenchido, o CNPJ ficará "N/A". Isso já é tratado, mas precisamos garantir que funcione buscando pelo nome do hospital como fallback.

## Alterações

### Arquivo: `supabase/functions/whatsapp-notify/index.ts`

1. Remover import de corsHeaders e definir manualmente
2. Substituir `auth.getClaims()` por `auth.getUser()` para validação JWT
3. Adicionar fallback: se `hospital_id` não existir, buscar hospital pelo `hospital_name` para pegar o CNPJ

## Detalhes Técnicos

```text
ANTES (CORS):
  import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

DEPOIS:
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, ...',
  };

ANTES (Auth):
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(...)

DEPOIS:
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) { return 401 }

ANTES (Hospital CNPJ):
  Só busca por hospital_id

DEPOIS:
  Se hospital_id não existir, busca hospital por nome (hospital_name) como fallback
```

Nenhuma mudança no frontend — apenas correções na edge function.

