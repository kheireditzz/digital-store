-- ============================================
-- DIGITAL STORE - SUPABASE DATABASE SETUP
-- Jalankan ini di SQL Editor Supabase
-- ============================================

-- 1. Buat tabel products
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    link TEXT,
    image TEXT,
    featured BOOLEAN DEFAULT false,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 3. Buat policy: user hanya bisa lihat/edit produk miliknya sendiri
CREATE POLICY "Users can view own products" 
    ON products FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products" 
    ON products FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products" 
    ON products FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products" 
    ON products FOR DELETE 
    USING (auth.uid() = user_id);

-- 4. Buat function untuk auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Trigger auto-update
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Enable Realtime untuk products table
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- 7. Buat storage bucket untuk images (opsional, jika mau pakai Supabase Storage)
-- insert into storage.buckets (id, name, public) values ('products', 'products', true);
