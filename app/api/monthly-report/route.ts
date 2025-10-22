import { NextRequest, NextResponse } from 'next/server'
import { generateMonthlyReport } from '@/lib/monthlyReportUtils'

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
    console.log('月次レポートAPI - リクエスト:', { userId, year, month })
    
    const reportData = await generateMonthlyReport(userId, year, month)
    return NextResponse.json(reportData)
  } catch (error) {
    console.error('月次レポート取得エラー:', error)
    return NextResponse.json(
      { error: '月次レポートの取得に失敗しました' },
      { status: 500 }
    )
  }
}