-- ============================================================
-- LARBRAS — Schema Supabase (PostgreSQL)
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- ── Habilitar extensão UUID ────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tabela de perfis de usuário ────────────────────────────
-- Extende auth.users do Supabase com name, role e status
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('admin', 'gerente', 'marketing')),
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de vendas ───────────────────────────────────────
-- Armazena os pedidos sincronizados do Omiê ou importados via XLSX
CREATE TABLE IF NOT EXISTS public.sales (
  id          BIGSERIAL   PRIMARY KEY,
  omie_id     TEXT        UNIQUE,           -- nCodPed do Omiê (NULL = importação manual)
  data        DATE        NOT NULL,
  valor       NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  cliente     TEXT        NOT NULL DEFAULT 'Anônimo',
  produto     TEXT        NOT NULL DEFAULT 'Produto',
  marca       TEXT        NOT NULL DEFAULT 'S/Marca',
  vendedor    TEXT        NOT NULL DEFAULT 'N/A',
  bairro      TEXT        NOT NULL DEFAULT 'N/I',
  quantidade  INTEGER     NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  source      TEXT        NOT NULL DEFAULT 'omie' CHECK (source IN ('omie', 'upload')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance nas queries do dashboard
CREATE INDEX IF NOT EXISTS idx_sales_data     ON public.sales (data);
CREATE INDEX IF NOT EXISTS idx_sales_vendedor ON public.sales (vendedor);
CREATE INDEX IF NOT EXISTS idx_sales_produto  ON public.sales (produto);
CREATE INDEX IF NOT EXISTS idx_sales_bairro   ON public.sales (bairro);
CREATE INDEX IF NOT EXISTS idx_sales_source   ON public.sales (source);

-- ── Estado da sincronização ────────────────────────────────
-- Guarda a última data sincronizada para sync incremental
CREATE TABLE IF NOT EXISTS public.sync_state (
  id               INTEGER     PRIMARY KEY DEFAULT 1,
  last_synced_date DATE,                    -- última data de pedido sincronizada
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registro inicial
INSERT INTO public.sync_state (id, last_synced_date)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Log de sincronizações ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id              BIGSERIAL   PRIMARY KEY,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  status          TEXT        CHECK (status IN ('running', 'success', 'error')),
  records_synced  INTEGER     DEFAULT 0,
  date_from       DATE,
  date_to         DATE,
  error_msg       TEXT
);

-- ── Row Level Security ─────────────────────────────────────
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs  ENABLE ROW LEVEL SECURITY;

-- profiles: usuário vê e edita só o próprio perfil; service_role vê tudo
CREATE POLICY "Usuário lê próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- sales: qualquer usuário autenticado lê (filtragem de role feita no backend)
CREATE POLICY "Usuários autenticados leem vendas"
  ON public.sales FOR SELECT
  TO authenticated
  USING (true);

-- sales: somente service_role (backend) insere/atualiza
CREATE POLICY "Service role gerencia vendas"
  ON public.sales FOR ALL
  TO service_role
  USING (true);

-- sync_state e sync_logs: somente service_role
CREATE POLICY "Service role gerencia sync"
  ON public.sync_state FOR ALL TO service_role USING (true);
CREATE POLICY "Service role gerencia logs"
  ON public.sync_logs FOR ALL TO service_role USING (true);

-- ── Trigger: atualiza updated_at em profiles ───────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Função: cria perfil automaticamente no cadastro ────────
-- Executada pelo Supabase Auth quando um usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'marketing')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
