// 時間計算のユーティリティ関数

// 時間を分単位で計算する関数
export function calculateMinutesBetween(startTime: string, endTime: string): number {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const diffMs = end.getTime() - start.getTime()
  return Math.floor(diffMs / (1000 * 60)) // ミリ秒を分に変換
}

// 分を時間:分形式に変換する関数
export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}時間${mins}分`
}

// 分をHH:MM形式に変換する関数
export function formatMinutesToHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

// 今日の勤務時間を計算する関数
export function calculateTodayWorkTime(
  checkInTime?: string,
  checkOutTime?: string,
  breakStartTime?: string,
  breakEndTime?: string
): {
  totalWorkMinutes: number
  breakMinutes: number
  netWorkMinutes: number
  formattedWorkTime: string
  formattedBreakTime: string
  formattedNetWorkTime: string
} {
  // デフォルト値
  let totalWorkMinutes = 0
  let breakMinutes = 0
  let netWorkMinutes = 0

  // 出勤時刻がある場合
  if (checkInTime) {
    if (checkOutTime) {
      // 退勤時刻がある場合（勤務終了）
      const start = new Date(checkInTime)
      const end = new Date(checkOutTime)
      
      if (start < end) {
        totalWorkMinutes = calculateMinutesBetween(checkInTime, checkOutTime)
      } else {
        totalWorkMinutes = 0
      }
    } else {
      // 退勤時刻がない場合（勤務中）
      totalWorkMinutes = calculateMinutesBetween(checkInTime, new Date().toISOString())
    }
  }

  // 休憩時間の計算
  if (breakStartTime && breakEndTime) {
    breakMinutes = calculateMinutesBetween(breakStartTime, breakEndTime)
  } else if (breakStartTime && !breakEndTime) {
    // 休憩中の場合、現在時刻まで
    breakMinutes = calculateMinutesBetween(breakStartTime, new Date().toISOString())
  }

  // 実働時間の計算
  netWorkMinutes = Math.max(0, totalWorkMinutes - breakMinutes)

  return {
    totalWorkMinutes,
    breakMinutes,
    netWorkMinutes,
    formattedWorkTime: formatMinutesToTime(totalWorkMinutes),
    formattedBreakTime: formatMinutesToTime(breakMinutes),
    formattedNetWorkTime: formatMinutesToTime(netWorkMinutes)
  }
}

// 現在時刻を取得する関数
export function getCurrentTime(): string {
  return new Date().toISOString()
}

// 時間文字列をフォーマットする関数（JST対応）
export function formatTime(timeString: string): string {
  const date = new Date(timeString)
  // ローカルタイムゾーンで表示（JST）
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo'
  })
}
