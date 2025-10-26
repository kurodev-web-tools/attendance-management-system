import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
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

    // リクエストボディからバックアップデータを取得
    const backupData = await request.json()

    // バックアップデータの検証
    if (!backupData || typeof backupData !== 'object') {
      return NextResponse.json(
        { error: '無効なバックアップデータです' },
        { status: 400 }
      )
    }

    if (!backupData.data || !backupData.timestamp) {
      return NextResponse.json(
        { error: 'バックアップデータの形式が正しくありません' },
        { status: 400 }
      )
    }

    // 既存データの削除
    // Note: SupabaseのRLSポリシーにより、全件削除は管理者でも制限される可能性がある
    // その場合は、個別の削除処理が必要
    
    // 勤怠記録を削除して再挿入
    if (backupData.data.attendance_records && backupData.data.attendance_records.length > 0) {
      // 既存データを削除（RLSの制約により、管理者でもユーザーごとに削除する必要がある）
      const uniqueUserIds = [...new Set(backupData.data.attendance_records.map((r: { user_id: string }) => r.user_id))]
      
      for (const userId of uniqueUserIds) {
        await supabase
          .from('attendance_records')
          .delete()
          .eq('user_id', userId)
      }

      // バックアップデータを挿入
      const { error: attendanceError } = await supabase
        .from('attendance_records')
        .insert(backupData.data.attendance_records)

      if (attendanceError) {
        console.error('勤怠記録の復元エラー:', attendanceError)
        return NextResponse.json(
          { error: '勤怠記録の復元に失敗しました', details: attendanceError.message },
          { status: 500 }
        )
      }
    }

    // 忙しさレベルを削除して再挿入
    if (backupData.data.busy_levels && backupData.data.busy_levels.length > 0) {
      const uniqueUserIds = [...new Set(backupData.data.busy_levels.map((b: { user_id: string }) => b.user_id))]
      
      for (const userId of uniqueUserIds) {
        await supabase
          .from('busy_levels')
          .delete()
          .eq('user_id', userId)
      }

      const { error: busyError } = await supabase
        .from('busy_levels')
        .insert(backupData.data.busy_levels)

      if (busyError) {
        console.error('忙しさレベルの復元エラー:', busyError)
        return NextResponse.json(
          { error: '忙しさレベルの復元に失敗しました', details: busyError.message },
          { status: 500 }
        )
      }
    }

    // ユーザー設定を復元（upsertを使用）
    if (backupData.data.user_settings && backupData.data.user_settings.length > 0) {
      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert(backupData.data.user_settings, { onConflict: 'user_id' })

      if (settingsError) {
        console.error('ユーザー設定の復元エラー:', settingsError)
        return NextResponse.json(
          { error: 'ユーザー設定の復元に失敗しました', details: settingsError.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'バックアップから復元しました',
      backup_timestamp: backupData.timestamp,
      restored_at: new Date().toISOString(),
      restored_by: session.user.email,
    })
  } catch (error) {
    console.error('復元エラー:', error)
    return NextResponse.json(
      { error: '復元に失敗しました', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

