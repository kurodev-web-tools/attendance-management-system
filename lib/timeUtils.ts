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
    return new Date().toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'})
  }
}

// 2つの時刻文字列間の分数を計算するヘルパー関数（日本時間固定）
export function calculateMinutesBetween(startTime: string, endTime: string): number {
  try {
    // 時刻文字列を分に変換する関数
    const timeToMinutes = (timeStr: string): number => {
      if (!timeStr) return 0
      
      // ISO形式の場合（例：2025-10-23T23:22:00）
      if (timeStr.includes('T')) {
        const timePart = timeStr.split('T')[1]?.substring(0, 8) || '00:00:00'
        const [hours, minutes] = timePart.split(':').map(Number)
        return hours * 60 + minutes
      }
      
      // スラッシュ形式の場合（例：2025/10/23 23:22:00）
      if (timeStr.includes('/')) {
        const timeMatch = timeStr.match(/(\d{2}:\d{2}):\d{2}/)
        if (timeMatch) {
          const [hours, minutes] = timeMatch[1].split(':').map(Number)
          return hours * 60 + minutes
        }
      }
      
      // 時刻形式の場合（例：23:22:00）
      if (timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':').map(Number)
        return hours * 60 + minutes
      }
      
      return 0
    }
    
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = timeToMinutes(endTime)
    
    if (startMinutes === 0 || endMinutes === 0) {
      console.error('無効な時刻:', { startTime, endTime })
      return 0
    }
    
    const diffMinutes = Math.max(1, endMinutes - startMinutes)
    console.log(`calculateMinutesBetween - ${startTime} to ${endTime}: ${diffMinutes}分`)
    return diffMinutes
  } catch (error) {
    console.error('calculateMinutesBetween エラー:', error)
    return 0
  }
}

// 分数を「X時間Y分」形式にフォーマットする関数
export function formatMinutesToTime(minutes: number): string {
  if (minutes < 0) return "0時間0分" // 負の時間は表示しない
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}時間${mins}分`
}

// 時刻を「HH:MM」形式にフォーマットする関数（日本時間固定）
export function formatTime(timeString: string): string {
  try {
    if (!timeString) return '--:--'
    
    console.log(`formatTime - 入力: ${timeString}`)
    
    // 時刻文字列から時刻部分を抽出
    if (timeString.includes('T')) {
      // ISO形式の場合（例：2025-10-23T23:22:00）
      const timePart = timeString.split('T')[1]?.substring(0, 5) || ''
      console.log(`formatTime - ISO形式抽出: ${timePart}`)
      return timePart
    } else if (timeString.includes(':')) {
      // スラッシュ形式の場合（例：2025/10/23 23:22:00）
      const timeMatch = timeString.match(/(\d{2}:\d{2})/)
      if (timeMatch) {
        console.log(`formatTime - スラッシュ形式抽出: ${timeMatch[1]}`)
        return timeMatch[1]
      }
      
      // 時刻形式の場合（例：23:22:00）
      const result = timeString.substring(0, 5)
      console.log(`formatTime - 時刻形式抽出: ${result}`)
      return result
    } else {
      // その他の場合はそのまま返す
      console.log(`formatTime - そのまま返す: ${timeString}`)
      return timeString
    }
  } catch (error) {
    console.error(`formatTime - エラー: ${error}, 入力: ${timeString}`)
    return '--:--'
  }
}

// 今日の勤務時間を計算する関数
export function calculateTodayWorkTime(
  checkInTime?: string | null, // Allow null
  checkOutTime?: string | null, // Allow null
  breakStartTime?: string | null, // Allow null (unused)
  breakEndTime?: string | null, // Allow null (unused)
  currentTime?: string // 現在時刻（リアルタイム更新用）
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

  // 現在時刻を決定（効率的なリアルタイム更新のため）
  const now = currentTime || new Date().toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'})
  
  // 出勤時刻がある場合
  if (checkInTime) {
    const start = new Date(checkInTime)
    
    if (checkOutTime) {
      // 退勤済みの場合：出勤時刻から退勤時刻までの勤務時間
      const end = new Date(checkOutTime)
      if (start < end) {
        totalWorkMinutes = calculateMinutesBetween(checkInTime, checkOutTime)
      } else {
        // 出勤時刻が退勤時刻より後の場合（再出勤時など）
        // 現在時刻までの勤務時間を計算
        totalWorkMinutes = calculateMinutesBetween(checkInTime, now)
      }
    } else {
      // 勤務中の場合：出勤時刻から現在時刻までの勤務時間
      totalWorkMinutes = calculateMinutesBetween(checkInTime, now)
    }
    
    console.log('勤務時間計算:', {
      checkInTime,
      checkOutTime: checkOutTime || '勤務中',
      totalWorkMinutes,
      isCurrentlyWorking: !checkOutTime
    })
  }

  // 休憩時間は常に0（休憩システムを削除）
  breakMinutes = 0

  // 実働時間は勤務時間と同じ（休憩時間を差し引かない）
  netWorkMinutes = totalWorkMinutes

  return {
    totalWorkMinutes,
    breakMinutes,
    netWorkMinutes,
    formattedWorkTime: formatMinutesToTime(totalWorkMinutes),
    formattedBreakTime: formatMinutesToTime(breakMinutes),
    formattedNetWorkTime: formatMinutesToTime(netWorkMinutes)
  }
}