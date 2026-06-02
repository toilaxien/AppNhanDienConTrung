-- Run this in your Supabase SQL Editor

-- 1. Create Users Table
CREATE TABLE public.users (
  uid TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  total_points INTEGER DEFAULT 0,
  avatar_id INTEGER DEFAULT 1,
  role TEXT DEFAULT 'user'
);

-- 2. Create Insects Table
CREATE TABLE public.insects (
  id TEXT PRIMARY KEY,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  description TEXT NOT NULL,
  habitat TEXT NOT NULL,
  habitat_icon TEXT NOT NULL,
  role TEXT NOT NULL,
  role_icon TEXT NOT NULL,
  category_color TEXT NOT NULL,
  image_cartoon TEXT NOT NULL,
  lifecycle_steps JSONB DEFAULT '[]'::jsonb
);

-- 3. Create Collections Table
CREATE TABLE public.collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT REFERENCES public.users(uid) ON DELETE CASCADE,
  insect_id TEXT REFERENCES public.insects(id) ON DELETE CASCADE,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  photo_path TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

-- 4. Insert Initial Insect Data (Example)
INSERT INTO public.insects (id, name_vi, name_en, scientific_name, description, habitat, habitat_icon, role, role_icon, category_color, image_cartoon) VALUES
('ladybug', 'Bọ Rùa', 'Ladybug', 'Coccinellidae', 'Bọ rùa là những "hiệp sĩ" bảo vệ cây trồng, chúng rất thích ăn rệp cây.', 'Vườn cây', '🌿', 'Thiên địch', '🛡️', '#ef4444', 'https://cdn-icons-png.flaticon.com/512/1864/1864509.png'),
('butterfly', 'Bướm', 'Butterfly', 'Rhopalocera', 'Bướm có đôi cánh rực rỡ, chúng giúp thụ phấn cho hoa.', 'Đồng hoa', '🌸', 'Thụ phấn', '🌼', '#3b82f6', 'https://cdn-icons-png.flaticon.com/512/1864/1864486.png'),
('bee', 'Ong Mật', 'Honey Bee', 'Apis', 'Ong mật rất chăm chỉ, chúng hút mật hoa và làm ra mật ong ngọt ngào.', 'Tổ ong', '🍯', 'Thụ phấn', '🌼', '#eab308', 'https://cdn-icons-png.flaticon.com/512/1864/1864513.png'),
('dragonfly', 'Chuồn Chuồn', 'Dragonfly', 'Anisoptera', 'Chuồn chuồn là những phi công cừ khôi, chúng bay rất nhanh và bắt muỗi.', 'Ao hồ', '💧', 'Thiên địch', '🛡️', '#06b6d4', 'https://cdn-icons-png.flaticon.com/512/1864/1864516.png'),
('ant', 'Kiến', 'Ant', 'Formicidae', 'Kiến rất khỏe và có tinh thần đồng đội cao, chúng dọn dẹp thức ăn rơi vãi.', 'Mặt đất', '🪨', 'Dọn dẹp', '🧹', '#f97316', 'https://cdn-icons-png.flaticon.com/512/1864/1864505.png');

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- 6. Create Policies
-- Users can read all users (for leaderboard)
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid()::text = uid);
-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid()::text = uid);

-- Insects are readable by everyone
CREATE POLICY "Insects are viewable by everyone" ON public.insects FOR SELECT USING (true);

-- Collections are readable by everyone (or just the owner, depending on your preference)
CREATE POLICY "Collections are viewable by everyone" ON public.collections FOR SELECT USING (true);
-- Users can insert their own collections
CREATE POLICY "Users can insert own collections" ON public.collections FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Note: To allow local (unauthenticated) users to work temporarily, you might need to adjust RLS or use local storage for them as before.
