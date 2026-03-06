UPDATE notas_fiscais 
SET status = 'fila_emissao', 
    chave_acesso = NULL, 
    numero_nfse = NULL, 
    data_autorizacao = NULL,
    updated_at = now()
WHERE id = '1c17c722-aa44-4aac-b3e2-62b969c61f0b'
  AND chave_acesso LIKE 'CHAVE-%';