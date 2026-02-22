# SQL para rodar no Supabase

Rode **um arquivo por vez** no **SQL Editor** do Supabase, **na ordem** (01, 02, 03...).

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | `01_tabela_solicitacao_orcamento.sql` | Cria tabela e RLS (insert/select) de solicitações |
| 2 | `02_solicitacao_cep_endereco_data.sql` | Colunas CEP, endereço, data prevista |
| 3 | `03_solicitacao_update_delete_rls.sql` | Políticas para editar e excluir própria solicitação |
| 4 | `04_solicitacao_nome_censurado_listagem_publica.sql` | Nome censurado + listagem pública na home |
| 5 | `05_solicitacao_bairro.sql` | Coluna bairro (exibida no card) |
| 6 | `06_tabela_checkin.sql` | Tabela de check-in diário |
| 7 | `07_tabela_cupom.sql` | Tabela de cupons |
| 8 | `08_view_cupom_public.sql` | View para anônimos verem lista de cupons |

**Opcional:** para cadastrar um cupom de exemplo, rode no SQL Editor (troque `UUID-DA-CIDADE` pelo id da cidade):

```sql
INSERT INTO cupom (cidade_id, titulo, descricao, codigo, codigo_censurado, checkins_necessarios, ativo)
VALUES (
  'UUID-DA-CIDADE',
  '10% no primeiro pedido',
  'Válido em parceiros da cidade',
  'BEMVINDO10',
  '••••••••10',
  7,
  true
);
```
