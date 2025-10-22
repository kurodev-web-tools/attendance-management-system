'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, Clock, TrendingUp, Download } from 'lucide-react'
import { formatTime, formatMinutesToTime } from '@/lib/timeUtils'
import { supabase, type AttendanceRecord } from '@/lib/supabase'

interface UserAttendance {
  user_id: string
  email: string
  todayWorkMinutes: number
  currentStatus: 'working' | 'checked_out' | 'not_checked_in'
  checkInTime: string | null
  checkOutTime: string | null
  busyLevel: number | null
  busyComment: string | null
}

interface AdminDashboardProps {
  onBack: () => void
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [usersAttendance, setUsersAttendance] = useState<UserAttendance[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // 全ユーザーの勤怠状況を取得
  const fetchAllUsersAttendance = useCallback(async () => {
    setLoading(true)
    try {
      // 今日の日付を取得
      const today = new Date().toISOString().split('T')[0]
      
      // 全ユーザーの今日の勤怠記録を取得
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('date', today)
        .order('created_at', { ascending: false })

      if (attendanceError) {
        console.error('勤怠データ取得エラー:', attendanceError)
        return
      }

      // 全ユーザーの今日の忙しさレベルを取得
      const { data: busyData, error: busyError } = await supabase
        .from('busy_levels')
        .select('*')
        .eq('date', today)

      if (busyError) {
        console.error('忙しさデータ取得エラー:', busyError)
        return
      }

      // ユーザー別にデータを集計
      const userMap = new Map<string, UserAttendance>()

      // 勤怠データを処理（日付順でソート）
      const sortedAttendanceData = attendanceData?.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ) || []

      // まず各ユーザーの最新の記録を特定
      const latestRecords = new Map<string, AttendanceRecord>()
      sortedAttendanceData.forEach(record => {
        const userId = record.user_id
        const existingRecord = latestRecords.get(userId)
        if (!existingRecord || new Date(record.created_at) > new Date(existingRecord.created_at)) {
          latestRecords.set(userId, record)
        }
      })

        // 各ユーザーの今日の総勤務時間を計算
        latestRecords.forEach((latestRecord, userId) => {
          const userRecords = sortedAttendanceData.filter(record => record.user_id === userId)
          
          // 実際の出退勤ペアを構築（メインページと同じロジック）
          const displayRecords: AttendanceRecord[] = []
          let currentCheckIn: AttendanceRecord | null = null

          for (const record of userRecords) {
            if (record.check_in_time && !currentCheckIn) {
              // 出勤記録を開始
              currentCheckIn = record
            } else if (record.check_out_time && currentCheckIn) {
              // 退勤記録でペアを完成
              // ただし、出勤時刻が退勤時刻より後の場合は再出勤として扱う
              if (currentCheckIn.check_in_time && new Date(currentCheckIn.check_in_time) > new Date(record.check_out_time)) {
                // 再出勤の場合：前回の出勤記録を退勤なしで追加し、新しい出勤記録を開始
                displayRecords.push(currentCheckIn)
                currentCheckIn = record
              } else {
                // 通常の退勤の場合
                displayRecords.push({
                  ...currentCheckIn,
                  check_out_time: record.check_out_time
                })
                currentCheckIn = null
              }
            } else if (record.check_in_time && currentCheckIn) {
              // 既に出勤中に新しい出勤記録がある場合（再出勤）
              // 前回の出勤記録を退勤なしで追加
              displayRecords.push(currentCheckIn)
              currentCheckIn = record
            }
          }

          // 最後に出勤のみの場合は現在勤務中として追加
          if (currentCheckIn) {
            displayRecords.push(currentCheckIn)
          }

          // 総勤務時間を計算
          let totalWorkMinutes = 0
          displayRecords.forEach((record) => {
            if (!record.check_in_time) return

            // 再出勤の判定：出勤時刻が退勤時刻より後の場合は現在勤務中として扱う
            const isRecheckIn = record.check_out_time &&
              new Date(record.check_in_time) > new Date(record.check_out_time)

            if (record.check_out_time && !isRecheckIn) {
              // 完了したペアの場合
              const start = new Date(record.check_in_time)
              const end = new Date(record.check_out_time)
              const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
              const diffMinutes = Math.max(1, Math.ceil(diffSeconds / 60))
              totalWorkMinutes += diffMinutes
              
              console.log(`管理者ダッシュボード勤務時間計算 [完了済み] ${userId}:`, {
                出勤時刻: record.check_in_time,
                退勤時刻: record.check_out_time,
                計算結果: diffMinutes,
                累積: totalWorkMinutes
              })
            } else {
              // 現在勤務中の場合（退勤時刻がない、または再出勤）
              const start = new Date(record.check_in_time)
              const end = new Date(record.created_at)
              const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
              const diffMinutes = Math.max(1, Math.ceil(diffSeconds / 60))
              totalWorkMinutes += diffMinutes
              
              console.log(`管理者ダッシュボード勤務時間計算 [現在勤務中] ${userId}:`, {
                出勤時刻: record.check_in_time,
                作成時刻: record.created_at,
                計算結果: diffMinutes,
                累積: totalWorkMinutes,
                再出勤判定: isRecheckIn
              })
            }
          })

        // ユーザー情報を設定
        const userAttendance: UserAttendance = {
          user_id: userId,
          email: userId,
          todayWorkMinutes: totalWorkMinutes,
          currentStatus: 'not_checked_in',
          checkInTime: latestRecord.check_in_time || null,
          checkOutTime: latestRecord.check_out_time || null,
          busyLevel: null,
          busyComment: null
        }

        // 現在の状況を判定
        // 再出勤の判定：出勤時刻が退勤時刻より後の場合は現在勤務中として扱う
        const isRecheckIn = latestRecord.check_out_time && latestRecord.check_in_time &&
          new Date(latestRecord.check_in_time) > new Date(latestRecord.check_out_time)

        if (latestRecord.check_in_time && (!latestRecord.check_out_time || isRecheckIn)) {
          userAttendance.currentStatus = 'working'
        } else if (latestRecord.check_out_time && !isRecheckIn) {
          userAttendance.currentStatus = 'checked_out'
        } else {
          userAttendance.currentStatus = 'not_checked_in'
        }

        console.log(`管理者ダッシュボード状況判定 ${userId}:`, {
          出勤時刻: latestRecord.check_in_time,
          退勤時刻: latestRecord.check_out_time,
          再出勤判定: isRecheckIn,
          判定結果: userAttendance.currentStatus,
          総勤務時間: totalWorkMinutes
        })

        userMap.set(userId, userAttendance)
      })

      // 忙しさデータを処理
      busyData?.forEach(busy => {
        const userId = busy.user_id
        if (userMap.has(userId)) {
          const userAttendance = userMap.get(userId)!
          userAttendance.busyLevel = busy.level
          userAttendance.busyComment = busy.comment
        }
      })

      setUsersAttendance(Array.from(userMap.values()))
      setLastUpdated(new Date())
    } catch (error) {
      console.error('データ取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 初期データ取得
  useEffect(() => {
    fetchAllUsersAttendance()
  }, [fetchAllUsersAttendance])

  // 5分ごとにデータを更新
  useEffect(() => {
    const interval = setInterval(fetchAllUsersAttendance, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchAllUsersAttendance])

  // 状況表示の色を取得
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working':
        return 'text-green-600 bg-green-50'
      case 'checked_out':
        return 'text-blue-600 bg-blue-50'
      case 'not_checked_in':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  // 状況表示のテキストを取得
  const getStatusText = (status: string) => {
    switch (status) {
      case 'working':
        return '勤務中'
      case 'checked_out':
        return '退勤済み'
      case 'not_checked_in':
        return '未出勤'
      default:
        return '不明'
    }
  }

  // 今日の合計勤務時間を計算
  const totalWorkMinutes = usersAttendance.reduce((total, user) => total + user.todayWorkMinutes, 0)
  
  // 勤務中の人数
  const workingCount = usersAttendance.filter(user => user.currentStatus === 'working').length

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>
        <div className="flex items-center gap-4">
          <Button onClick={fetchAllUsersAttendance} disabled={loading} className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            更新
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            エクスポート
          </Button>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">総ユーザー数</p>
                <p className="text-2xl font-bold">{usersAttendance.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">勤務中</p>
                <p className="text-2xl font-bold">{workingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">今日の合計</p>
                <p className="text-2xl font-bold">{formatMinutesToTime(totalWorkMinutes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ユーザー一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            ユーザー勤怠状況
            <span className="text-sm text-gray-500 ml-auto">
              最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2">読み込み中...</p>
            </div>
          ) : usersAttendance.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">ユーザーの勤怠データがありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {usersAttendance.map((user) => (
                <div key={user.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.currentStatus)}`}>
                          {getStatusText(user.currentStatus)}
                        </span>
                        {user.busyLevel !== null && (
                          <span className="text-xs text-gray-500">
                            忙しさ: {user.busyLevel}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-medium">{formatMinutesToTime(user.todayWorkMinutes)}</p>
                    <div className="text-sm text-gray-500">
                      {user.checkInTime && (
                        <p>出勤: {formatTime(user.checkInTime)}</p>
                      )}
                      {user.checkOutTime && (
                        <p>退勤: {formatTime(user.checkOutTime)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
