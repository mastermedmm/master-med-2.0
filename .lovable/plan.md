

# Corrigir FK que impede exclusão de notas fiscais

## Problema

A tabela `whatsapp_notifications_log` tem uma foreign key `invoice_id` referenciando `invoices(id)` sem `ON DELETE CASCADE`. Ao tentar excluir uma invoice que já teve notificação WhatsApp enviada, o banco rejeita a operação.

Erro: `update or delete on table "invoices" violates foreign key constraint "whatsapp_notifications_log_invoice_id_fkey"`

## Solução

Uma migration que altera a FK para `ON DELETE CASCADE`, permitindo que os logs de notificação sejam automaticamente removidos quando a invoice é excluída.

## Alterações

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx_fix_whatsapp_log_fk_cascade.sql` | Criar — drop e recriar FK com ON DELETE CASCADE |

### SQL da Migration

```sql
ALTER TABLE public.whatsapp_notifications_log
  DROP CONSTRAINT whatsapp_notifications_log_invoice_id_fkey,
  ADD CONSTRAINT whatsapp_notifications_log_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_notifications_log
  DROP CONSTRAINT whatsapp_notifications_log_doctor_id_fkey,
  ADD CONSTRAINT whatsapp_notifications_log_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE;
```

Também ajusto a FK de `doctor_id` para CASCADE, evitando o mesmo problema ao excluir médicos.

