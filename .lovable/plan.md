

# Limpeza de Usuarios por Empresa

## Situacao Atual e Acoes Necessarias

### GESTAOMED
- **Manter:** admgestaomed@email.com (admin)
- **Remover:** 3 usuarios extras (Manoel Jr duplicado, Viviane Bittecourt, Admin Gestao Med)

### MASTERMED
- **Manter:** admmastermed@email.com -- este usuario NAO tem role no MASTERMED atualmente (foi deletado anteriormente). Precisa ser adicionado.
- **Remover:** 1 usuario extra (Admin MasterMed)

### MAISMED
- **Manter:** maismedgestao@gmail.com (admin)
- **Remover:** 1 usuario extra (Admin MaisMed)

### MEDCENTER
- **Manter:** admmedcenter@email.com (admin)
- **Remover:** 1 usuario extra (Admin MedCenter)

### SAUDEMED (SAUDE)
- **Manter:** admsaude@email.com (admin)
- **Remover:** 1 usuario extra (Admin SaudeMed)

---

## Detalhes Tecnicos

Seriam executadas as seguintes operacoes SQL via migration:

1. **Inserir role admin para admmastermed@email.com no tenant MASTERMED** (user_id: `5c118377`, tenant_id: `a26d9ada-a015-4047-858c-30cbcb6c2303`)

2. **Deletar user_roles dos usuarios extras:**
   - GESTAOMED: user_ids `99b0f549`, `ec0f195d`, `00599427`
   - MASTERMED: user_id `7dabfe86`
   - MAISMED: user_id `b77d3436`
   - MEDCENTER: user_id `6913f27a`
   - SAUDEMED: user_id `fae36653`

Total: 7 registros removidos, 1 registro inserido.

> **Nota:** Isso remove apenas o acesso (user_roles). Os usuarios continuam existindo no auth.users e profiles, mas sem acesso a nenhuma empresa.

