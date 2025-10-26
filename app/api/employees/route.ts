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

    // 勤怠記録からユーザーIDを取得
    const { data: attendanceData, error } = await supabase
      .from('attendance_records')
      .select('user_id')
      .order('user_id', { ascending: true })

    if (error) {
      console.error('勤怠データの取得エラー:', error)
      throw new Error('勤怠データの取得に失敗しました')
    }

    // 重複を除いてユニークなユーザーIDのリストを作成
    const uniqueUserIds = [...new Set(attendanceData?.map(record => record.user_id) || [])]
    
    // ユーザー情報を取得（emailをuser_idとして使用）
    const employees = uniqueUserIds.map(userId => ({
      user_id: userId,
      email: userId // 現在はemailをuser_idとして使用しているため
    }))
    
    return NextResponse.json(employees)
  } catch (error) {
    console.error('従業員リスト取得エラー:', error)
    return NextResponse.json(
      { error: '従業員リストの取得に失敗しました' },
      { status: 500 }
    )
  }
}