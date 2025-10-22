import { google } from 'googleapis'
import type { MonthlyReportData } from './monthlyReportUtils'

// Google Sheets APIの認証情報
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ],
})

const sheets = google.sheets({ version: 'v4', auth })

// 認証のテスト
auth.getAccessToken().then(token => {
  console.log('Google Sheets認証テスト成功:', !!token)
}).catch(error => {
  console.error('Google Sheets認証テスト失敗:', error)
})

/**
 * スプレッドシートに月次レポートを書き込む
 */
export async function writeMonthlyReportToSheet(
  reportData: MonthlyReportData,
  userId: string,
  year: number,
  month: number
): Promise<string> {
  try {
    // 認証情報のデバッグ
    console.log('Google Sheets認証情報:', {
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
      privateKeyLength: process.env.GOOGLE_PRIVATE_KEY?.length
    })

    // スプレッドシートを作成
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `${userId}_${year}年_${month}月_勤怠レポート`,
        },
      },
    })

    const spreadsheetId = spreadsheet.data.spreadsheetId
    if (!spreadsheetId) {
      throw new Error('スプレッドシートの作成に失敗しました')
    }

    // ヘッダー行を準備
    const headers = [
      '従業員ID',
      '年',
      '月',
      '日付',
      '勤務時間(分)',
      '勤務時間(時:分)',
      '出勤時刻',
      '退勤時刻',
      '状況'
    ]

    // データ行を準備
    const rows = [
      // サマリーデータ
      [userId, year, month, 'サマリー', '', '', '', '', ''],
      ['', '', '', '総勤務時間', reportData.totalWorkMinutes, formatMinutesToTime(reportData.totalWorkMinutes), '', '', ''],
      ['', '', '', '勤務日数', reportData.workDays, '', '', '', ''],
      ['', '', '', '平均勤務時間', reportData.averageWorkMinutes, formatMinutesToTime(reportData.averageWorkMinutes), '', '', ''],
      ['', '', '', '最長勤務日', reportData.longestWorkDay, formatMinutesToTime(reportData.longestWorkDay), '', '', ''],
      ['', '', '', '', '', '', '', '', ''],
      ['', '', '', '日別詳細', '', '', '', '', ''],
      // ヘッダー行
      headers
    ]

    // 日別データを追加
    reportData.dailyData
      .filter(day => day.workMinutes > 0)
      .forEach(day => {
        const workTimeFormatted = formatMinutesToTime(day.workMinutes)
        const checkInTime = day.checkInTime ? formatTimeForSheet(day.checkInTime) : ''
        const checkOutTime = day.checkOutTime ? formatTimeForSheet(day.checkOutTime) : ''
        const status = day.isCompleteDay ? '完了' : '勤務中'

        rows.push([
          userId,
          year.toString(),
          month.toString(),
          day.date || '',
          day.workMinutes.toString(),
          workTimeFormatted,
          checkInTime,
          checkOutTime,
          status
        ])
      })

    // スプレッドシートにデータを書き込み
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    })

    // スプレッドシートのURLを返す
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  } catch (error) {
    console.error('Google Sheets書き込みエラー:', error)
    console.error('エラー詳細:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      status: (error as { response?: { status?: number } })?.response?.status,
      statusText: (error as { response?: { statusText?: string } })?.response?.statusText,
      data: (error as { response?: { data?: unknown } })?.response?.data
    })
    throw new Error('スプレッドシートへの書き込みに失敗しました')
  }
}

/**
 * 分を時:分形式に変換
 */
function formatMinutesToTime(minutes: number): string {
  if (isNaN(minutes) || minutes < 0) {
    return '0:00'
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}:${remainingMinutes.toString().padStart(2, '0')}`
}

/**
 * スプレッドシート用の時刻フォーマット
 */
function formatTimeForSheet(isoString: string): string {
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) {
      return ''
    }
    // UTC時刻をJST時刻に変換（+9時間）
    const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000))
    return jstDate.toISOString().substring(0, 19).replace('T', ' ') // YYYY-MM-DD HH:MM:SS形式
  } catch (error) {
    console.error('formatTimeForSheet エラー:', error, '入力:', isoString)
    return ''
  }
}

