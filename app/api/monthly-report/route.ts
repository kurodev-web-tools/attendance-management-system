import { NextRequest, NextResponse } from 'next/server'
import { generateMonthlyReport } from '@/lib/monthlyReportUtils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const year = parseInt(searchParams.get('year') || '2025')
    const month = parseInt(searchParams.get('month') || '10')

    if (!userId) {
      return NextResponse.json(
        { error: 'ユーザーIDが必要です' },
        { status: 400 }
      )
    }

    console.log('月次レポート取得リクエスト:', { userId, year, month })

    const report = await generateMonthlyReport(userId, year, month)
    
    console.log('月次レポート生成完了:', { 
      totalWorkMinutes: report.totalWorkMinutes,
      workDays: report.workDays,
      dailyDataCount: report.dailyData.length
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('月次レポート取得エラー:', error)
    return NextResponse.json(
      { error: '月次レポートの取得に失敗しました' },
      { status: 500 }
    )
  }
}
