import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface DailyReportData {
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  workMinutes: number
  isCompleteDay: boolean
}

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

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // 入力検証
    if (!userId || userId.trim() === '') {
      return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 })
    }

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: '無効な年が指定されました' },
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

    // 年の開始日と終了日
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    // 勤怠記録を取得
    const { data: attendanceRecords, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .not('check_in_time', 'is', null)
      .order('date', { ascending: true })

    if (error) {
      console.error('勤怠記録の取得エラー:', error)
      return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
    }

    if (!attendanceRecords || attendanceRecords.length === 0) {
      return NextResponse.json({
        totalWorkMinutes: 0,
        workDays: 0,
        averageWorkMinutes: 0,
        longestWorkDay: 0,
        earliestCheckIn: null,
        latestCheckOut: null,
        dailyData: []
      })
    }

    // 日別のデータを集計
    const dailyDataMap = new Map<string, DailyReportData>()
    let totalWorkMinutes = 0
    let earliestCheckIn: string | null = null
    let latestCheckOut: string | null = null

    attendanceRecords.forEach(record => {
      const date = record.date
      const checkInTime = record.check_in_time
      const checkOutTime = record.check_out_time

      // 日付が既に存在しない場合は新しいエントリを作成
      if (!dailyDataMap.has(date)) {
        dailyDataMap.set(date, {
          date,
          checkInTime,
          checkOutTime,
          workMinutes: 0,
          isCompleteDay: false
        })
      }

      const dailyData = dailyDataMap.get(date)!

      // 既存のデータを更新（最新の記録を優先）
      if (checkInTime) {
        dailyData.checkInTime = checkInTime
      }
      if (checkOutTime) {
        dailyData.checkOutTime = checkOutTime
      }

      // 勤務時間を計算
      if (checkInTime && checkOutTime) {
        const checkIn = new Date(checkInTime).getTime()
        const checkOut = new Date(checkOutTime).getTime()
        const minutes = Math.floor((checkOut - checkIn) / (1000 * 60))
        dailyData.workMinutes += minutes
        totalWorkMinutes += minutes
        dailyData.isCompleteDay = true

        // 最速出勤時刻と最遅退勤時刻を更新
        if (!earliestCheckIn || new Date(checkInTime) < new Date(earliestCheckIn)) {
          earliestCheckIn = checkInTime
        }
        if (!latestCheckOut || new Date(checkOutTime) > new Date(latestCheckOut)) {
          latestCheckOut = checkOutTime
        }
      }
    })

    const dailyData = Array.from(dailyDataMap.values()).filter(day => day.workMinutes > 0)
    const workDays = dailyData.length
    const averageWorkMinutes = workDays > 0 ? totalWorkMinutes / workDays : 0
    const longestWorkDay = dailyData.length > 0 ? Math.max(...dailyData.map(day => day.workMinutes)) : 0

    return NextResponse.json({
      totalWorkMinutes,
      workDays,
      averageWorkMinutes,
      longestWorkDay,
      earliestCheckIn,
      latestCheckOut,
      dailyData
    })

  } catch (error) {
    console.error('年次レポート取得エラー:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
