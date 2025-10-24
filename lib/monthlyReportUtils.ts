import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { AttendanceRecord } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { calculateMinutesBetween } from '@/lib/timeUtils'

export interface MonthlyReportData {
  totalWorkMinutes: number
  workDays: number
  averageWorkMinutes: number
  earliestCheckIn: string | null
  latestCheckOut: string | null
  longestWorkDay: number
  dailyData: DailyReportData[]
}

export interface DailyReportData {
  date: string
  workMinutes: number
  checkInTime: string | null
  checkOutTime: string | null
  isCompleteDay: boolean
}

export interface EmployeeList {
  user_id: string
  email: string
}

/**
 * 月次レポートデータを生成
 */
export async function generateMonthlyReport(
  userId: string,
  year: number,
  month: number
): Promise<MonthlyReportData> {
  // 月の開始日と終了日を取得
  const startDate = startOfMonth(new Date(year, month - 1))
  const endDate = endOfMonth(new Date(year, month - 1))
  
  // その月の勤怠データを取得
  const { data: attendanceData, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .gte('date', format(startDate, 'yyyy-MM-dd'))
    .lte('date', format(endDate, 'yyyy-MM-dd'))
    .order('created_at', { ascending: true })

  if (error) {
    console.error('勤怠データの取得エラー:', error)
    throw new Error('勤怠データの取得に失敗しました')
  }

  // 日別データを生成
  const dailyData = generateDailyData(startDate, endDate, attendanceData || [])
  
  // 集計データを計算
  const totalWorkMinutes = dailyData.reduce((sum, day) => sum + day.workMinutes, 0)
  const workDays = dailyData.filter(day => day.workMinutes > 0).length
  const averageWorkMinutes = workDays > 0 ? Math.round(totalWorkMinutes / workDays) : 0
  
  // 最速出勤・最遅退勤・最長勤務日を計算
  const { earliestCheckIn, latestCheckOut, longestWorkDay } = calculateExtremes(dailyData)

  return {
    totalWorkMinutes,
    workDays,
    averageWorkMinutes,
    earliestCheckIn,
    latestCheckOut,
    longestWorkDay,
    dailyData
  }
}

/**
 * 日別データを生成
 */
function generateDailyData(
  startDate: Date,
  endDate: Date,
  attendanceData: AttendanceRecord[]
): DailyReportData[] {
  const days = eachDayOfInterval({ start: startDate, end: endDate })
  
  return days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const dayRecords = attendanceData.filter(record => record.date === dateStr)
    
    if (dayRecords.length === 0) {
      return {
        date: dateStr,
        workMinutes: 0,
        checkInTime: null,
        checkOutTime: null,
        isCompleteDay: false
      }
    }

    // 1日の勤怠記録を処理（時系列順でソート）
    const sortedRecords = dayRecords.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    let totalWorkMinutes = 0
    let checkInTime: string | null = null
    let checkOutTime: string | null = null
    let isCompleteDay = false

    // 重複を除去してユニークな出退勤ペアを構築（メインページと同じロジック）
    const uniqueRecords = new Map<string, AttendanceRecord>()

    sortedRecords.forEach((record) => {
      if (record.check_in_time) {
        const key = `${record.check_in_time}`
        if (!uniqueRecords.has(key) || !uniqueRecords.get(key)!.check_out_time) {
          uniqueRecords.set(key, record)
        }
      }
    })

    // ユニークなレコードからdisplayRecordsを構築
    const displayRecords: AttendanceRecord[] = Array.from(uniqueRecords.values())

    // 総勤務時間を計算（HistoryViewと同じロジック）
    totalWorkMinutes = displayRecords.reduce((total, record) => {
      if (!record.check_in_time) return total
      
      let diffMinutes = 0
      
      if (record.check_out_time) {
        // 完了したペアの場合
        diffMinutes = calculateMinutesBetween(record.check_in_time, record.check_out_time)
      } else {
        // 現在勤務中の場合（退勤時刻がない）
        // 履歴表示では現在時刻ではなく、レコードの作成時刻を使用
        const lastRecord = sortedRecords[sortedRecords.length - 1]
        diffMinutes = calculateMinutesBetween(record.check_in_time, lastRecord.created_at)
      }
      
      return total + diffMinutes
    }, 0)

    // 最初の出勤時刻と最後の退勤時刻を取得
    if (displayRecords.length > 0) {
      const firstRecord = displayRecords[0]
      if (firstRecord.check_in_time) {
        checkInTime = firstRecord.check_in_time
      }
      const lastRecord = displayRecords[displayRecords.length - 1]
      if (lastRecord.check_out_time) {
        checkOutTime = lastRecord.check_out_time
        isCompleteDay = true
      }
    }

    return {
      date: dateStr,
      workMinutes: totalWorkMinutes,
      checkInTime,
      checkOutTime,
      isCompleteDay
    }
  })
}

/**
 * 最速出勤、最遅退勤、最長勤務日を計算
 */
function calculateExtremes(dailyData: DailyReportData[]) {
  let earliestCheckIn: string | null = null
  let latestCheckOut: string | null = null
  let longestWorkDay = 0

  dailyData.forEach(day => {
    if (day.checkInTime) {
      if (!earliestCheckIn || new Date(day.checkInTime) < new Date(earliestCheckIn)) {
        earliestCheckIn = day.checkInTime
      }
    }
    if (day.checkOutTime) {
      if (!latestCheckOut || new Date(day.checkOutTime) > new Date(latestCheckOut)) {
        latestCheckOut = day.checkOutTime
      }
    }
    if (day.workMinutes > longestWorkDay) {
      longestWorkDay = day.workMinutes
    }
  })

  return { earliestCheckIn, latestCheckOut, longestWorkDay }
}

export function formatMinutesToTime(minutes: number): string {
  if (isNaN(minutes) || minutes < 0) {
    return '0:00'
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}:${remainingMinutes.toString().padStart(2, '0')}`
}

export function formatDateJapanese(dateString: string): string {
  const date = parseISO(dateString)
  return format(date, 'M月d日(E)', { locale: ja })
}