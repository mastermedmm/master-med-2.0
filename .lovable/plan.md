

# Notificações WhatsApp para Médicos ao Salvar Rateio

## Resumo

Quando o rateio (Allocation) de uma nota fiscal for salvo, o sistema enviará automaticamente uma mensagem WhatsApp para cada médico vinculado, usando o template `notificacao_nf_criada` da Meta. O envio pode ser ativado/desativado nas Configurações do tenant.

## Variáveis do Template

| Variável | Origem |
|----------|--------|
| `{{1}}` — Primeiro nome do médico | `doctors.name` (primeiro token) |
| `{{2}}` — Nº da nota fiscal | `invoices.invoice_number` |
| `{{3}}` — Nome do hospital | `invoices.hospital_name` |
| `{{4}}` — CNPJ do hospital | `hospitals.document` (lookup por `hospital_name`) |
| `{{5}}` — Valor líquido (R$) | `amount_to_pay` da alocação do médico |

## Arquitetura

```text
┌─────────────────────┐       ┌──────────────────────┐       ┌──────────────────┐
│  Frontend           │       │  Edge Function        │       │  Meta WhatsApp   │
│  Allocation.tsx      │──────▶│  whatsapp-notify      │──────▶│  Cloud API       │
│  (após salvar rateio)│       │  (para cada médico)   │       │  graph.facebook  │
└─────────────────────┘       └──────────────────────┘       └──────────────────┘
```

## Etapas de Implementação

### 1. Configurar Secrets no Supabase
- `WHATSAPP_ACCESS_TOKEN` — Token permanente da Meta
- `WHATSAPP_PHONE_NUMBER_ID` — Phone Number ID da conta Business

### 2. Toggle na Página de Configurações
- Adicionar um switch "Notificações WhatsApp" na página `Settings.tsx`
- Usa `system_settings` com key `whatsapp_notifications_enabled` (valor `"true"` ou `"false"`)
- Exibir campos para o número do WhatsApp Business (Phone Number ID) caso queira configurar pelo painel

### 3. Criar Edge Function `whatsapp-notify`
- Recebe: `{ invoice_id, allocations: [{ doctor_id, amount_to_pay }] }`
- Para cada médico:
  - Busca `doctors` para obter `name` e `phone`
  - Busca `invoices` para obter `invoice_number`, `hospital_name`
  - Busca `hospitals` pelo nome para obter o CNPJ
  - Formata o telefone para formato internacional (55 + DDD + número)
  - Chama `https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages` com:
    ```json
    {
      "messaging_product": "whatsapp",
      "to": "5511999999999",
      "type": "template",
      "template": {
        "name": "notificacao_nf_criada",
        "language": { "code": "pt_BR" },
        "components": [{
          "type": "body",
          "parameters": [
            { "type": "text", "text": "João" },
            { "type": "text", "text": "12345" },
            { "type": "text", "text": "Hospital X" },
            { "type": "text", "text": "12.345.678/0001-00" },
            { "type": "text", "text": "R$ 5.000,00" }
          ]
        }]
      }
    }
    ```
  - Registra log de envio (sucesso/erro) para cada médico
- Autenticação: valida JWT do usuário antes de processar

### 4. Tabela de Log de Notificações (Migration)
- Nova tabela `whatsapp_notifications_log`:
  - `id`, `tenant_id`, `invoice_id`, `doctor_id`, `phone_number`, `status` (sent/failed/delivered), `error_message`, `meta_message_id`, `created_at`
- RLS: tenant users can manage/view

### 5. Integrar no Fluxo de Rateio
- Em `Allocation.tsx`, após salvar com sucesso as alocações:
  - Verificar se `whatsapp_notifications_enabled` está ativo (consulta `system_settings`)
  - Se ativo, chamar `supabase.functions.invoke('whatsapp-notify', { body: { invoice_id, allocations } })`
  - Não bloqueia o fluxo — o envio é fire-and-forget com toast informativo

### 6. Formatação do Telefone
- O campo `doctors.phone` pode ter formatos variados
- A edge function normaliza: remove caracteres não numéricos, adiciona `55` se necessário

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-notify/index.ts` | Criar |
| `supabase/migrations/xxx_whatsapp_notifications_log.sql` | Criar |
| `src/pages/Allocation.tsx` | Editar — chamar edge function após salvar |
| `src/pages/Settings.tsx` | Editar — adicionar toggle WhatsApp |

## Pré-requisitos do Usuário
- Adicionar os secrets `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` no Supabase
- Garantir que os médicos tenham o campo `phone` preenchido com DDD

