
## Correção: Linha extra no rateio travando o salvamento

### Problema
Quando o rateio ja esta completo (total bate com o bruto), o usuario ainda consegue ter adicionado uma linha extra antes do botao desabilitar. Essa linha vazia (valor 0,00, sem medico) faz a validacao falhar e o botao "Salvar" fica desabilitado sem explicacao clara.

### Solucao
Duas mudancas complementares:

1. **Impedir adicao quando total ja bateu** (ja implementado na ultima edicao) - manter o `disabled` no botao "Adicionar".

2. **Permitir remover linhas vazias sem bloquear** - Alterar a funcao `addAllocation` para verificar se ja existe alguma linha vazia/incompleta antes de adicionar outra. Se o usuario clicar "Adicionar" e ja tiver uma linha sem medico ou com valor zero, nao adicionar outra.

3. **Ignorar linhas vazias na validacao** - Filtrar linhas com valor `0,00` e sem medico antes de validar e salvar, para que linhas "fantasma" nao bloqueiem o processo.

### Detalhes tecnicos

**Arquivo: `src/pages/Allocation.tsx`**

- **`addAllocation`**: Adicionar verificacao - se ja existe linha com `doctorId` vazio ou `allocatedNetValue` igual a `'0,00'`, nao adicionar nova linha.

- **`isValid`**: Filtrar allocations que tenham `doctorId` vazio E `allocatedNetValue === '0,00'` (linhas completamente vazias) antes da validacao. Ou seja, linhas vazias sao ignoradas, mas linhas parcialmente preenchidas ainda sao validadas.

- **`handleSave`**: Filtrar as allocations vazias antes de salvar, enviando apenas as preenchidas.

- **Botao "Adicionar"**: Manter a condicao `disabled` existente e adicionar a condicao de linha vazia pendente.

Isso garante que o usuario nunca fique "travado" por causa de uma linha extra acidental.
