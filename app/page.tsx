'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { toast } from 'sonner'
import { AttendanceButtons } from '@/components/AttendanceButtons'
import { BusyLevelMeter } from '@/components/BusyLevelMeter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Clock, TrendingUp, LogOut } from 'lucide-react'
import { saveAttendanceRecord, getAttendanceRecord, saveBusyLevel, getBusyLevel } from '@/lib/database'
import { calculateTodayWorkTime } from '@/lib/timeUtils'

export default function Home() {
  const { data: session, status } = useSession()
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [isOnBreak, setIsOnBreak] = useState(false)
  const [checkInTime, setCheckInTime] = useState<string>()
  const [checkOutTime, setCheckOutTime] = useState<string>()
  const [breakStartTime, setBreakStartTime] = useState<string>()
  const [breakEndTime, setBreakEndTime] = useState<string>()
  const [busyLevel, setBusyLevel] = useState(50)
  const [busyComment, setBusyComment] = useState('')
  const [loading, setLoading] = useState(false)

  // 今日の日付を取得
  const today = new Date().toISOString().split('T')[0]

  // 今日の勤務時間を計算（currentTimeを依存関係に追加してリアルタイム更新）
  const workTimeCalculation = calculateTodayWorkTime(
    checkInTime,
    checkOutTime,
    breakStartTime,
    breakEndTime
  )

  // 今日のデータを読み込み
  const loadTodayData = useCallback(async () => {
    if (!session?.user?.email) return

    try {
      setLoading(true)
      
      // ユーザーIDとしてemailを使用（一時的な解決策）
      const userId = session.user.email
      
          // 勤怠記録を取得
          try {
            const attendanceData = await getAttendanceRecord(userId, today)
            console.log('読み込んだ勤怠データ:', attendanceData)
            
            if (attendanceData) {
              // 最新の出勤記録のみを使用（退勤後に再度出勤した場合）
              const latestCheckIn = attendanceData.check_in_time
              const latestCheckOut = attendanceData.check_out_time
              
              console.log('出勤時刻:', latestCheckIn)
              console.log('退勤時刻:', latestCheckOut)
              
              // 出勤状態の判定：出勤時刻があり、退勤時刻がない場合は勤務中
              const isCurrentlyWorking = !!latestCheckIn && !latestCheckOut
              setIsCheckedIn(isCurrentlyWorking)
              
              // 休憩状態の判定
              setIsOnBreak(!!attendanceData.break_start_time && !attendanceData.break_end_time)
              
              // 時刻データを設定
              setCheckInTime(latestCheckIn || undefined)
              setCheckOutTime(latestCheckOut || undefined)
              setBreakStartTime(attendanceData.break_start_time || undefined)
              setBreakEndTime(attendanceData.break_end_time || undefined)
            }
          } catch (attendanceError) {
            console.error('勤怠記録の読み込みエラー:', attendanceError)
            // エラーが発生してもアプリを継続（ユーザーには表示しない）
          }

      // 忙しさレベルを取得
      try {
        const busyData = await getBusyLevel(userId, today)
        if (busyData) {
          setBusyLevel(busyData.level)
          setBusyComment(busyData.comment || '')
        }
      } catch (busyError) {
        console.error('忙しさレベルの読み込みエラー:', busyError)
        // エラーが発生してもアプリを継続（ユーザーには表示しない）
      }
    } catch (error) {
      console.error('データの読み込みエラー:', error)
    } finally {
      setLoading(false)
    }
  }, [session?.user?.email, today])

  // コンポーネントマウント時にデータを読み込み
  useEffect(() => {
    if (session?.user) {
      loadTodayData()
    }
  }, [session?.user, today, loadTodayData])

  // 勤務時間をリアルタイム更新（1分ごと）
  useEffect(() => {
    if (isCheckedIn && !checkOutTime) {
      const timer = setInterval(() => {
        // 強制的に再レンダリングをトリガー
        setLoading(prev => !prev)
      }, 60000) // 1分ごと

      return () => clearInterval(timer)
    }
  }, [isCheckedIn, checkOutTime])

  // ローディング中または認証されていない場合はログインページにリダイレクト
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">ログインが必要です</h1>
          <Button onClick={() => window.location.href = '/login'}>
            ログインページへ
          </Button>
        </div>
      </div>
    )
  }

  // 出勤処理
  const handleCheckIn = async () => {
    if (!session?.user?.email) return

    setLoading(true)
    // JSTで現在時刻を取得（正しい方法）
    const jstOffset = 9 * 60 // JSTはUTC+9時間 = 540分
    const utcNow = new Date()
    const jstNow = new Date(utcNow.getTime() + (jstOffset * 60 * 1000))
    const now = jstNow.toISOString()
    console.log('UTC時刻:', utcNow.toISOString())
    console.log('JST時刻:', now)
    console.log('現在時刻（JST）:', jstNow.toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}))
    
    // 状態を完全にリセット
    setCheckOutTime(undefined)
    setBreakStartTime(undefined)
    setBreakEndTime(undefined)
    setIsOnBreak(false)
    setBusyLevel(50)
    setBusyComment('')
    
    // 出勤状態を設定（時刻は保存後に設定）
    setIsCheckedIn(true)

    try {
      // 出勤記録を保存（すべての時刻をリセット）
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        check_in_time: now,
        check_out_time: null,
        break_start_time: null,
        break_end_time: null,
      })
      
      // 忙しさレベルもリセット
      await saveBusyLevel({
        user_id: session.user.email,
        date: today,
        level: 50,
        comment: '',
      })
      
      // 保存成功後に時刻を設定
      setCheckInTime(now)
      toast.success('出勤記録を保存しました')
    } catch (error) {
      console.error('出勤記録の保存エラー:', error)
      toast.error('出勤記録の保存に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  // 退勤処理
  const handleCheckOut = async () => {
    if (!session?.user?.email) return

    setLoading(true)
    // JSTで現在時刻を取得（正しい方法）
    const jstOffset = 9 * 60 // JSTはUTC+9時間 = 540分
    const utcNow = new Date()
    const jstNow = new Date(utcNow.getTime() + (jstOffset * 60 * 1000))
    const now = jstNow.toISOString()
    console.log('UTC時刻:', utcNow.toISOString())
    console.log('JST時刻:', now)
    console.log('現在時刻（JST）:', jstNow.toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}))
    
    setIsCheckedIn(false)
    setIsOnBreak(false)
    // 休憩時刻は保持（履歴として残す）

    try {
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        check_out_time: now,
      })
      
      // 保存成功後に時刻を設定
      setCheckOutTime(now)
      toast.success('退勤記録を保存しました')
    } catch (error) {
      console.error('退勤記録の保存エラー:', error)
      toast.error('退勤記録の保存に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  // 新しい日へのリセット処理（データベースもクリア）
  const resetForNewDay = async () => {
    if (!session?.user?.email) return

    // ローカル状態をリセット
    setIsCheckedIn(false)
    setIsOnBreak(false)
    setCheckInTime(undefined)
    setCheckOutTime(undefined)
    setBreakStartTime(undefined)
    setBreakEndTime(undefined)
    setBusyLevel(50)
    setBusyComment('')

    // データベースもクリア
    try {
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        check_in_time: null,
        check_out_time: null,
        break_start_time: null,
        break_end_time: null,
      })
      
      await saveBusyLevel({
        user_id: session.user.email,
        date: today,
        level: 50,
        comment: '',
      })
      
      toast.success('新しい日を開始しました')
    } catch (error) {
      console.error('リセット処理エラー:', error)
      toast.error('リセット処理に失敗しました')
    }
  }

  // 休憩開始処理
  const handleBreakStart = async () => {
    if (!session?.user?.email) return

    // JSTで現在時刻を取得（正しい方法）
    const jstOffset = 9 * 60 // JSTはUTC+9時間 = 540分
    const utcNow = new Date()
    const jstNow = new Date(utcNow.getTime() + (jstOffset * 60 * 1000))
    const now = jstNow.toISOString()
    console.log('UTC時刻:', utcNow.toISOString())
    console.log('JST時刻:', now)
    console.log('現在時刻（JST）:', jstNow.toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}))
    
    setIsOnBreak(true)

    try {
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        break_start_time: now,
      })
      
      // 保存成功後に時刻を設定
      setBreakStartTime(now)
      toast.success('休憩開始を記録しました')
    } catch (error) {
      console.error('休憩開始記録の保存エラー:', error)
      toast.error('休憩開始記録の保存に失敗しました。')
    }
  }

  // 休憩終了処理
  const handleBreakEnd = async () => {
    if (!session?.user?.email) return

    // JSTで現在時刻を取得（正しい方法）
    const jstOffset = 9 * 60 // JSTはUTC+9時間 = 540分
    const utcNow = new Date()
    const jstNow = new Date(utcNow.getTime() + (jstOffset * 60 * 1000))
    const now = jstNow.toISOString()
    console.log('UTC時刻:', utcNow.toISOString())
    console.log('JST時刻:', now)
    console.log('現在時刻（JST）:', jstNow.toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}))
    
    setIsOnBreak(false)

    try {
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        break_end_time: now,
      })
      
      // 保存成功後に時刻を設定
      setBreakEndTime(now)
      toast.success('休憩終了を記録しました')
    } catch (error) {
      console.error('休憩終了記録の保存エラー:', error)
      toast.error('休憩終了記録の保存に失敗しました。')
    }
  }

  // 忙しさレベル更新処理
  const handleBusyLevelUpdate = async (level: number, comment: string) => {
    if (!session?.user?.email) return

    setBusyLevel(level)
    setBusyComment(comment)

    try {
      await saveBusyLevel({
        user_id: session.user.email,
        date: today,
        level: level,
        comment: comment,
      })
      toast.success('忙しさレベルを更新しました')
    } catch (error) {
      console.error('忙しさレベル記録の保存エラー:', error)
      toast.error('忙しさレベル記録の保存に失敗しました。')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="flex justify-between items-center mb-4">
            <div></div>
            <h1 className="text-3xl font-bold text-gray-900">
              勤怠管理システム
            </h1>
            <Button
              variant="outline"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </Button>
          </div>
          <p className="text-gray-600">
            こんにちは、{session.user?.name}さん！今日も一日お疲れ様です
          </p>
        </div>

        {/* メインコンテンツ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 勤怠記録 */}
          <AttendanceButtons
            isCheckedIn={isCheckedIn}
            isOnBreak={isOnBreak}
            checkInTime={checkInTime}
            checkOutTime={checkOutTime}
            breakStartTime={breakStartTime}
            breakEndTime={breakEndTime}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            onBreakStart={handleBreakStart}
            onBreakEnd={handleBreakEnd}
          />

          {/* 忙しさメーター */}
          <BusyLevelMeter
            initialLevel={busyLevel}
            initialComment={busyComment}
            onUpdate={handleBusyLevelUpdate}
          />
        </div>

        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日の勤務時間</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workTimeCalculation.formattedNetWorkTime}</div>
              <p className="text-xs text-muted-foreground">
                実働時間
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総勤務時間</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workTimeCalculation.formattedWorkTime}</div>
              <p className="text-xs text-muted-foreground">
                休憩時間含む
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">休憩時間</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workTimeCalculation.formattedBreakTime}</div>
              <p className="text-xs text-muted-foreground">
                累計休憩時間
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">忙しさレベル</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{busyLevel}%</div>
              <p className="text-xs text-muted-foreground">
                現在の状況
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">出勤日数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">22日</div>
              <p className="text-xs text-muted-foreground">
                今月の出勤日数
              </p>
            </CardContent>
          </Card>
        </div>

        {/* アクションボタン */}
        <div className="flex justify-center gap-4">
          <Button variant="outline">
            履歴確認
          </Button>
          <Button variant="outline">
            月次レポート
          </Button>
          <Button variant="outline">
            設定
          </Button>
          {checkOutTime && (
            <Button 
              variant="outline" 
              onClick={resetForNewDay}
              className="bg-blue-50 hover:bg-blue-100"
            >
              新しい日を開始
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
