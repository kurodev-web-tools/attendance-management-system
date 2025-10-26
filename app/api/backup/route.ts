import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    // 管理者権限チェック
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || []
    const isAdmin = adminEmails.includes(session.user.email)

    if (!isAdmin) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    // 全テーブルからデータを取得
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('*')
      .order('created_at', { ascending: true })

    if (attendanceError) {
      console.error('勤怠記録の取得エラー:', attendanceError)
    }

    const { data: busyLevels, error: busyError } = await supabase
      .from('busy_levels')
      .select('*')
      .order('date', { ascending: true })

    if (busyError) {
      console.error('忙しさレベルの取得エラー:', busyError)
    }

    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')

    if (settingsError) {
      console.error('ユーザー設定の取得エラー:', settingsError)
    }

    // バックアップデータを構築
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      created_by: session.user.email,
      data: {
        attendance_records: attendanceRecords || [],
        busy_levels: busyLevels || [],
        user_settings: userSettings || [],
      }
    }

    // ファイル名生成（日付付き）
    const filename = `backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('バックアップ取得エラー:', error)
    return NextResponse.json(
      { error: 'バックアップの取得に失敗しました' },
      { status: 500 }
    )
  }
}
