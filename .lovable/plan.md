

## Impacto da reorganização de storage no módulo NFSE

### Situação atual — o que funciona e o que não funciona

O módulo NFSE **funciona parcialmente** sem as alterações de storage por emitente, mas há uma falha importante:

1. **Tela Emitir Nota** — O formulário já coleta `issuer_id` (empresa emissora), mas o campo **não é salvo** na tabela `notas_fiscais` porque a coluna `issuer_id` não existe nessa tabela. O `issuer_id` é simplesmente ignorado no payload de salvamento (linhas 208-231).

2. **Telas placeholder** — `NfseNotasEmitidas` e `NfseRejeicoes` ainda mostram "Em construção", independente dessa alteração.

3. **Documentos** — Funcionam, mas sem separação por emitente. Com 40 empresas, os XMLs ficam misturados.

4. **Dashboard, Eventos, Sincronização** — Funcionam normalmente.

### O que precisa ser feito

Duas alterações são necessárias para o módulo funcionar corretamente com múltiplos emitentes:

#### 1. Migration: adicionar `issuer_id` às tabelas

```sql
ALTER TABLE notas_fiscais ADD COLUMN issuer_id uuid REFERENCES issuers(id);
ALTER TABLE documentos_nfse ADD COLUMN issuer_id uuid REFERENCES issuers(id);
CREATE INDEX idx_notas_fiscais_issuer ON notas_fiscais(issuer_id);
CREATE INDEX idx_documentos_nfse_issuer ON documentos_nfse(issuer_id);
```

#### 2. Atualizar `NfseEmitir.tsx`

Incluir `issuer_id` no payload de salvamento do rascunho (linha ~208) e no envio para emissão.

#### 3. Atualizar Edge Function `nfse-emission`

Alterar o `basePath` do storage para incluir o issuer:
`{tenantId}/{issuerId}/{ano}/{mes}/{chave}/`

#### 4. Atualizar `NfseDocumentos.tsx`

Adicionar filtro por emitente (dropdown de issuers) e salvar `issuer_id` nos documentos.

#### 5. Implementar `NfseNotasEmitidas.tsx`

Substituir o placeholder por uma listagem real com filtro por emitente, status, período. Esta tela é independente da reorganização de storage mas completa o módulo.

#### 6. Implementar `NfseRejeicoes.tsx`

Substituir o placeholder por listagem de notas com `status = 'rejeitado'`, com filtro por emitente.

### Resumo

Sem essas alterações, o `issuer_id` selecionado na emissão é **perdido** — a nota é salva sem vínculo com o emitente. Isso impacta diretamente relatórios, filtros e organização dos documentos. As telas de Notas Emitidas e Rejeições também precisam ser implementadas.

