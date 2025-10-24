import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // サーバーの現在時刻を取得
    const now = new Date()
    
    return NextResponse.json({
      timestamp: now.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      timezone: 'Asia/Tokyo',
      localTime: now.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    })
  } catch (error) {
    console.error('時刻取得エラー:', error)
    return NextResponse.json(
      { error: '時刻の取得に失敗しました' },
      { status: 500 }
    )
  }
}
