import { NextRequest, NextResponse } from 'next/server'
import { generateMonthlyReport } from '@/lib/monthlyReportUtils'
import { writeMonthlyReportToSheet } from '@/lib/googleSheets'

export async function POST(request: NextRequest) {
  try {
    const { userId, year, month } = await request.json()

    if (!userId || !year || !month) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      )
    }

    console.log('Google Sheets連携API - リクエスト:', { userId, year, month })

    // 月次レポートデータを取得
    const reportData = await generateMonthlyReport(userId, year, month)
    console.log('Google Sheets連携API - レポートデータ取得完了:', {
      totalWorkMinutes: reportData.totalWorkMinutes,
      workDays: reportData.workDays,
      dailyDataCount: reportData.dailyData.length
    })

    // Google Sheetsに書き込み
    const spreadsheetUrl = await writeMonthlyReportToSheet(reportData, userId, year, month)
    console.log('Google Sheets連携API - 書き込み完了:', { spreadsheetUrl })

    return NextResponse.json({
      success: true,
      spreadsheetUrl,
      message: 'スプレッドシートに月次レポートを書き込みました'
    })
  } catch (error) {
    console.error('Google Sheets連携エラー:', error)
    return NextResponse.json(
      { 
        error: 'スプレッドシートへの書き込みに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}


