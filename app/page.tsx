'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { AttendanceButtons } from '@/components/AttendanceButtons'
import { BusyLevelMeter } from '@/components/BusyLevelMeter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Clock, TrendingUp, LogOut } from 'lucide-react'

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

  // ローディング中または認証されていない場合はログインページにリダイレクト
  if (status === 'loading') {
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
  const handleCheckIn = () => {
    const now = new Date().toISOString()
    setCheckInTime(now)
    setIsCheckedIn(true)
    // TODO: Supabaseに保存
  }

  // 退勤処理
  const handleCheckOut = () => {
    const now = new Date().toISOString()
    setCheckOutTime(now)
    setIsCheckedIn(false)
    setIsOnBreak(false)
    // TODO: Supabaseに保存
    // 退勤後、再度出勤可能にするため、状態をリセット
    setTimeout(() => {
      setIsCheckedIn(false)
      setCheckInTime(undefined)
      setCheckOutTime(undefined)
      setBreakStartTime(undefined)
      setBreakEndTime(undefined)
    }, 2000) // 2秒後に自動リセット
  }

  // 新しい日へのリセット処理
  const resetForNewDay = () => {
    setIsCheckedIn(false)
    setIsOnBreak(false)
    setCheckInTime(undefined)
    setCheckOutTime(undefined)
    setBreakStartTime(undefined)
    setBreakEndTime(undefined)
  }

  // 休憩開始処理
  const handleBreakStart = () => {
    const now = new Date().toISOString()
    setBreakStartTime(now)
    setIsOnBreak(true)
    // TODO: Supabaseに保存
  }

  // 休憩終了処理
  const handleBreakEnd = () => {
    const now = new Date().toISOString()
    setBreakEndTime(now)
    setIsOnBreak(false)
    // TODO: Supabaseに保存
  }

  // 忙しさレベル更新処理
  const handleBusyLevelUpdate = (level: number, comment: string) => {
    setBusyLevel(level)
    setBusyComment(comment)
    // TODO: Supabaseに保存
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日の勤務時間</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8時間</div>
              <p className="text-xs text-muted-foreground">
                通常勤務時間
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
