-- user_settingsテーブルの作成
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    
    -- 勤務時間設定
    standard_work_hours INTEGER DEFAULT 8,
    recommended_start_time TEXT DEFAULT '09:00',
    recommended_end_time TEXT DEFAULT '18:00',
    break_duration INTEGER DEFAULT 60,
    
    -- 通知設定
    check_in_reminder_minutes INTEGER DEFAULT 30,
    check_out_reminder_minutes INTEGER DEFAULT 30,
    overtime_notification_hours INTEGER DEFAULT 8,
    long_work_notification_hours INTEGER DEFAULT 10,
    notification_enabled BOOLEAN DEFAULT true,
    
    -- 忙しさレベル設定
    busy_level_descriptions JSONB DEFAULT '{
        "0": "非常に暇",
        "25": "暇",
        "50": "普通",
        "75": "忙しい",
        "100": "非常に忙しい"
    }',
    busy_level_colors JSONB DEFAULT '{
        "0": "#10b981",
        "25": "#84cc16",
        "50": "#eab308",
        "75": "#f97316",
        "100": "#ef4444"
    }',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- RLS（Row Level Security）の設定
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ポリシーの作成（ユーザーは自分の設定のみアクセス可能）
CREATE POLICY "Users can view their own settings" ON public.user_settings
    FOR SELECT USING (auth.jwt() ->> 'email' = user_id);

CREATE POLICY "Users can insert their own settings" ON public.user_settings
    FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = user_id);

CREATE POLICY "Users can update their own settings" ON public.user_settings
    FOR UPDATE USING (auth.jwt() ->> 'email' = user_id);

CREATE POLICY "Users can delete their own settings" ON public.user_settings
    FOR DELETE USING (auth.jwt() ->> 'email' = user_id);

-- updated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON public.user_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();


