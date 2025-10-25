import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 型定義
export interface User {
  id: string
  email: string
  name: string
  role: 'employee' | 'admin'
  created_at: string
  updated_at: string
}

export interface AttendanceRecord {
  id: string
  user_id: string
  date: string
  check_in_time?: string | null
  check_out_time?: string | null
  total_work_hours?: number
  created_at: string
  updated_at: string
}

export interface BusyLevel {
  id: string
  user_id: string
  date: string
  level: number
  comment?: string
  updated_at: string
}

export interface MonthlyReport {
  id: string
  year: number
  month: number
  user_id: string
  total_work_hours: number
  total_work_days: number
  average_busy_level: number
  report_data: Record<string, unknown>
  created_at: string
}

// 設定関連の型定義
export interface UserSettings {
  id: string
  user_id: string
  
  // 勤務時間設定
  standard_work_hours: number // 標準勤務時間（時間）
  recommended_start_time: string // 推奨出勤時刻（HH:MM）
  recommended_end_time: string // 推奨退勤時刻（HH:MM）
  break_duration: number // 休憩時間（分）
  
  // 通知設定
  check_in_reminder_minutes: number // 出勤リマインダー（分前）
  check_out_reminder_minutes: number // 退勤リマインダー（分前）
  overtime_notification_hours: number // 残業通知（時間超過時）
  long_work_notification_hours: number // 長時間勤務警告（時間超過時）
  notification_enabled: boolean // 通知有効/無効
  
  // 忙しさレベル設定
  busy_level_descriptions: {
    [key: number]: string // レベル別の説明文
  }
  busy_level_colors: {
    [key: number]: string // レベル別の色
  }
  
  created_at: string
  updated_at: string
}
