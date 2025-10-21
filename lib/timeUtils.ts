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
export function calculateMinutesBetween(startIso: string, endIso: string): number {
  // 時刻文字列を正規化（末尾にZがなければ追加）
  const normalizedStartIso = startIso.endsWith('Z') ? startIso : startIso + 'Z'
  const normalizedEndIso = endIso.endsWith('Z') ? endIso : endIso + 'Z'
  
  const start = new Date(normalizedStartIso)
  const end = new Date(normalizedEndIso)
  const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
  const minutes = Math.max(1, Math.ceil(diffSeconds / 60))
  
  // デバッグ情報を追加（540分問題の調査用）
  if (minutes > 300) { // 5時間以上の場合のみログ出力
    console.log('🚨 長時間計算検出:', {
      originalStartIso: startIso,
      originalEndIso: endIso,
      normalizedStartIso,
      normalizedEndIso,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      diffSeconds,
      minutes,
      diffHours: minutes / 60
    })
  }
  
  return minutes
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
  try {
    // 時刻文字列を正規化（末尾にZがなければ追加）
    const normalizedTimeString = isoString.endsWith('Z') ? isoString : isoString + 'Z'
    
    // データベースに保存されたUTC時刻をJSTで表示
    const date = new Date(normalizedTimeString)
    
    // 無効な日付の場合のチェック
    if (isNaN(date.getTime())) {
      console.error(`formatTime - 無効な日付文字列: ${isoString}`)
      return '--:--'
    }
    
    const jstTime = date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tokyo'
    })
    
    // デバッグログ
    console.log(`formatTime - 入力: ${isoString} → 正規化: ${normalizedTimeString} → 出力JST: ${jstTime}`)
    
    return jstTime
  } catch (error) {
    console.error(`formatTime - エラー: ${error}, 入力: ${isoString}`)
    return '--:--'
  }
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
    const start = new Date(checkInTime)
    
    if (checkOutTime) {
      // 退勤済みの場合：出勤時刻から退勤時刻までの勤務時間
      const end = new Date(checkOutTime)
      if (start < end) {
        totalWorkMinutes = calculateMinutesBetween(checkInTime, checkOutTime)
      } else {
        // 出勤時刻が退勤時刻より後の場合（再出勤時など）
        // 現在時刻までの勤務時間を計算
        totalWorkMinutes = calculateMinutesBetween(checkInTime, new Date().toISOString())
      }
    } else {
      // 勤務中の場合：出勤時刻から現在時刻までの勤務時間
      totalWorkMinutes = calculateMinutesBetween(checkInTime, new Date().toISOString())
    }
    
    console.log('勤務時間計算:', {
      checkInTime,
      checkOutTime: checkOutTime || '勤務中',
      totalWorkMinutes,
      isCurrentlyWorking: !checkOutTime
    })
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