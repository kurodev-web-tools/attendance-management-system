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
  break_start_time?: string | null
  break_end_time?: string | null
  total_work_hours?: number
  total_break_hours?: number
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
