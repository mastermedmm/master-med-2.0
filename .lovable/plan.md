

# Criar Foreign Keys ausentes no banco de dados

## Problema

O erro "Could not find a relationship between 'revenues' and 'banks'" ocorre porque **nenhuma foreign key existe** no banco de dados. O Supabase/PostgREST usa foreign keys para resolver a sintaxe de joins como `banks(name)`. Sem elas, todas as queries com joins falham.

## O que sera feito

Criar uma migration SQL que adiciona todas as foreign keys necessarias para o funcionamento correto do sistema.

## Foreign Keys a criar

### Tabela `revenues`
| Coluna | Referencia |
|---|---|
| bank_id | banks.id |
| category_id | revenue_categories.id |
| tenant_id | tenants.id |

### Tabela `expenses`
| Coluna | Referencia |
|---|---|
| bank_id | banks.id |
| category_id | expense_categories.id |
| tenant_id | tenants.id |

### Tabela `payments`
| Coluna | Referencia |
|---|---|
| bank_id | banks.id |
| account_payable_id | accounts_payable.id |
| tenant_id | tenants.id |

### Tabela `invoice_receipts`
| Coluna | Referencia |
|---|---|
| bank_id | banks.id |
| invoice_id | invoices.id |
| tenant_id | tenants.id |

### Tabela `accounts_payable`
| Coluna | Referencia |
|---|---|
| doctor_id | doctors.id |
| invoice_id | invoices.id |
| allocation_id | invoice_allocations.id |
| tenant_id | tenants.id |

### Tabela `invoice_allocations`
| Coluna | Referencia |
|---|---|
| doctor_id | doctors.id |
| invoice_id | invoices.id |
| tenant_id | tenants.id |

### Tabela `receipt_payment_adjustments`
| Coluna | Referencia |
|---|---|
| bank_id | banks.id |
| invoice_id | invoices.id |
| account_payable_id | accounts_payable.id |
| tenant_id | tenants.id |

### Tabela `imported_transactions`
| Coluna | Referencia |
|---|---|
| bank_id | banks.id |
| import_id | bank_statement_imports.id |
| category_id | expense_categories.id |
| tenant_id | tenants.id |

### Tabela `bank_statement_imports`
| Coluna | Referencia |
|---|---|
| bank_id | banks.id |
| tenant_id | tenants.id |

### Tabela `invoices`
| Coluna | Referencia |
|---|---|
| hospital_id | hospitals.id |
| issuer_id | issuers.id |
| bank_id | banks.id |
| tenant_id | tenants.id |

### Tabela `expense_categories`
| Coluna | Referencia |
|---|---|
| group_id | expense_groups.id |
| tenant_id | tenants.id |

### Tabela `revenue_categories`
| Coluna | Referencia |
|---|---|
| group_id | revenue_groups.id |
| tenant_id | tenants.id |

### Outras tabelas
- `doctors.tenant_id` -> `tenants.id`
- `hospitals.tenant_id` -> `tenants.id`
- `issuers.tenant_id` -> `tenants.id`
- `banks.tenant_id` -> `tenants.id`
- `profiles.tenant_id` -> `tenants.id`
- `profiles.user_id` -> `auth.users.id`
- `user_roles.user_id` -> `auth.users.id`
- `user_roles.tenant_id` -> `tenants.id`
- `super_admins.user_id` -> `auth.users.id`

## Detalhes Tecnicos

- Uma unica migration SQL com todos os `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`
- Todas as FKs serao criadas com `ON DELETE CASCADE` ou `ON DELETE SET NULL` conforme apropriado (colunas nullable usam SET NULL, colunas NOT NULL usam CASCADE ou RESTRICT)
- Nenhuma alteracao de codigo e necessaria - as queries ja estao escritas corretamente, so faltavam as FKs no banco

## Resultado esperado

Apos a migration, o Fluxo de Caixa e os Ajustes de Recebimento/Pagamento passarao a carregar os dados corretamente com os joins funcionando.

