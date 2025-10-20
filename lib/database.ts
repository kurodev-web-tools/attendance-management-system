import { supabase, AttendanceRecord, BusyLevel } from './supabase'

// 勤怠記録の保存
export async function saveAttendanceRecord(record: Partial<AttendanceRecord>) {
  const { data, error } = await supabase
    .from('attendance_records')
    .upsert(record)
    .select()

  if (error) {
    console.error('勤怠記録の保存エラー:', error)
    throw error
  }

  return data
}

// 勤怠記録の取得
export async function getAttendanceRecord(userId: string, date: string) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('勤怠記録の取得エラー:', error)
    throw error
  }

  return data
}

// 忙しさレベルの保存
export async function saveBusyLevel(busyLevel: Partial<BusyLevel>) {
  const { data, error } = await supabase
    .from('busy_levels')
    .upsert(busyLevel)
    .select()

  if (error) {
    console.error('忙しさレベルの保存エラー:', error)
    throw error
  }

  return data
}

// 忙しさレベルの取得
export async function getBusyLevel(userId: string, date: string) {
  const { data, error } = await supabase
    .from('busy_levels')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('忙しさレベルの取得エラー:', error)
    throw error
  }

  return data
}

// ユーザーの勤怠履歴を取得
export async function getAttendanceHistory(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) {
    console.error('勤怠履歴の取得エラー:', error)
    throw error
  }

  return data
}

// ユーザーの忙しさレベル履歴を取得
export async function getBusyLevelHistory(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('busy_levels')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) {
    console.error('忙しさレベル履歴の取得エラー:', error)
    throw error
  }

  return data
}
