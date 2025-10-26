import { AttendanceRecord } from './supabase'
import { calculateMinutesBetween } from './timeUtils'
import { logger } from './logger'

/**
 * 勤務記録から勤務時間を計算
 * @param records 勤怠記録の配列
 * @returns 総勤務時間（分）
 */
export function calculateWorkTimeFromRecords(
  records: AttendanceRecord[],
  isCurrentlyWorking = false
): number {
  if (!records || records.length === 0) {
    return 0
  }

  // 日付ごとにグループ化
  const recordsByDate = records.reduce((groups, record) => {
    const date = record.date
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(record)
    return groups
  }, {} as Record<string, AttendanceRecord[]>)

  let totalMinutes = 0

  // 各日の勤務時間を計算
  Object.values(recordsByDate).forEach(dayRecords => {
    const sortedRecords = dayRecords.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // 重複を除去してユニークな出退勤ペアを構築
    const uniqueRecords = new Map<string, AttendanceRecord>()

    sortedRecords.forEach(record => {
      if (record.check_in_time) {
        const key = `${record.check_in_time}`
        if (!uniqueRecords.has(key) || !uniqueRecords.get(key)?.check_out_time) {
          uniqueRecords.set(key, record)
        }
      }
    })

    // ユニークなレコードから勤務時間を計算
    uniqueRecords.forEach(record => {
      if (record.check_in_time && record.check_out_time) {
        // 完了したペアの場合
        const minutes = calculateMinutesBetween(record.check_in_time, record.check_out_time)
        totalMinutes += minutes

        logger.debug('勤務時間計算 [完了済み]:', {
          checkInTime: record.check_in_time,
          checkOutTime: record.check_out_time,
          minutes,
          totalMinutes,
        })
      } else if (record.check_in_time && !record.check_out_time && isCurrentlyWorking) {
        // 現在勤務中の場合
        const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
        const minutes = calculateMinutesBetween(record.check_in_time, now)
        totalMinutes += minutes

        logger.debug('勤務時間計算 [現在勤務中]:', {
          checkInTime: record.check_in_time,
          checkOutTime: '現在時刻',
          minutes,
          totalMinutes,
        })
      }
    })
  })

  logger.debug('累積勤務時間計算:', {
    recordsCount: records.length,
    isCurrentlyWorking,
    totalMinutes,
  })

  return totalMinutes
}

/**
 * 勤務日数を計算
 * @param records 勤怠記録の配列
 * @returns ユニークな勤務日数のセット
 */
export function calculateWorkDays(records: AttendanceRecord[]): Set<string> {
  const workDaysByDate = new Set<string>()

  records.forEach(record => {
    if (record.check_in_time) {
      workDaysByDate.add(record.date)
    }
  })

  return workDaysByDate
}
