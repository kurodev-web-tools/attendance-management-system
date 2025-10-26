import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateMonthlyReport } from '@/lib/monthlyReportUtils'

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const year = parseInt(searchParams.get('year') || '2025')
    const month = parseInt(searchParams.get('month') || '10')

    // 入力検証
    if (!userId || userId.trim() === '') {
      return NextResponse.json(
        { error: 'ユーザーIDが必要です' },
        { status: 400 }
      )
    }

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: '無効な年が指定されました' },
        { status: 400 }
      )
    }

    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: '無効な月が指定されました' },
        { status: 400 }
      )
    }

    // 権限チェック：自分自身または管理者の場合のみアクセス可能
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || []
    const isAdmin = adminEmails.includes(session.user.email)
    const isOwnData = userId === session.user.email

    if (!isAdmin && !isOwnData) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      )
    }

    const report = await generateMonthlyReport(userId, year, month)

    return NextResponse.json(report)
  } catch (error) {
    console.error('月次レポート取得エラー:', error)
    return NextResponse.json(
      { error: '月次レポートの取得に失敗しました' },
      { status: 500 }
    )
  }
}
