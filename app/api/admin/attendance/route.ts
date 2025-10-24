import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 勤怠記録の更新
export async function PUT(request: NextRequest) {
  try {
    const { id, checkInTime, checkOutTime, date } = await request.json()
    
    console.log('PUT API - 受信データ:', { id, checkInTime, checkOutTime, date })

    if (!id) {
      return NextResponse.json(
        { error: '勤怠記録IDが必要です' },
        { status: 400 }
      )
    }

    // 日本時間の文字列をそのまま保存（UTC変換しない）
    const formatToJST = (dateTime: string) => {
      if (!dateTime) return null
      
      // 時刻がHH:MM形式の場合は、日付と結合
      if (dateTime.includes('T')) {
        return dateTime
      } else {
        // HH:MM形式の場合は、今日の日付と結合
        const today = new Date().toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-')
        return `${today}T${dateTime}:00`
      }
    }

    // 勤怠記録を更新
    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        check_in_time: formatToJST(checkInTime),
        check_out_time: formatToJST(checkOutTime),
        date: date,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error('勤怠記録更新エラー:', error)
      return NextResponse.json(
        { error: `勤怠記録の更新に失敗しました: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('勤怠記録更新エラー:', error)
    return NextResponse.json(
      { error: '勤怠記録の更新に失敗しました' },
      { status: 500 }
    )
  }
}

// 勤怠記録の削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '勤怠記録IDが必要です' },
        { status: 400 }
      )
    }

    // 勤怠記録を削除
    const { error } = await supabase
      .from('attendance_records')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('勤怠記録削除エラー:', error)
      return NextResponse.json(
        { error: '勤怠記録の削除に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('勤怠記録削除エラー:', error)
    return NextResponse.json(
      { error: '勤怠記録の削除に失敗しました' },
      { status: 500 }
    )
  }
}

// 勤怠記録の追加
export async function POST(request: NextRequest) {
  try {
    const { userId, checkInTime, checkOutTime, date } = await request.json()

    if (!userId || !date) {
      return NextResponse.json(
        { error: 'ユーザーIDと日付が必要です' },
        { status: 400 }
      )
    }

    // 日本時間の文字列をそのまま保存（UTC変換しない）
    const formatToJST = (dateTime: string) => {
      if (!dateTime) return null
      
      // 時刻がHH:MM形式の場合は、日付と結合
      if (dateTime.includes('T')) {
        return dateTime
      } else {
        // HH:MM形式の場合は、指定された日付と結合
        return `${date}T${dateTime}:00`
      }
    }

    // 勤怠記録を追加
    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        user_id: userId,
        date: date,
        check_in_time: formatToJST(checkInTime),
        check_out_time: formatToJST(checkOutTime),
        created_at: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('勤怠記録追加エラー:', error)
      return NextResponse.json(
        { error: '勤怠記録の追加に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('勤怠記録追加エラー:', error)
    return NextResponse.json(
      { error: '勤怠記録の追加に失敗しました' },
      { status: 500 }
    )
  }
}
