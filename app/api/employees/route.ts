import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // 認証チェックはクライアントサイドで行うため、ここではスキップ
    // TODO: 本番環境では適切な認証チェックを実装
    console.log('従業員リストAPI - リクエスト')

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

    console.log('従業員リストAPI - 取得完了:', { employeeCount: employees.length })
    
    return NextResponse.json(employees)
  } catch (error) {
    console.error('従業員リスト取得エラー:', error)
    return NextResponse.json(
      { error: '従業員リストの取得に失敗しました' },
      { status: 500 }
    )
  }
}