-- ============================================
-- SALIBA ERP — Banco de Dados
-- Cola isso no SQL Editor do Supabase e clica Run
-- ============================================

-- Produtos
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) DEFAULT 0,
  category TEXT DEFAULT 'Camiseta',
  emoji TEXT DEFAULT '👕',
  costs JSONB DEFAULT '{"molde":0,"corte":0,"tecido":0,"costura":0,"estampas":0,"transporte":0,"insumo":0}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  client TEXT NOT NULL,
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  qty INTEGER DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'Orçamento',
  date DATE DEFAULT CURRENT_DATE,
  prazo DATE,
  costs JSONB DEFAULT '{}',
  custo_real JSONB,
  lucro_p NUMERIC(5,2) DEFAULT 25,
  imposto_p NUMERIC(5,2) DEFAULT 8,
  mock_image TEXT,
  parcela1 JSONB DEFAULT '{"valor":0,"data":"","pago":false}',
  parcela2 JSONB DEFAULT '{"valor":0,"data":"","pago":false}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ordens de Produção
CREATE TABLE production_orders (
  id TEXT PRIMARY KEY,
  pedido_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  client TEXT NOT NULL,
  product TEXT NOT NULL,
  qty INTEGER DEFAULT 0,
  sectors JSONB DEFAULT '{"corte":"pendente","estamparia":"pendente","costura":"pendente","acabamento":"pendente"}',
  custos_reais JSONB DEFAULT '{"molde":0,"corte":0,"tecido":0,"costura":0,"estampas":0,"transporte":0,"insumo":0}',
  ficha JSONB DEFAULT '{}',
  enfesto TEXT DEFAULT '',
  total_cortado TEXT DEFAULT '',
  total_silkado TEXT DEFAULT '',
  total_costurado TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  empresa TEXT DEFAULT '',
  contexto TEXT DEFAULT '',
  ultimo_contato DATE,
  fup TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atividades (calendário)
CREATE TABLE activities (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security) 
-- Por enquanto liberado pra todos (depois a gente restringe por usuário)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Policies públicas (acesso total por enquanto)
CREATE POLICY "public_all" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON production_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON activities FOR ALL USING (true) WITH CHECK (true);

-- Inserir produtos base
INSERT INTO products (name, price, category, emoji, costs) VALUES
  ('Moletom Crewneck', 89.90, 'Moletom', '🧥', '{"molde":5,"corte":8,"tecido":28,"costura":18,"estampas":12,"transporte":3,"insumo":3}'),
  ('Tote Bag Algodão', 45.00, 'Acessório', '👜', '{"molde":3,"corte":5,"tecido":22,"costura":15,"estampas":18,"transporte":3,"insumo":2}'),
  ('Corta-Vento', 95.50, 'Jaqueta', '🧥', '{"molde":6,"corte":10,"tecido":35,"costura":22,"estampas":10,"transporte":4,"insumo":3}'),
  ('Camiseta Polo', 55.00, 'Camiseta', '👔', '{"molde":3,"corte":5,"tecido":18,"costura":12,"estampas":8,"transporte":3,"insumo":2}'),
  ('Bomber', 165.00, 'Jaqueta', '🧥', '{"molde":8,"corte":12,"tecido":45,"costura":28,"estampas":15,"transporte":5,"insumo":3}'),
  ('Camiseta', 39.90, 'Camiseta', '👕', '{"molde":2,"corte":4,"tecido":15,"costura":10,"estampas":8,"transporte":3,"insumo":2}');
