// サーバーから正確な時刻を取得する関数
export async function getCurrentTimeFromServer(): Promise<string> {
  try {
    const response = await fetch('/api/current-time', {
      cache: 'no-store', // 常に最新の時刻を取得
    })
    
    if (!response.ok) {
      throw new Error('サーバー時刻の取得に失敗しました')
    }
    
    const data = await response.json()
    return data.timestamp
  } catch (error) {
    console.error('サーバー時刻取得エラー:', error)
    // フォールバック：デバイス時刻を使用
    return new Date().toISOString()
  }
}

// 2つのISO文字列間の分数を計算するヘルパー関数
function calculateMinutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso)
  const end = new Date(endIso)
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60)))
}

// 分数を「X時間Y分」形式にフォーマットする関数
export function formatMinutesToTime(minutes: number): string {
  if (minutes < 0) return "0時間0分" // 負の時間は表示しない
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}時間${mins}分`
}

// 時刻を「HH:MM」形式にフォーマットする関数
export function formatTime(isoString: string): string {
  // データベースに保存されたUTC時刻をJSTで表示
  const date = new Date(isoString)
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo'
  })
}

// 今日の勤務時間を計算する関数
export function calculateTodayWorkTime(
  checkInTime?: string | null, // Allow null
  checkOutTime?: string | null, // Allow null
  breakStartTime?: string | null, // Allow null
  breakEndTime?: string | null
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
    const endTime = checkOutTime || new Date().toISOString()
    
    // 出勤時刻が退勤時刻より後の場合は0分とする
    const start = new Date(checkInTime)
    const end = new Date(endTime)
    
    if (start < end) {
      totalWorkMinutes = calculateMinutesBetween(checkInTime, endTime)
    } else {
      totalWorkMinutes = 0
    }
  }

  // 休憩時間の計算
  if (breakStartTime && breakEndTime) {
    breakMinutes = calculateMinutesBetween(breakStartTime, breakEndTime)
  } else if (breakStartTime && !breakEndTime) {
    // 休憩中の場合、現在時刻まで
    const now = new Date().toISOString()
    breakMinutes = calculateMinutesBetween(breakStartTime, now)
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