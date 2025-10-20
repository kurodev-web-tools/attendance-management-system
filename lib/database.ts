import { supabase, AttendanceRecord, BusyLevel } from './supabase'

// メールアドレスからUUIDを生成する関数（クライアントサイド対応）
// async function generateUserIdFromEmail(email: string): Promise<string> {
//   const encoder = new TextEncoder()
//   const data = encoder.encode(email)
//   const hashBuffer = await crypto.subtle.digest('SHA-256', data)
//   const hashArray = Array.from(new Uint8Array(hashBuffer))
//   const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
//   // UUID形式に変換 (8-4-4-4-12)
//   return `${hashHex.substring(0, 8)}-${hashHex.substring(8, 12)}-${hashHex.substring(12, 16)}-${hashHex.substring(16, 20)}-${hashHex.substring(20, 32)}`
// }

// 勤怠記録の保存
export async function saveAttendanceRecord(record: Partial<AttendanceRecord>) {
  // 時刻フィールドをJSTで正しく保存
  const cleanRecord = {
    ...record,
    check_in_time: record.check_in_time === undefined ? null : record.check_in_time,
    check_out_time: record.check_out_time === undefined ? null : record.check_out_time,
    break_start_time: record.break_start_time === undefined ? null : record.break_start_time,
    break_end_time: record.break_end_time === undefined ? null : record.break_end_time,
  }
  
  console.log('保存する勤怠データ:', cleanRecord)

  // 複数回の出退勤記録を保持するため、常に新しいレコードを挿入
  const { data, error } = await supabase
    .from('attendance_records')
    .insert(cleanRecord)
    .select()

  if (error) {
    console.error('勤怠記録の保存エラー:', error)
    throw error
  }

  return data
}

// 勤怠記録の取得（最新の記録を取得）
export async function getAttendanceRecord(userId: string, date: string) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false }) // 最新の記録を取得

  if (error) {
    console.error('勤怠記録の取得エラー:', error)
    throw error
  }

  // データが存在する場合は最新のレコードを返す
  const record = data && data.length > 0 ? data[0] : null
  console.log('取得した勤怠データ:', record)
  
  return record
}

// 忙しさレベルの保存
export async function saveBusyLevel(busyLevel: Partial<BusyLevel>) {
  const { data, error } = await supabase
    .from('busy_levels')
    .upsert(busyLevel, { 
      onConflict: 'user_id,date' // 重複時の処理を指定
    })
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

  if (error) {
    console.error('忙しさレベルの取得エラー:', error)
    throw error
  }

  // データが存在する場合は最初のレコードを返す
  return data && data.length > 0 ? data[0] : null
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
