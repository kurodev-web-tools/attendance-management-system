import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

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

    if (!userId) {
      return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 })
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

    // CSVヘッダー
    const csvHeader = '日付,出勤時刻,退勤時刻,勤務時間（分）,勤務時間（時:分）\n'

    // CSVボディを生成
    const csvRows = (attendanceRecords || []).map(record => {
      const date = record.date
      const checkInTime = record.check_in_time ? new Date(record.check_in_time).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'
      const checkOutTime = record.check_out_time ? new Date(record.check_out_time).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'
      
      let workMinutes = 0
      if (record.check_in_time && record.check_out_time) {
        const checkIn = new Date(record.check_in_time).getTime()
        const checkOut = new Date(record.check_out_time).getTime()
        workMinutes = Math.floor((checkOut - checkIn) / (1000 * 60))
      }
      
      const hours = Math.floor(workMinutes / 60)
      const minutes = workMinutes % 60
      const workTimeFormatted = workMinutes > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}` : '-'
      
      return `${date},${checkInTime},${checkOutTime},${workMinutes},${workTimeFormatted}`
    }).join('\n')

    const csvContent = csvHeader + csvRows
    const csvBuffer = Buffer.from('\uFEFF' + csvContent, 'utf-8')

    return new NextResponse(csvBuffer, {
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`勤怠レポート_${year}年_${userId}.csv`)}`,
      },
    })

  } catch (error) {
    console.error('年次レポートCSVエクスポートエラー:', error)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
