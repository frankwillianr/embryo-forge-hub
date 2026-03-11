-- Expande categorias principais do Marketplace Local (Desapega)
-- Inclui Videogame e mais categorias frequentes de compra e venda.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'rel_cidade_desapega_categoria'
  ) THEN
    -- Atualiza icone/ordem para categorias ja existentes
    WITH categorias(nome, icone, ordem) AS (
      VALUES
        ('Eletronicos', '🔌', 1),
        ('Celulares', '📱', 2),
        ('Informatica', '💻', 3),
        ('Videogame', '🎮', 4),
        ('Moveis', '🪑', 5),
        ('Eletrodomesticos', '🧊', 6),
        ('Casa e Decoracao', '🏠', 7),
        ('Moda e Acessorios', '👕', 8),
        ('Infantil', '🧸', 9),
        ('Esporte e Lazer', '⚽', 10),
        ('Automotivo', '🚗', 11),
        ('Beleza e Saude', '💄', 12),
        ('Ferramentas', '🧰', 13),
        ('Livros', '📚', 14)
    )
    UPDATE public.rel_cidade_desapega_categoria AS c
    SET
      icone = v.icone,
      ordem = v.ordem
    FROM categorias AS v
    WHERE lower(c.nome) = lower(v.nome);

    -- Insere categorias faltantes
    INSERT INTO public.rel_cidade_desapega_categoria (nome, icone, ordem)
    SELECT v.nome, v.icone, v.ordem
    FROM (
      VALUES
        ('Eletronicos', '🔌', 1),
        ('Celulares', '📱', 2),
        ('Informatica', '💻', 3),
        ('Videogame', '🎮', 4),
        ('Moveis', '🪑', 5),
        ('Eletrodomesticos', '🧊', 6),
        ('Casa e Decoracao', '🏠', 7),
        ('Moda e Acessorios', '👕', 8),
        ('Infantil', '🧸', 9),
        ('Esporte e Lazer', '⚽', 10),
        ('Automotivo', '🚗', 11),
        ('Beleza e Saude', '💄', 12),
        ('Ferramentas', '🧰', 13),
        ('Livros', '📚', 14)
    ) AS v(nome, icone, ordem)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.rel_cidade_desapega_categoria c
      WHERE lower(c.nome) = lower(v.nome)
    );
  END IF;
END $$;
