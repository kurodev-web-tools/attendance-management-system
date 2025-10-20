'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
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

  // 今日の勤務時間を計算
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
        if (attendanceData) {
          // 退勤時刻がある場合は出勤状態をfalseに設定
          const hasCheckedOut = !!attendanceData.check_out_time
          setIsCheckedIn(!hasCheckedOut && !!attendanceData.check_in_time)
          setIsOnBreak(!!attendanceData.break_start_time && !attendanceData.break_end_time)
          setCheckInTime(attendanceData.check_in_time || undefined)
          setCheckOutTime(attendanceData.check_out_time || undefined)
          setBreakStartTime(attendanceData.break_start_time || undefined)
          setBreakEndTime(attendanceData.break_end_time || undefined)
        }
      } catch (attendanceError) {
        console.error('勤怠記録の読み込みエラー:', attendanceError)
        // エラーが発生してもアプリを継続
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
        // エラーが発生してもアプリを継続
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
    const now = new Date().toISOString()
    setCheckInTime(now)
    setCheckOutTime(undefined) // 再度出勤時は退勤時刻をクリア
    setBreakStartTime(undefined) // 休憩開始時刻もクリア
    setBreakEndTime(undefined) // 休憩終了時刻もクリア
    setIsOnBreak(false) // 休憩状態もリセット
    setBusyLevel(50) // 忙しさレベルもリセット
    setBusyComment('') // 忙しさコメントもリセット
    setIsCheckedIn(true)

    try {
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        check_in_time: now,
        check_out_time: undefined, // 退勤時刻をundefinedに設定
        break_start_time: undefined, // 休憩開始時刻もクリア
        break_end_time: undefined, // 休憩終了時刻もクリア
      })
    } catch (error) {
      console.error('出勤記録の保存エラー:', error)
    }

    // 忙しさレベルもリセット
    try {
      await saveBusyLevel({
        user_id: session.user.email,
        date: today,
        level: 50,
        comment: '',
      })
    } catch (error) {
      console.error('忙しさレベルリセットの保存エラー:', error)
    } finally {
      setLoading(false)
    }
  }

  // 退勤処理
  const handleCheckOut = async () => {
    if (!session?.user?.email) return

    setLoading(true)
    const now = new Date().toISOString()
    setCheckOutTime(now)
    setIsCheckedIn(false)
    setIsOnBreak(false)
    // 休憩時刻は保持（履歴として残す）

    try {
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        check_out_time: now,
      })
    } catch (error) {
      console.error('退勤記録の保存エラー:', error)
    } finally {
      setLoading(false)
    }

    // 退勤後、再度出勤可能にするため、出勤状態のみリセット
    setTimeout(() => {
      setIsCheckedIn(false)
      // 時刻データは保持（データベースから読み込まれるため）
    }, 2000) // 2秒後に出勤状態のみリセット
  }

  // 新しい日へのリセット処理
  const resetForNewDay = () => {
    setIsCheckedIn(false)
    setIsOnBreak(false)
    setCheckInTime(undefined)
    setCheckOutTime(undefined)
    setBreakStartTime(undefined)
    setBreakEndTime(undefined)
    setBusyLevel(50)
    setBusyComment('')
  }

  // 休憩開始処理
  const handleBreakStart = async () => {
    if (!session?.user?.email) return

    const now = new Date().toISOString()
    setBreakStartTime(now)
    setIsOnBreak(true)

    try {
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        break_start_time: now,
      })
    } catch (error) {
      console.error('休憩開始記録の保存エラー:', error)
    }
  }

  // 休憩終了処理
  const handleBreakEnd = async () => {
    if (!session?.user?.email) return

    const now = new Date().toISOString()
    setBreakEndTime(now)
    setIsOnBreak(false)

    try {
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        break_end_time: now,
      })
    } catch (error) {
      console.error('休憩終了記録の保存エラー:', error)
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
    } catch (error) {
      console.error('忙しさレベル記録の保存エラー:', error)
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
