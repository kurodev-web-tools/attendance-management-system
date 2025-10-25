'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, Clock, TrendingUp, Settings } from 'lucide-react'
import { formatTime, formatMinutesToTime } from '@/lib/timeUtils'
import { supabase, type AttendanceRecord } from '@/lib/supabase'
import { AttendanceManagement } from './AttendanceManagement'

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
  const [selectedUser, setSelectedUser] = useState<UserAttendance | null>(null)
  const [userAttendanceRecords, setUserAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [showManagement, setShowManagement] = useState(false)

  // 全ユーザーの勤怠状況を取得
  const fetchAllUsersAttendance = useCallback(async () => {
    setLoading(true)
    try {
      // 今日の日付を取得
      const today = new Date().toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-')
      
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
          
          // 重複を除去してユニークな出退勤ペアを構築
          const uniqueRecords = new Map<string, AttendanceRecord>()
          
          console.log(`管理者ダッシュボード - ユーザー ${userId} のレコード処理開始:`, userRecords.map(r => ({
            出勤: r.check_in_time,
            退勤: r.check_out_time,
            作成日時: r.created_at
          })))

          userRecords.forEach((record, index) => {
            console.log(`管理者ダッシュボード - レコード処理 [${index + 1}]:`, {
              出勤: record.check_in_time,
              退勤: record.check_out_time,
              作成日時: record.created_at
            })
            
            if (record.check_in_time) {
              const key = `${record.check_in_time}`
              if (!uniqueRecords.has(key) || !uniqueRecords.get(key)!.check_out_time) {
                uniqueRecords.set(key, record)
              }
            }
          })

          // ユニークなレコードからdisplayRecordsを構築
          const displayRecords: AttendanceRecord[] = Array.from(uniqueRecords.values())

          console.log(`管理者ダッシュボード - 構築されたdisplayRecords:`, displayRecords.map(r => ({
            出勤: r.check_in_time,
            退勤: r.check_out_time
          })))

          // 総勤務時間を計算
          let totalWorkMinutes = 0
          displayRecords.forEach((record) => {
            if (!record.check_in_time) return

            if (record.check_out_time) {
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
              // 現在勤務中の場合（退勤時刻がない）
              const start = new Date(record.check_in_time)
              const end = new Date(record.created_at)
              const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
              const diffMinutes = Math.max(1, Math.ceil(diffSeconds / 60))
              totalWorkMinutes += diffMinutes
              
              console.log(`管理者ダッシュボード勤務時間計算 [現在勤務中] ${userId}:`, {
                出勤時刻: record.check_in_time,
                作成時刻: record.created_at,
                計算結果: diffMinutes,
                累積: totalWorkMinutes
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
        // 最新の記録の出勤時刻と退勤時刻を比較
        if (latestRecord.check_in_time && !latestRecord.check_out_time) {
          // 出勤時刻はあるが退勤時刻がない場合は勤務中
          userAttendance.currentStatus = 'working'
        } else if (latestRecord.check_in_time && latestRecord.check_out_time) {
          // 出勤時刻と退勤時刻の両方がある場合は退勤済み
          userAttendance.currentStatus = 'checked_out'
        } else {
          // 出勤時刻がない場合は未出勤
          userAttendance.currentStatus = 'not_checked_in'
        }

        console.log(`管理者ダッシュボード状況判定 ${userId}:`, {
          出勤時刻: latestRecord.check_in_time,
          退勤時刻: latestRecord.check_out_time,
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

  // 選択されたユーザーの勤怠記録を取得
  const fetchUserAttendanceRecords = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('ユーザー勤怠記録取得エラー:', error)
        return
      }

      setUserAttendanceRecords(data || [])
    } catch (error) {
      console.error('ユーザー勤怠記録取得エラー:', error)
    }
  }, [])

  // ユーザー選択時の処理
  const handleUserSelect = (user: UserAttendance) => {
    setSelectedUser(user)
    fetchUserAttendanceRecords(user.user_id)
    setShowManagement(true)
  }

  // 管理画面を閉じる
  const handleCloseManagement = () => {
    setShowManagement(false)
    setSelectedUser(null)
    setUserAttendanceRecords([])
  }

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

  // 勤怠管理画面を表示
  if (showManagement && selectedUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleCloseManagement} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            管理者ダッシュボードに戻る
          </Button>
        </div>
        <AttendanceManagement
          userId={selectedUser.user_id}
          userEmail={selectedUser.email}
          attendanceRecords={userAttendanceRecords}
          onUpdate={() => {
            fetchAllUsersAttendance()
            fetchUserAttendanceRecords(selectedUser.user_id)
          }}
        />
      </div>
    )
  }

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
          <Button 
            onClick={async () => {
              try {
                // 重複レコードを削除
                const { data: allRecords, error } = await supabase
                  .from('attendance_records')
                  .select('*')
                  .order('created_at', { ascending: true })
                
                if (error) throw error
                
                // 重複を検出して削除（より厳密な重複検出）
                const seen = new Set()
                const duplicates: string[] = []
                
                // 作成日時順でソート
                const sortedRecords = allRecords.sort((a, b) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
                
                sortedRecords.forEach((record) => {
                  // 同じユーザー、同じ日付、同じ出勤時刻のレコードを重複として検出
                  const key = `${record.user_id}-${record.date}-${record.check_in_time}`
                  if (seen.has(key)) {
                    console.log(`重複レコード検出:`, {
                      user_id: record.user_id,
                      date: record.date,
                      check_in_time: record.check_in_time,
                      check_out_time: record.check_out_time,
                      created_at: record.created_at,
                      id: record.id
                    })
                    duplicates.push(record.id)
                  } else {
                    seen.add(key)
                  }
                })
                
                if (duplicates.length > 0) {
                  const { error: deleteError } = await supabase
                    .from('attendance_records')
                    .delete()
                    .in('id', duplicates)
                  
                  if (deleteError) throw deleteError
                  
                  console.log(`重複レコード ${duplicates.length} 件を削除しました`)
                  fetchAllUsersAttendance()
                } else {
                  console.log('重複レコードはありませんでした')
                }
              } catch (error) {
                console.error('重複レコード削除エラー:', error)
              }
            }}
            variant="outline"
            className="flex items-center gap-2"
          >
            重複削除
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
              最終更新: {lastUpdated.toLocaleTimeString('ja-JP', {timeZone: 'Asia/Tokyo'})}
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
                  
                  <div className="flex items-center gap-4">
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUserSelect(user)}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      管理
                    </Button>
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
