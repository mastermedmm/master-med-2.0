

# Diagnóstico e Logging Detalhado para WhatsApp

## Situação Atual

A API da Meta retornou `200 OK` com `wamid` válidos para ambos os médicos. Isso confirma que credenciais e template estão corretos. O problema está na entrega pela Meta.

## Possíveis Causas (lado Meta)

- Template aprovado mas com variáveis em formato diferente do esperado (a mensagem chega vazia ou é bloqueada)
- O `Phone Number ID` aponta para um número de teste, não o de produção
- O número de telefone do WhatsApp Business não está verificado para envio em produção
- Limite de mensagens da conta Business (tier de envio)

## O que Vamos Fazer

### 1. Adicionar logging detalhado na Edge Function

Registrar na tabela `whatsapp_notifications_log` o **response body completo** da Meta (campo `meta_response`), para que possamos ver exatamente o que a Meta retornou, incluindo status de entrega.

### 2. Adicionar coluna `meta_response` à tabela

Nova migration para adicionar `meta_response jsonb` na tabela `whatsapp_notifications_log`.

### 3. Logar o payload enviado

Salvar também o payload do template enviado, para podermos comparar com o que a Meta espera.

## Alterações

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx_add_meta_response.sql` | Criar — adicionar coluna `meta_response` e `request_payload` |
| `supabase/functions/whatsapp-notify/index.ts` | Editar — salvar response body e request payload nos logs |

## Próximo Passo do Usuário

Após deploy, fazer um novo teste de rateio e verificar os dados completos na tabela `whatsapp_notifications_log` — isso revelará se a Meta está rejeitando silenciosamente ou se há outro problema.

Também recomendo verificar no **Meta Business Manager > WhatsApp Manager > Message Logs** usando os `wamid` retornados para ver o status real de entrega.

