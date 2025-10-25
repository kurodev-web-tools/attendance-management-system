/**
 * 勤怠データのエクスポート用ユーティリティ
 */

export interface AttendanceExportData {
  日付: string
  出勤時刻: string
  退勤時刻: string
  勤務時間: string
  忙しさレベル: number
  コメント: string
}

/**
 * 勤怠データをCSV形式に変換
 */
export function convertToCSV(data: AttendanceExportData[]): string {
  if (!data || data.length === 0) {
    return ''
  }

  // ヘッダー
  const headers = Object.keys(data[0])
  const csvHeaders = headers.join(',')
  
  // データ行
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header as keyof AttendanceExportData]
      // カンマや改行を含む場合はダブルクォートで囲む
      if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(',')
  })

  return [csvHeaders, ...csvRows].join('\n')
}

/**
 * CSVデータをダウンロード
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

/**
 * 日付範囲を指定して勤怠データを取得
 */
export async function getAttendanceDataForExport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  userId: string,
  startDate: string,
  endDate: string
): Promise<AttendanceExportData[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select(`
      *,
      busy_levels (
        level,
        comment
      )
    `)
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) {
    console.error('勤怠データの取得エラー:', error)
    return []
  }

  return data.map((record: {
    date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    busy_levels: Array<{ level: number; comment: string }> | null;
  }) => {
    const checkInTime = record.check_in_time ? formatTime(record.check_in_time) : '-'
    const checkOutTime = record.check_out_time ? formatTime(record.check_out_time) : '-'
    
    // 勤務時間を計算
    let workTime = '-'
    if (record.check_in_time && record.check_out_time) {
      const minutes = calculateWorkMinutes(record.check_in_time, record.check_out_time)
      workTime = formatMinutesToTime(minutes)
    }

    const busyLevel = record.busy_levels?.[0]?.level || 0
    const comment = record.busy_levels?.[0]?.comment || '-'

    return {
      日付: record.date,
      出勤時刻: checkInTime,
      退勤時刻: checkOutTime,
      勤務時間: workTime,
      忙しさレベル: busyLevel,
      コメント: comment,
    }
  })
}

/**
 * 時刻をフォーマット（HH:MM）
 */
function formatTime(timeString: string): string {
  try {
    const date = new Date(timeString)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  } catch {
    return timeString
  }
}

/**
 * 勤務時間を分で計算
 */
function calculateWorkMinutes(checkInTime: string, checkOutTime: string): number {
  try {
    const checkIn = new Date(checkInTime).getTime()
    const checkOut = new Date(checkOutTime).getTime()
    return Math.floor((checkOut - checkIn) / (1000 * 60))
  } catch {
    return 0
  }
}

/**
 * 分を時間文字列に変換（HH:MM）
 */
function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}
