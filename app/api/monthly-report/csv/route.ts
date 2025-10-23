import { NextRequest, NextResponse } from 'next/server'
import { generateMonthlyReport, type MonthlyReportData } from '@/lib/monthlyReportUtils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!userId || !year || !month) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      )
    }

    // 認証チェックはクライアントサイドで行うため、ここではスキップ
    // TODO: 本番環境では適切な認証チェックを実装
    console.log('CSVエクスポートAPI - リクエスト:', { userId, year, month })
    
    const reportData = await generateMonthlyReport(userId, year, month)
    console.log('CSVエクスポートAPI - レポートデータ取得完了:', { 
      totalWorkMinutes: reportData.totalWorkMinutes,
      workDays: reportData.workDays,
      dailyDataCount: reportData.dailyData.length
    })

    // CSVデータを生成
    try {
      const csvData = generateCSV(reportData, userId, year, month)
      console.log('CSVエクスポートAPI - CSVデータ生成完了:', { csvLength: csvData.length })

      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance-report-${year}-${month}-${userId}.csv"`
        }
      })
    } catch (csvError) {
      console.error('CSV生成エラー:', csvError)
      return NextResponse.json(
        { error: 'CSV生成に失敗しました', details: csvError instanceof Error ? csvError.message : 'Unknown error' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('CSVエクスポートエラー:', error)
    return NextResponse.json(
      { error: 'CSVエクスポートに失敗しました' },
      { status: 500 }
    )
  }
}

// CSV用の時刻フォーマット関数
function formatTimeForCSV(isoString: string | null): string {
  if (!isoString) {
    return ''
  }
  
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) {
      return ''
    }
    
    // UTC時刻をJST時刻に変換（+9時間）
    const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000))
    return jstDate.toISOString().substring(0, 19).replace('T', ' ') // YYYY-MM-DD HH:MM:SS形式
  } catch (error) {
    console.error('formatTimeForCSV エラー:', error, '入力:', isoString)
    return ''
  }
}

function generateCSV(reportData: MonthlyReportData, userId: string, year: number, month: number): string {
  const rows: string[] = []
  
  // レポートヘッダー
  rows.push(`勤怠レポート - ${year}年${month}月`)
  rows.push(`従業員: ${userId}`)
  rows.push(`作成日: ${new Date().toLocaleDateString('ja-JP')}`)
  rows.push('')
  
  // サマリー情報
  rows.push('■■■ サマリー ■■■')
  rows.push('項目,値')
  rows.push(`総勤務時間,${Math.floor(reportData.totalWorkMinutes / 60)}:${(reportData.totalWorkMinutes % 60).toString().padStart(2, '0')}`)
  rows.push(`勤務日数,${reportData.workDays}日`)
  rows.push(`平均勤務時間,${Math.floor(reportData.averageWorkMinutes / 60)}:${(reportData.averageWorkMinutes % 60).toString().padStart(2, '0')}`)
  rows.push(`最速出勤,${reportData.earliestCheckIn ? new Date(reportData.earliestCheckIn).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }) : 'なし'}`)
  rows.push(`最遅退勤,${reportData.latestCheckOut ? new Date(reportData.latestCheckOut).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }) : 'なし'}`)
  rows.push(`最長勤務日,${Math.floor(reportData.longestWorkDay / 60)}:${(reportData.longestWorkDay % 60).toString().padStart(2, '0')}`)
  rows.push('')
  
  // 日別詳細
  rows.push('■■■ 日別詳細 ■■■')
  rows.push('日付,曜日,勤務時間(時:分),勤務時間(分),出勤時刻,退勤時刻,状況')
  
  // 日別データ
  reportData.dailyData
    .filter(day => day.workMinutes > 0)
    .forEach(day => {
      const date = new Date(day.date)
      const dayOfWeek = date.toLocaleDateString('ja-JP', { weekday: 'short' })
      const workTimeFormatted = `${Math.floor(day.workMinutes / 60)}:${(day.workMinutes % 60).toString().padStart(2, '0')}`
      const status = day.isCompleteDay ? '完了' : '勤務中'

      rows.push([
        day.date,
        dayOfWeek,
        workTimeFormatted,
        day.workMinutes.toString(),
        formatTimeForCSV(day.checkInTime),
        formatTimeForCSV(day.checkOutTime),
        status
      ].join(','))
    })

  // CSV文字列を生成
  return rows.join('\n')
}