'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, TrendingUp, ArrowLeft, ArrowRight } from 'lucide-react'
import { formatTime, formatMinutesToTime } from '@/lib/timeUtils'
import { supabase } from '@/lib/supabase'

interface AttendanceRecord {
  date: string
  check_in_time: string | null
  check_out_time: string | null
  created_at: string
}

interface BusyLevel {
  date: string
  level: number
  comment: string | null
  created_at: string
}

interface HistoryViewProps {
  userId: string
  onBack: () => void
  onUpdate?: () => void
}

export function HistoryView({ userId, onBack }: HistoryViewProps) {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [busyLevels, setBusyLevels] = useState<BusyLevel[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month')

  // 合計勤務時間を計算するヘルパー関数
  const calculateTotalWorkTime = (records: AttendanceRecord[]) => {
    return records.reduce((total, record) => {
      if (!record.check_in_time) return total
      
      if (record.check_out_time) {
        // 完了したペアの場合
        const start = new Date(record.check_in_time)
        const end = new Date(record.check_out_time)
        const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
        const diffMinutes = Math.max(1, Math.ceil(diffSeconds / 60))
        return total + diffMinutes
      } else {
        // 現在勤務中の場合（退勤時刻がない）
        const start = new Date(record.check_in_time)
        const end = new Date(record.created_at)
        const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
        const diffMinutes = Math.max(1, Math.ceil(diffSeconds / 60))
        return total + diffMinutes
      }
    }, 0)
  }

  // 履歴データを取得
  const fetchHistory = useCallback(async (startDate: Date, endDate: Date) => {
    setLoading(true)
    try {
      // タイムゾーンを考慮して日付文字列を生成
      const startDateStr = startDate.toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-')
      const endDateStr = endDate.toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-')
      
      console.log('履歴取得期間:', { startDateStr, endDateStr })

      // 勤怠記録を取得
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: false })

      if (attendanceError) {
        console.error('勤怠記録の取得エラー:', attendanceError)
        return
      }

      // 忙しさレベルを取得
      const { data: busyData, error: busyError } = await supabase
        .from('busy_levels')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: false })

      if (busyError) {
        console.error('忙しさレベルの取得エラー:', busyError)
        return
      }

      setAttendanceRecords(attendanceData || [])
      setBusyLevels(busyData || [])
    } catch (error) {
      console.error('履歴データの取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 編集後の自動再取得
  useEffect(() => {
    const handleUpdate = () => {
      const { start, end } = getDateRange()
      if (start && end) {
        fetchHistory(start, end)
      }
    }
    
    // 編集完了を監視
    const interval = setInterval(handleUpdate, 3000) // 3秒ごとにチェック
    return () => clearInterval(interval)
  }, [currentDate, viewMode])

  // 連続勤務日数を計算
  const calculateConsecutiveWorkDays = (targetDate: string) => {
    let consecutiveDays = 0
    const targetDateObj = new Date(targetDate)
    
    // 日付順でソート（新しい順）
    const sortedRecords = [...attendanceRecords].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    
    for (let i = 0; i < sortedRecords.length; i++) {
      const recordDate = new Date(sortedRecords[i].date)
      const daysDiff = (targetDateObj.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24)
      
      if (daysDiff === consecutiveDays) {
        consecutiveDays++
      } else {
        break
      }
    }
    
    return consecutiveDays
  }


  // 期間を計算
  const getDateRange = useCallback(() => {
    const year = parseInt(currentDate.toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).split('/')[0])
    const month = parseInt(currentDate.toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).split('/')[1]) - 1
    const day = parseInt(currentDate.toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).split('/')[2])
    
    switch (viewMode) {
      case 'day':
        // 日別表示では、現在の日付をそのまま使用
        const dayStart = new Date(year, month, day)
        const dayEnd = new Date(year, month, day)
        console.log('日別表示の期間:', { dayStart, dayEnd })
        return { start: dayStart, end: dayEnd }
      case 'week':
        const startOfWeek = new Date(currentDate)
        startOfWeek.setDate(day - new Date(year, month, day).getDay())
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        return { start: startOfWeek, end: endOfWeek }
      case 'month':
        return {
          start: new Date(year, month, 1),
          end: new Date(year, month + 1, 0)
        }
    }
  }, [currentDate, viewMode])

  // データを取得
  useEffect(() => {
    const { start, end } = getDateRange()
    fetchHistory(start, end)
  }, [getDateRange, fetchHistory])

  // 期間移動
  const movePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    const day = newDate.getDate()
    const month = newDate.getMonth()
    
    switch (viewMode) {
      case 'day':
        newDate.setDate(day + (direction === 'next' ? 1 : -1))
        break
      case 'week':
        newDate.setDate(day + (direction === 'next' ? 7 : -7))
        break
      case 'month':
        newDate.setMonth(month + (direction === 'next' ? 1 : -1))
        break
    }
    
    setCurrentDate(newDate)
  }

  // 今日に戻る
  const goToToday = () => {
    setCurrentDate(new Date())
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          勤怠履歴
        </h1>
        <Button 
          variant="outline" 
          onClick={() => {
            const { start, end } = getDateRange()
            if (start && end) {
              fetchHistory(start, end)
            }
          }}
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? '読み込み中...' : '更新'}
        </Button>
      </div>

      {/* 期間選択 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* 表示モード選択 */}
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('day')}
              >
                日別
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('week')}
              >
                週別
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('month')}
              >
                月別
              </Button>
            </div>

            {/* 期間移動 */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => movePeriod('prev')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                今日
              </Button>
              <Button variant="outline" size="sm" onClick={() => movePeriod('next')}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 現在の期間表示 */}
          <div className="mt-4 text-center">
            <h2 className="text-lg font-semibold">
              {viewMode === 'day' && currentDate.toLocaleDateString('ja-JP', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                timeZone: 'Asia/Tokyo'
              })}
              {viewMode === 'week' && `${currentDate.toLocaleDateString('ja-JP', { 
                month: 'long', 
                day: 'numeric',
                timeZone: 'Asia/Tokyo'
              })} 週`}
              {viewMode === 'month' && currentDate.toLocaleDateString('ja-JP', { 
                year: 'numeric', 
                month: 'long',
                timeZone: 'Asia/Tokyo'
              })}
            </h2>
            {/* 週別・月別の合計時間表示 */}
            {(viewMode === 'week' || viewMode === 'month') && attendanceRecords.length > 0 && (
              <div className="text-sm text-gray-600 mt-1">
                {viewMode === 'week' && (
                  <span>週間合計: {formatMinutesToTime(calculateTotalWorkTime(attendanceRecords))}</span>
                )}
                {viewMode === 'month' && (
                  <span>月間合計: {formatMinutesToTime(calculateTotalWorkTime(attendanceRecords))}</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 履歴表示 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2">読み込み中...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attendanceRecords.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">選択した期間に勤怠記録がありません</p>
              </CardContent>
            </Card>
          ) : (
            // 日付でグループ化し、実際の出退勤ペアのみを表示
            Object.entries(
              attendanceRecords.reduce((groups, record) => {
                const date = record.date
                if (!groups[date]) {
                  groups[date] = []
                }
                groups[date].push(record)
                return groups
              }, {} as Record<string, AttendanceRecord[]>)
            ).map(([date, records]) => {
              // 出勤時刻があるレコードのみを抽出（退勤時刻の有無は問わない）
              const validRecords = records.filter(record => record.check_in_time)
              
              // 作成日時順でソート
              const sortedRecords = validRecords
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              
              // 重複を除去してユニークな出退勤ペアを構築（メインページと同じロジック）
              const uniqueRecords = new Map<string, AttendanceRecord>()
              
              console.log('元のレコード詳細:', sortedRecords.map(r => ({
                出勤: r.check_in_time,
                退勤: r.check_out_time,
                作成日時: r.created_at
              })))
              
              sortedRecords.forEach((record, index) => {
                console.log(`履歴処理中のレコード [${index + 1}]:`, {
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
              
              // 詳細なデバッグログを追加
              console.log(`履歴表示 - 日付: ${date}`, {
                総レコード数: records.length,
                有効レコード数: validRecords.length,
                表示レコード数: displayRecords.length,
                元のレコード詳細: sortedRecords.map(r => ({
                  出勤: r.check_in_time,
                  退勤: r.check_out_time,
                  作成日時: r.created_at
                })),
                表示レコード詳細: displayRecords.map(r => ({
                  出勤: r.check_in_time,
                  退勤: r.check_out_time,
                  作成日時: r.created_at
                }))
              })
              
              // その日の総勤務時間を計算（完了したペア + 現在勤務中）
              const totalWorkMinutes = displayRecords.reduce((total, record, index) => {
                if (!record.check_in_time) return total
                
                let diffMinutes = 0
                
                if (record.check_out_time) {
                  // 完了したペアの場合
                  const start = new Date(record.check_in_time)
                  const end = new Date(record.check_out_time)
                  const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
                  diffMinutes = Math.max(1, Math.ceil(diffSeconds / 60)) // 1分未満でも1分として計算
                  
                  console.log(`履歴勤務時間計算 [${index + 1}] - 完了済み:`, {
                    出勤時刻: record.check_in_time,
                    退勤時刻: record.check_out_time,
                    計算結果: diffMinutes,
                    累積: total + diffMinutes
                  })
                } else {
                  // 現在勤務中の場合（退勤時刻がない）
                  const start = new Date(record.check_in_time)
                  const end = new Date(record.created_at)
                  const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
                  diffMinutes = Math.max(1, Math.ceil(diffSeconds / 60)) // 1分未満でも1分として計算
                  
                  console.log(`履歴勤務時間計算 [${index + 1}] - 現在勤務中:`, {
                    出勤時刻: record.check_in_time,
                    作成時刻: record.created_at,
                    計算結果: diffMinutes,
                    累積: total + diffMinutes
                  })
                }
                
                return total + diffMinutes
              }, 0)
              
              // デバッグログ
              console.log(`履歴表示 - 日付: ${date}`, {
                総レコード数: records.length,
                有効レコード数: validRecords.length,
                表示レコード数: displayRecords.length,
                レコード詳細: displayRecords.map(r => ({
                  出勤: r.check_in_time,
                  退勤: r.check_out_time,
                  作成日時: r.created_at,
                  現在勤務中: !r.check_out_time
                })),
                総勤務時間: totalWorkMinutes
              })
              
              const busyLevel = busyLevels.find(b => b.date === date)
              const consecutiveDays = calculateConsecutiveWorkDays(date)
              
              return (
                <Card key={date}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">
                          {new Date(date + 'T00:00:00Z').toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short',
                            timeZone: 'Asia/Tokyo'
                          })}
                        </h3>
                        <p className="text-sm text-gray-500">
                          連続勤務 {consecutiveDays} 日目
                          {displayRecords.length > 1 && ` (${displayRecords.length}回の出退勤)`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">
                          {formatMinutesToTime(totalWorkMinutes)}
                        </p>
                        <p className="text-sm text-gray-500">
                          総勤務時間
                        </p>
                      </div>
                    </div>
                    
                    {/* 各回の出退勤詳細 */}
                    {displayRecords.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium mb-2">出退勤詳細:</p>
                        <div className="space-y-1">
                          {displayRecords.map((record, index) => {
                            // 現在勤務中の判定：出勤時刻があり、退勤時刻がない場合
                            const isCurrentWork = record.check_in_time && !record.check_out_time
                            
                            // 勤務時間の計算
                            let workTime = 0
                            
                            if (record.check_in_time && record.check_out_time) {
                              // 完了したペアの場合
                              const start = new Date(record.check_in_time)
                              const end = new Date(record.check_out_time)
                              const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
                              workTime = Math.max(1, Math.ceil(diffSeconds / 60)) // 1分未満でも1分として計算
                            } else if (isCurrentWork) {
                              // 現在勤務中の場合（退勤時刻がない）
                              // 履歴表示では現在時刻ではなく、レコードの作成時刻を使用
                              const start = new Date(record.check_in_time!)
                              const end = new Date(record.created_at) // 作成時刻を使用
                              const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
                              workTime = Math.max(1, Math.ceil(diffSeconds / 60)) // 1分未満でも1分として計算
                              
                              console.log('履歴での現在勤務中時間計算:', {
                                出勤時刻: record.check_in_time,
                                作成時刻: record.created_at,
                                計算結果: workTime,
                                現在勤務中判定: isCurrentWork
                              })
                            }
                            
                            // 表示状態の判定
                            let statusText = ''
                            let statusClass = 'text-gray-600'
                            
                            if (isCurrentWork) {
                              statusText = '現在勤務中'
                              statusClass = 'text-blue-600 font-medium'
                            } else {
                              statusText = `${index + 1}回目`
                            }
                            
                            return (
                              <div key={`${record.date}-${record.created_at}`} className={`text-sm ${statusClass}`}>
                                {statusText}: {record.check_in_time && formatTime(record.check_in_time)} - 
                                {record.check_out_time ? formatTime(record.check_out_time) : '勤務中'} 
                                ({formatMinutesToTime(workTime)})
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* 忙しさレベル */}
                    {busyLevel && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-sm">忙しさレベル: {busyLevel.level}%</span>
                        </div>
                        {busyLevel.comment && (
                          <p className="text-sm text-gray-600 mt-1">{busyLevel.comment}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
