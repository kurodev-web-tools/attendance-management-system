'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { toast } from 'sonner'
import { AttendanceButtons } from '@/components/AttendanceButtons'
import { BusyLevelMeter } from '@/components/BusyLevelMeter'
import { HistoryView } from '@/components/HistoryView'
import { AdminDashboard } from '@/components/AdminDashboard'
import { Report } from '@/components/Report'
import { TodayWorkTimeChart } from '@/components/TodayWorkTimeChart'
import { WeeklyWorkTimeChart } from '@/components/WeeklyWorkTimeChart'
import { BusyLevelChart } from '@/components/BusyLevelChart'
import { formatTime } from '@/lib/timeUtils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, TrendingUp, LogOut, Settings, Calendar } from 'lucide-react'
import { SettingsView } from '@/components/SettingsView'
import { saveAttendanceRecord, getAttendanceRecord, saveBusyLevel, getBusyLevel } from '@/lib/database'
import { supabase, AttendanceRecord } from '@/lib/supabase'
import { calculateTodayWorkTime, calculateMinutesBetween, formatMinutesToTime } from '@/lib/timeUtils'
import { isAdmin } from '@/lib/admin'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useLongWorkWarning } from '@/hooks/useLongWorkWarning'
import { useOvertimeNotification } from '@/hooks/useOvertimeNotification'
import { useNotificationReminders } from '@/hooks/useNotificationReminders'

export default function Home() {
  const { data: session, status } = useSession()
  const { settings } = useUserSettings(session?.user?.email || '')
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [checkInTime, setCheckInTime] = useState<string>()
  const [checkOutTime, setCheckOutTime] = useState<string>()
  useLongWorkWarning(settings, checkInTime, isCheckedIn)
  useOvertimeNotification(settings, checkInTime, isCheckedIn)
  useNotificationReminders(settings)
  const [busyLevel, setBusyLevel] = useState(50)
  const [busyComment, setBusyComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}))
  const [showHistory, setShowHistory] = useState(false)
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [showMonthlyReport, setShowMonthlyReport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // 今日の日付を取得（日本時間基準）
  const today = new Date().toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-')
  console.log('今日の日付（日本時間）:', today)


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
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [workDaysStats, setWorkDaysStats] = useState({
    monthlyWorkDays: 0,
    yearlyWorkDays: 0,
  })
  
  useEffect(() => {
    // 累積勤務時間と勤務日数を計算
    const calculateTotalWorkTime = async () => {
      if (session?.user?.email) {
        try {
            // 今日の全ての勤怠記録を取得
            const { data: allRecords } = await supabase
              .from('attendance_records')
              .select('*')
              .eq('user_id', session.user.email)
            .eq('date', today)
            .not('check_in_time', 'is', null)
            .order('created_at', { ascending: true }) // 時系列順でソート
          
          if (allRecords && allRecords.length > 0) {
            let totalMinutes = 0
            
            // 出勤・退勤ペアを正しく処理（日付ごとにグループ化）
            const recordsByDate = allRecords.reduce((groups, record) => {
              const date = record.date
              if (!groups[date]) {
                groups[date] = []
              }
              groups[date].push(record)
              return groups
            }, {} as Record<string, typeof allRecords>)
            
            // 各日の勤務時間を計算
            Object.values(recordsByDate).forEach(dayRecords => {
              const records = dayRecords as AttendanceRecord[]
              // 作成日時順でソート
              const sortedRecords = records.sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
              
              // 重複を除去してユニークな出退勤ペアを構築
              const uniqueRecords = new Map<string, AttendanceRecord>()
              
              sortedRecords.forEach((record, index) => {
                console.log(`レコード処理 [${index + 1}]:`, {
                  出勤: record.check_in_time,
                  退勤: record.check_out_time,
                  作成日時: record.created_at
                })
                
                if (record.check_in_time) {
                  const key = `${record.check_in_time}`
                  if (!uniqueRecords.has(key) || !uniqueRecords.get(key)?.check_out_time) {
                    uniqueRecords.set(key, record)
                  }
                }
              })
              
              // ユニークなレコードから勤務時間を計算
              uniqueRecords.forEach((record) => {
                if (record.check_in_time && record.check_out_time) {
                  // 完了したペアの場合
                  const minutes = calculateMinutesBetween(record.check_in_time, record.check_out_time)
                  totalMinutes += minutes
                  console.log(`勤務時間計算 [完了済み]:`, {
                    checkInTime: record.check_in_time,
                    checkOutTime: record.check_out_time,
                    minutes,
                    totalMinutes
                  })
                } else if (record.check_in_time && !record.check_out_time) {
                  // 現在勤務中の場合
                  const minutes = calculateMinutesBetween(record.check_in_time, new Date().toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}))
                  totalMinutes += minutes
                  console.log(`勤務時間計算 [現在勤務中]:`, {
                    checkInTime: record.check_in_time,
                    checkOutTime: '現在時刻',
                    minutes,
                    totalMinutes
                  })
                }
              })
              
            })
            
            // デバッグ情報を追加
            console.log('累積勤務時間計算詳細:', {
              allRecordsCount: allRecords.length,
              isCheckedIn,
              checkOutTime,
              totalMinutes
            })
            
            setTotalWorkMinutes(totalMinutes)
            console.log('最終累積勤務時間:', totalMinutes)
            
            // 勤務日数を計算
            await calculateWorkDays()
          }
        } catch (error) {
          console.error('累積勤務時間の計算エラー:', error)
        }
      }
    }

    // 勤務日数を計算する関数
    const calculateWorkDays = async () => {
      if (session?.user?.email) {
        try {
          const currentDate = new Date()
          const currentYear = currentDate.getFullYear()
          const currentMonth = currentDate.getMonth() + 1
          const currentDay = currentDate.getDate()
          
          // 今月の開始日と終了日を計算
          const monthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`
          const monthEnd = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`
          
          // 今年の開始日を計算
          const yearStart = `${currentYear}-01-01`
          const yearEnd = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`
          
          // 今月の勤怠記録を取得
          const { data: monthlyRecords } = await supabase
            .from('attendance_records')
            .select('date, check_in_time, check_out_time')
            .eq('user_id', session.user.email)
            .gte('date', monthStart)
            .lte('date', monthEnd)
            .not('check_in_time', 'is', null)
          
          // 今年の勤怠記録を取得
          const { data: yearlyRecords } = await supabase
            .from('attendance_records')
            .select('date, check_in_time, check_out_time')
            .eq('user_id', session.user.email)
            .gte('date', yearStart)
            .lte('date', yearEnd)
            .not('check_in_time', 'is', null)
          
          if (monthlyRecords && yearlyRecords) {
            // 月間勤務日数を計算
            const monthlyWorkDaysByDate = new Set<string>()
            monthlyRecords.forEach(record => {
              if (record.check_in_time) {
                monthlyWorkDaysByDate.add(record.date)
              }
            })
            
            // 年間勤務日数を計算
            const yearlyWorkDaysByDate = new Set<string>()
            yearlyRecords.forEach(record => {
              if (record.check_in_time) {
                yearlyWorkDaysByDate.add(record.date)
              }
            })
            
            const monthlyWorkDays = monthlyWorkDaysByDate.size
            const yearlyWorkDays = yearlyWorkDaysByDate.size
            
            setWorkDaysStats({
              monthlyWorkDays,
              yearlyWorkDays
            })
            
            console.log('勤務日数計算完了:', {
              monthlyWorkDays,
              yearlyWorkDays,
              monthStart,
              monthEnd,
              yearStart,
              yearEnd
            })
          }
        } catch (error) {
          console.error('勤務日数の計算エラー:', error)
        }
      }
    }

    calculateTotalWorkTime()
  }, [session?.user?.email, today, isCheckedIn, checkOutTime, checkInTime, refreshTrigger])

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
              
              console.log('出勤時刻（日本時間）:', latestCheckIn)
              console.log('退勤時刻（日本時間）:', latestCheckOut)
              if (latestCheckIn) {
                console.log('出勤時刻（表示）:', formatTime(latestCheckIn))
              }
              if (latestCheckOut) {
                console.log('退勤時刻（表示）:', formatTime(latestCheckOut))
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
                // 時刻文字列をそのまま返す（UTC変換しない）
                return timeStr
              }
              
              setCheckInTime(normalizeTimeString(latestCheckIn))
              setCheckOutTime(normalizeTimeString(latestCheckOut))
              
              console.log('設定された出勤時刻（日本時間）:', normalizeTimeString(latestCheckIn))
              console.log('設定された退勤時刻（日本時間）:', normalizeTimeString(latestCheckOut))
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

  // ページフォーカス時に累積勤務時間を再計算
  useEffect(() => {
    const handleFocus = () => {
      setRefreshTrigger(prev => prev + 1)
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // 勤務時間をリアルタイム更新（10分ごと）
  useEffect(() => {
    if (isCheckedIn && !checkOutTime) {
      const timer = setInterval(() => {
        // 現在時刻を更新して勤務時間を再計算（ローディング画面は表示しない）
        const now = new Date().toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').replace(' ', 'T')
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
          onUpdate={() => {
            // 履歴データの再取得をトリガー
            console.log('履歴データの再取得をトリガー')
          }}
        />
      </div>
    )
  }

  // レポート表示の場合はレポートコンポーネントを表示
  if (showMonthlyReport) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Report 
          onBack={() => setShowMonthlyReport(false)} 
        />
      </div>
    )
  }

  // 出勤処理
  const handleCheckIn = async () => {
    if (!session?.user?.email) return

    setLoading(true)
    // 日本時間で現在時刻を取得（ISO形式で統一）
    const now = new Date().toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').replace(' ', 'T').replace(/\//g, '-').replace(' ', 'T')
    console.log('保存する時刻（日本時間）:', now)
    console.log('表示時刻（JST）:', now)
    
    // 重複防止：ローディング中は処理をスキップ
    if (loading) {
      console.log('既に処理中です。処理をスキップします。')
      return
    }

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
        check_out_time: null, // 新しい出勤記録では退勤時刻はnull
      })
      
      await saveAttendanceRecord({
        user_id: session.user.email,
        date: today,
        check_in_time: now,
        check_out_time: null, // 新しい出勤記録では退勤時刻はnull
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
    // 日本時間で現在時刻を取得
    const now = new Date().toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').replace(' ', 'T')
    
    // 重複防止：ローディング中は処理をスキップ
    if (loading) {
      console.log('既に処理中です。処理をスキップします。')
      return
    }

    console.log('=== 退勤処理開始 ===')
    console.log('退勤時刻:', now)
    console.log('現在の出勤時刻:', checkInTime)
    
    setIsCheckedIn(false)

    try {
      // 既存の出勤レコードを更新（退勤時刻を追加）
      const { error: updateError } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: now,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', session.user.email)
        .eq('date', today)
        .eq('check_in_time', checkInTime)
        .is('check_out_time', null) // 退勤時刻がnullのレコードのみ更新
      
      if (updateError) {
        console.error('勤怠記録の更新エラー:', updateError)
        throw updateError
      }
      
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
    <div className="container mx-auto px-2 py-8">
      <div className="max-w-[95vw] mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
              <div className="order-2 sm:order-1"></div>
              <h1 className="text-2xl sm:text-3xl font-bold text-blue-900 order-1 sm:order-2">
                勤怠管理システム
              </h1>
              <div className="flex flex-wrap gap-2 order-3">
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 text-sm bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  size="sm"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">設定</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex items-center gap-2 text-sm bg-white hover:bg-gray-100 hover:border-gray-300 transition-colors"
                  size="sm"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">ログアウト</span>
                </Button>
              </div>
            </div>
            <p className="text-gray-700 text-center text-sm sm:text-base font-medium">
              こんにちは、{session.user?.name}さん！今日も一日お疲れ様です
            </p>
          </div>
        </div>

        {/* メインコンテンツ - 横並びレイアウト */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          {/* 左カラム：勤怠記録・忙しさメーター・統計情報 */}
          <div className="xl:col-span-2 space-y-6">
            {/* 勤怠記録と忙しさメーター */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AttendanceButtons
                isCheckedIn={isCheckedIn}
                checkInTime={checkInTime}
                checkOutTime={checkOutTime}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                disabled={loading}
                recommendedStartTime={settings?.recommended_start_time}
                recommendedEndTime={settings?.recommended_end_time}
              />

              <BusyLevelMeter
                initialLevel={busyLevel}
                initialComment={busyComment}
                onUpdate={handleBusyLevelUpdate}
                busyLevelDescriptions={settings?.busy_level_descriptions}
                busyLevelColors={settings?.busy_level_colors}
              />
            </div>

            {/* 統計情報 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-100 to-blue-200 border-b border-blue-300">
              <CardTitle className="text-base font-semibold text-blue-900">今日の勤務時間</CardTitle>
              <Clock className="h-6 w-6 text-blue-700" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-900">{workTimeCalculation.formattedNetWorkTime}</div>
              <p className="text-sm text-blue-700 mt-1">
                実働時間
              </p>
              {settings?.standard_work_hours && (
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <div>
                    標準勤務時間: {settings.standard_work_hours}時間
                    {workTimeCalculation.totalWorkMinutes > 0 && (
                      <span className={`ml-2 ${
                        workTimeCalculation.totalWorkMinutes >= settings.standard_work_hours * 60 
                          ? 'text-green-600' 
                          : 'text-orange-600'
                      }`}>
                        ({workTimeCalculation.totalWorkMinutes >= settings.standard_work_hours * 60 ? '達成' : '未達成'})
                      </span>
                    )}
                  </div>
                  {settings.break_duration > 0 && (
                    <div>
                      休憩時間: {settings.break_duration}分
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>


          <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-100 to-blue-200 border-b border-blue-200">
              <CardTitle className="text-sm font-semibold text-blue-900">累積勤務時間</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // 累積勤務時間を再計算
                    const calculateTotalWorkTime = async () => {
                      if (!session?.user?.email) return
                      
                      try {
                        const { data: allRecords, error } = await supabase
                          .from('attendance_records')
                          .select('*')
                          .eq('user_id', session.user.email)
                          .order('created_at', { ascending: true })
                        
                        if (error) throw error
                        
                        let totalMinutes = 0
                        
                        // 出勤・退勤ペアを正しく処理（日付ごとにグループ化）
                        const recordsByDate = allRecords.reduce((groups, record) => {
                          const date = record.date
                          if (!groups[date]) {
                            groups[date] = []
                          }
                          groups[date].push(record)
                          return groups
                        }, {} as Record<string, typeof allRecords>)
                        
                        // 各日の勤務時間を計算
                        Object.values(recordsByDate).forEach(dayRecords => {
                          const records = dayRecords as AttendanceRecord[]
                          // 作成日時順でソート
                          const sortedRecords = records.sort((a, b) => 
                            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                          )
                          
                          // 重複を除去してユニークな出退勤ペアを構築
                          const uniqueRecords = new Map<string, AttendanceRecord>()
                          
                          sortedRecords.forEach((record) => {
                            if (record.check_in_time) {
                              const key = `${record.check_in_time}`
                              if (!uniqueRecords.has(key) || !uniqueRecords.get(key)?.check_out_time) {
                                uniqueRecords.set(key, record)
                              }
                            }
                          })
                          
                          // ユニークなレコードから勤務時間を計算
                          uniqueRecords.forEach((record) => {
                            if (record.check_in_time && record.check_out_time) {
                              // 完了したペアの場合
                              const minutes = calculateMinutesBetween(record.check_in_time, record.check_out_time)
                              totalMinutes += minutes
                            } else if (record.check_in_time && !record.check_out_time) {
                              // 現在勤務中の場合
                              const minutes = calculateMinutesBetween(record.check_in_time, new Date().toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}))
                              totalMinutes += minutes
                            }
                          })
                        })
                        
                        setTotalWorkMinutes(totalMinutes)
                        console.log('累積勤務時間を再計算:', totalMinutes)
                        // refreshTriggerを更新してuseEffectをトリガー
                        setRefreshTrigger(prev => prev + 1)
                      } catch (error) {
                        console.error('累積勤務時間の再計算エラー:', error)
                      }
                    }
                    
                    calculateTotalWorkTime()
                  }}
                >
                  更新
                </Button>
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{formatMinutesToTime(totalWorkMinutes)}</div>
              <p className="text-xs text-blue-700">
                複数回出退勤合計
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-100 to-blue-200 border-b border-blue-200">
              <CardTitle className="text-sm font-semibold text-blue-900">勤務日数</CardTitle>
              <Calendar className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">月間</span>
                  <span className="text-lg font-bold">{workDaysStats.monthlyWorkDays}日</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">年間</span>
                  <span className="text-lg font-bold">{workDaysStats.yearlyWorkDays}日</span>
                </div>
              </div>
              <p className="text-xs text-blue-700 mt-2">
                出勤記録がある日数
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-100 to-blue-200 border-b border-blue-200">
              <CardTitle className="text-sm font-semibold text-blue-900">忙しさレベル</CardTitle>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{busyLevel}%</div>
              <p className="text-xs text-blue-700">
                現在の状況
              </p>
            </CardContent>
          </Card>
            </div>
          </div>

          {/* 右カラム：グラフ表示 */}
          <div className="xl:col-span-1 space-y-6">
            <TodayWorkTimeChart 
              checkInTime={checkInTime} 
              checkOutTime={checkOutTime} 
              currentTime={currentTime}
            />
            <WeeklyWorkTimeChart userId={session?.user?.email || ''} />
            <BusyLevelChart userId={session?.user?.email || ''} />
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex flex-wrap justify-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowHistory(true)}
            className="bg-white hover:bg-gray-50 border-gray-300 hover:border-gray-400 transition-colors"
            size="sm"
          >
            履歴確認
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowMonthlyReport(true)}
            className="bg-white hover:bg-gray-50 border-gray-300 hover:border-gray-400 transition-colors"
            size="sm"
          >
            <Calendar className="h-4 w-4 mr-1" />
            レポート
          </Button>
          {isAdmin(session?.user?.email) && (
            <Button 
              variant="outline" 
              onClick={() => setShowAdminDashboard(true)} 
              className="bg-white hover:bg-blue-50 border-blue-300 hover:border-blue-400 text-blue-700 transition-colors"
              size="sm"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">管理者</span>
              <span className="sm:hidden ml-1">管理</span>
            </Button>
          )}
          {checkOutTime && (
            <Button 
              variant="outline" 
              onClick={resetForNewDay}
              className="bg-amber-50 hover:bg-amber-100 border-amber-300 hover:border-amber-400 text-amber-700 transition-colors"
              size="sm"
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
          onUpdate={() => {
            // 履歴データの再取得をトリガー
            console.log('履歴データの再取得をトリガー')
            // 累積勤務時間の再計算をトリガー
            setRefreshTrigger(prev => prev + 1)
          }}
        />
      )}

      {/* 管理者ダッシュボード */}
      {showAdminDashboard && (
        <AdminDashboard 
          onBack={() => {
            setShowAdminDashboard(false)
            // 管理者ダッシュボードから戻る時に累積勤務時間を再計算
            setRefreshTrigger(prev => prev + 1)
          }} 
        />
      )}

      {/* 設定画面 */}
      {showSettings && (
        <SettingsView 
          userId={session?.user?.email || ''} 
          onBack={() => setShowSettings(false)} 
        />
      )}
    </div>
  )
}
