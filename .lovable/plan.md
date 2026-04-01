

# Consultar App ID vinculado ao WhatsApp Business

## Situação atual

O endpoint `test_connection` consulta `fields=verified_name,display_phone_number,quality_rating,name_status`, mas **não retorna o App ID**. Para obter essa informação, precisamos consultar o campo `application` no Phone Number ID.

Além disso, o `test_connection` está falhando por problema de apikey (os headers `apikey` e `Authorization` chegam como `undefined`). O `test_send` funciona porque removemos a validação de apikey dele.

## Plano

### Alterar `test_connection` para remover validação de apikey e incluir campo `application`

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-notify/index.ts` | Remover check de apikey no `test_connection` (mesmo padrão do `test_send`), adicionar `application` nos fields da query |

A query passará a ser:
```
fields=verified_name,display_phone_number,quality_rating,name_status,application
```

O campo `application` retorna `{ id: "APP_ID", link: "..." }` que é exatamente o App ID vinculado ao número.

### Após deploy

Chamarei `test_connection` e retornarei o App ID para você.

