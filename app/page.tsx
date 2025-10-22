'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { toast } from 'sonner'
import { AttendanceButtons } from '@/components/AttendanceButtons'
import { BusyLevelMeter } from '@/components/BusyLevelMeter'
import { HistoryView } from '@/components/HistoryView'
import { AdminDashboard } from '@/components/AdminDashboard'
import { MonthlyReport } from '@/components/MonthlyReport'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Clock, TrendingUp, LogOut, Settings } from 'lucide-react'
import { saveAttendanceRecord, getAttendanceRecord, saveBusyLevel, getBusyLevel } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { calculateTodayWorkTime, getCurrentTimeFromServer, calculateMinutesBetween, formatMinutesToTime } from '@/lib/timeUtils'
import { isAdmin } from '@/lib/admin'

export default function Home() {
  const { data: session, status } = useSession()
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [checkInTime, setCheckInTime] = useState<string>()
  const [checkOutTime, setCheckOutTime] = useState<string>()
  const [busyLevel, setBusyLevel] = useState(50)
  const [busyComment, setBusyComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>(new Date().toISOString())
  const [showHistory, setShowHistory] = useState(false)
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [showMonthlyReport, setShowMonthlyReport] = useState(false)

  // 今日の日付を取得（UTC基準）
  const today = new Date().toISOString().split('T')[0]
  console.log('今日の日付（UTC）:', today)


  // 今日の勤務時間を計算（currentTimeを依存関係に追加してリアルタイム更新）
  const workTimeCalculation = calculateTodayWorkTime(
    checkInTime,
    checkOutTime,
    null, // breakStartTime
    null, // breakEndTime
    currentTime
  )
  
  // 累積勤務時間を計算（複数回の出退勤を考慮）
  const [totalWorkMinutes, setTotalWorkMinutes] = useState(0)
  
  useEffect(() => {
    // 累積勤務時間を計算
    const calculateTotalWorkTime = async () => {
      if (session?.user?.email) {
        try {
          // 今日の全ての勤怠記録を取得
          const { data: allRecords } = await supabase
            .from('attendance_records')
            .select('check_in_time, check_out_time, created_at')
            .eq('user_id', session.user.email)
            .eq('date', today)
            .not('check_in_time', 'is', null)
            .order('created_at', { ascending: true }) // 時系列順でソート
          
          if (allRecords && allRecords.length > 0) {
            let totalMinutes = 0
            
            // 出退勤のペアを作成して計算（時系列順で処理）
            let currentCheckIn: string | null = null
            
            allRecords.forEach((record, index) => {
              if (record.check_in_time && !currentCheckIn) {
                // 出勤記録を開始
                currentCheckIn = record.check_in_time
                console.log(`出勤記録開始 [${index + 1}]:`, currentCheckIn)
              } else if (record.check_out_time && currentCheckIn) {
                // 退勤記録で勤務時間を計算
                const minutes = calculateMinutesBetween(currentCheckIn, record.check_out_time)
                totalMinutes += minutes
                console.log(`勤務時間計算 [${index + 1}]:`, {
                  checkInTime: currentCheckIn,
                  checkOutTime: record.check_out_time,
                  minutes,
                  totalMinutes
                })
                currentCheckIn = null // ペア完了
              } else if (record.check_in_time && currentCheckIn) {
                // 既に出勤中に新しい出勤記録がある場合（再出勤）
                // 前回の出勤から現在時刻まで計算
                const minutes = calculateMinutesBetween(currentCheckIn, new Date().toISOString())
                totalMinutes += minutes
                console.log(`再出勤時の勤務時間計算 [${index + 1}]:`, {
                  checkInTime: currentCheckIn,
                  currentTime: new Date().toISOString(),
                  minutes,
                  totalMinutes
                })
                currentCheckIn = record.check_in_time // 新しい出勤記録を開始
              }
            })
            
            // 最後に出勤のみの場合は現在時刻まで計算（ただし、現在勤務中の場合のみ）
            if (currentCheckIn && isCheckedIn && !checkOutTime) {
              const currentMinutes = calculateMinutesBetween(currentCheckIn, new Date().toISOString())
              totalMinutes += currentMinutes
              console.log('現在勤務中の追加計算:', {
                checkInTime: currentCheckIn,
                currentMinutes,
                totalMinutes,
                currentTime: new Date().toISOString(),
                condition: {
                  currentCheckIn: !!currentCheckIn,
                  isCheckedIn,
                  checkOutTime: !!checkOutTime
                }
              })
            }
            
            // デバッグ情報を追加
            console.log('累積勤務時間計算詳細:', {
              allRecordsCount: allRecords.length,
              currentCheckIn,
              isCheckedIn,
              checkOutTime,
              totalMinutes
            })
            
            setTotalWorkMinutes(totalMinutes)
            console.log('最終累積勤務時間:', totalMinutes)
          }
        } catch (error) {
          console.error('累積勤務時間の計算エラー:', error)
        }
      }
    }
    
    calculateTotalWorkTime()
  }, [session?.user?.email, today, isCheckedIn, checkOutTime])

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
              
              console.log('出勤時刻（UTC）:', latestCheckIn)
              console.log('退勤時刻（UTC）:', latestCheckOut)
              if (latestCheckIn) {
                console.log('出勤時刻（JST表示）:', new Date(latestCheckIn).toLocaleTimeString('ja-JP', {timeZone: 'Asia/Tokyo', hour12: false}))
              }
              if (latestCheckOut) {
                console.log('退勤時刻（JST表示）:', new Date(latestCheckOut).toLocaleTimeString('ja-JP', {timeZone: 'Asia/Tokyo', hour12: false}))
              }
              
              // 出勤状態の判定：出勤時刻があり、退勤時刻がない場合は勤務中
              const isCurrentlyWorking = !!latestCheckIn && !latestCheckOut
              setIsCheckedIn(isCurrentlyWorking)
              
              // デバッグ情報
              console.log('=== 出勤状態判定 ===')
              console.log('出勤時刻:', latestCheckIn)
              console.log('退勤時刻:', latestCheckOut)
              console.log('判定結果:', isCurrentlyWorking ? '出勤中' : '退勤済み')
              console.log('==================')
              console.log('退勤後の出勤時刻保持確認:', { 
                checkInTime: latestCheckIn, 
                checkOutTime: latestCheckOut,
                shouldShowCheckIn: latestCheckIn ? '表示する' : '表示しない'
              })
              
              // 時刻データを設定（確実にUTC文字列として設定）
              // Supabaseから取得した時刻文字列にZが含まれていない場合があるため正規化
              const normalizeTimeString = (timeStr: string | null) => {
                if (!timeStr) return undefined
                // 末尾にZがなければ追加してUTC時刻として認識させる
                return timeStr.endsWith('Z') ? timeStr : timeStr + 'Z'
              }
              
              setCheckInTime(normalizeTimeString(latestCheckIn))
              setCheckOutTime(normalizeTimeString(latestCheckOut))
              
              console.log('設定された出勤時刻（正規化後）:', normalizeTimeString(latestCheckIn))
              console.log('設定された退勤時刻（正規化後）:', normalizeTimeString(latestCheckOut))
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

  // 勤務時間をリアルタイム更新（10分ごと）
  useEffect(() => {
    if (isCheckedIn && !checkOutTime) {
      const timer = setInterval(() => {
        // 現在時刻を更新して勤務時間を再計算（ローディング画面は表示しない）
        const now = new Date().toISOString()
        // 状態更新により自動的に勤務時間が再計算される
        setCurrentTime(now)
      }, 600000) // 10分ごと

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

  // 履歴表示の場合は履歴コンポーネントを表示
  if (showHistory) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <HistoryView 
          userId={session.user?.email || ''} 
          onBack={() => setShowHistory(false)} 
        />
      </div>
    )
  }

  // 月次レポート表示の場合は月次レポートコンポーネントを表示
  if (showMonthlyReport) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <MonthlyReport 
          onBack={() => setShowMonthlyReport(false)} 
        />
      </div>
    )
  }

  // 出勤処理
  const handleCheckIn = async () => {
    if (!session?.user?.email) return

    setLoading(true)
    // サーバーから正確な時刻を取得
    const now = await getCurrentTimeFromServer()
    console.log('保存する時刻（サーバー時刻）:', now)
    console.log('表示時刻（JST）:', new Date(now).toLocaleTimeString('ja-JP', {timeZone: 'Asia/Tokyo', hour12: false}))
    
    // 再出勤時の状態管理
    console.log('=== 再出勤処理開始 ===')
    console.log('現在の状態:', {
      isCheckedIn,
      checkInTime,
      checkOutTime,
      totalWorkMinutes
    })
    console.log('現在の退勤時刻:', checkOutTime)
    console.log('退勤時刻を保持:', checkOutTime ? 'はい' : 'いいえ')
    
    // 忙しさレベルをリセット
    setBusyLevel(50)
    setBusyComment('')
    
    // 出勤状態を設定
    setIsCheckedIn(true)

    try {
      // 再出勤記録を保存（前回の退勤記録を保持しつつ新しい出勤記録を追加）
      console.log('保存する勤怠データ:', {
        user_id: session.user.email,
        date: today,
        check_in_time: now,
        check_out_time: checkOutTime || null, // 前回の退勤時刻を保持
      })
      
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        check_in_time: now,
        check_out_time: checkOutTime || null, // 前回の退勤時刻を保持
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
    // サーバーから正確な時刻を取得
    const now = await getCurrentTimeFromServer()
    
    console.log('=== 退勤処理開始 ===')
    console.log('退勤時刻:', now)
    console.log('現在の出勤時刻:', checkInTime)
    
    setIsCheckedIn(false)

    try {
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        check_out_time: now,
        // 出勤時刻も保持する
        check_in_time: checkInTime || null,
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
    setCheckInTime(undefined)
    setCheckOutTime(undefined)
    setBusyLevel(50)
    setBusyComment('')
    setTotalWorkMinutes(0) // 累積勤務時間もリセット

    // データベースのレコードを完全に削除
    try {
      // 今日の全ての勤怠記録を削除
      const { error: attendanceError } = await supabase
        .from('attendance_records')
        .delete()
        .eq('user_id', session.user.email)
        .eq('date', today)
      
      if (attendanceError) {
        console.error('勤怠記録の削除エラー:', attendanceError)
      }
      
      // 忙しさレベルも削除
      const { error: busyError } = await supabase
        .from('busy_levels')
        .delete()
        .eq('user_id', session.user.email)
        .eq('date', today)
      
      if (busyError) {
        console.error('忙しさレベルの削除エラー:', busyError)
      }
      
      toast.success('勤務データをリセットしました')
    } catch (error) {
      console.error('リセット処理エラー:', error)
      toast.error('リセット処理に失敗しました')
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
            checkInTime={checkInTime}
            checkOutTime={checkOutTime}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
          />

          {/* 忙しさメーター */}
          <BusyLevelMeter
            initialLevel={busyLevel}
            initialComment={busyComment}
            onUpdate={handleBusyLevelUpdate}
          />
        </div>

        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
              <CardTitle className="text-sm font-medium">累積勤務時間</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMinutesToTime(totalWorkMinutes)}</div>
              <p className="text-xs text-muted-foreground">
                複数回出退勤合計
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
          <Button variant="outline" onClick={() => setShowHistory(true)}>
            履歴確認
          </Button>
          {isAdmin(session?.user?.email) && (
            <Button variant="outline" onClick={() => setShowAdminDashboard(true)} className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              管理者ダッシュボード
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowMonthlyReport(true)}>
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
              リセット
            </Button>
          )}
        </div>
      </div>

      {/* 履歴表示 */}
      {showHistory && (
        <HistoryView 
          userId={session?.user?.email || ''} 
          onBack={() => setShowHistory(false)} 
        />
      )}

      {/* 管理者ダッシュボード */}
      {showAdminDashboard && (
        <AdminDashboard 
          onBack={() => setShowAdminDashboard(false)} 
        />
      )}
    </div>
  )
}
