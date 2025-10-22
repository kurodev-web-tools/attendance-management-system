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
      
      // 再出勤の判定：出勤時刻が退勤時刻より後の場合は現在勤務中として扱う
      const isRecheckIn = record.check_out_time && 
        new Date(record.check_in_time) > new Date(record.check_out_time)
      
      if (record.check_out_time && !isRecheckIn) {
        // 完了したペアの場合
        const start = new Date(record.check_in_time)
        const end = new Date(record.check_out_time)
        const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
        const diffMinutes = Math.max(1, Math.ceil(diffSeconds / 60))
        return total + diffMinutes
      } else {
        // 現在勤務中の場合（退勤時刻がない、または再出勤）
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
      const startDateStr = startDate.toLocaleDateString('sv-SE') // YYYY-MM-DD形式
      const endDateStr = endDate.toLocaleDateString('sv-SE') // YYYY-MM-DD形式
      
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
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const day = currentDate.getDate()
    
    switch (viewMode) {
      case 'day':
        // 日別表示では、現在の日付をそのまま使用
        const dayStart = new Date(year, month, day)
        const dayEnd = new Date(year, month, day)
        console.log('日別表示の期間:', { dayStart, dayEnd })
        return { start: dayStart, end: dayEnd }
      case 'week':
        const startOfWeek = new Date(currentDate)
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
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
    
    switch (viewMode) {
      case 'day':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1))
        break
      case 'week':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7))
        break
      case 'month':
        newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1))
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
                day: 'numeric' 
              })}
              {viewMode === 'week' && `${currentDate.toLocaleDateString('ja-JP', { 
                month: 'long', 
                day: 'numeric' 
              })} 週`}
              {viewMode === 'month' && currentDate.toLocaleDateString('ja-JP', { 
                year: 'numeric', 
                month: 'long' 
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
              
              // 元の複雑なロジックに戻して、より慎重に処理
              const displayRecords: AttendanceRecord[] = []
              let currentCheckIn: AttendanceRecord | null = null
              
              console.log('元のレコード詳細:', sortedRecords.map(r => ({
                出勤: r.check_in_time,
                退勤: r.check_out_time,
                作成日時: r.created_at
              })))
              
              for (const record of sortedRecords) {
                console.log('処理中のレコード:', {
                  出勤: record.check_in_time,
                  退勤: record.check_out_time,
                  作成日時: record.created_at
                })
                
                // 出勤記録の処理
                if (record.check_in_time && !currentCheckIn) {
                  // 新しい出勤サイクルを開始
                  console.log('新しい出勤サイクル開始')
                  currentCheckIn = record
                } else if (record.check_out_time && currentCheckIn) {
                  // 退勤記録でサイクルを完成
                  console.log('退勤記録でサイクル完成')
                  displayRecords.push({
                    ...currentCheckIn,
                    check_out_time: record.check_out_time
                  })
                  currentCheckIn = null
                } else if (record.check_in_time && currentCheckIn && currentCheckIn.check_in_time !== record.check_in_time) {
                  // 既に出勤中に新しい出勤記録がある場合（再出勤）
                  console.log('再出勤検出')
                  displayRecords.push(currentCheckIn)
                  currentCheckIn = record
                }
              }
              
              // 最後に出勤のみの場合は現在勤務中として追加
              if (currentCheckIn) {
                console.log('最後の出勤記録を追加')
                displayRecords.push(currentCheckIn)
              }
              
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
                
                // 再出勤の判定：出勤時刻が退勤時刻より後の場合は現在勤務中として扱う
                const isRecheckIn = record.check_out_time && 
                  new Date(record.check_in_time) > new Date(record.check_out_time)
                
                if (record.check_out_time && !isRecheckIn) {
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
                  // 現在勤務中の場合（退勤時刻がない、または再出勤）
                  const start = new Date(record.check_in_time)
                  const end = new Date(record.created_at)
                  const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
                  diffMinutes = Math.max(1, Math.ceil(diffSeconds / 60)) // 1分未満でも1分として計算
                  
                  console.log(`履歴勤務時間計算 [${index + 1}] - 現在勤務中:`, {
                    出勤時刻: record.check_in_time,
                    作成時刻: record.created_at,
                    計算結果: diffMinutes,
                    累積: total + diffMinutes,
                    再出勤判定: isRecheckIn
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
                            // 現在勤務中の判定：出勤時刻があり、退勤時刻がない、かつ最新のレコードである
                            const isLatestRecord = index === displayRecords.length - 1
                            const isCurrentWork = record.check_in_time && !record.check_out_time && isLatestRecord
                            
                            // 勤務時間の計算
                            let workTime = 0
                            
                            // 再出勤の判定：出勤時刻が退勤時刻より後の場合は現在勤務中として扱う
                            const isRecheckIn = record.check_out_time && 
                              new Date(record.check_in_time!) > new Date(record.check_out_time)
                            
                            if (record.check_in_time && record.check_out_time && !isRecheckIn) {
                              // 完了したペアの場合
                              const start = new Date(record.check_in_time)
                              const end = new Date(record.check_out_time)
                              const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
                              workTime = Math.max(1, Math.ceil(diffSeconds / 60)) // 1分未満でも1分として計算
                            } else if (isCurrentWork || isRecheckIn) {
                              // 現在勤務中の場合（退勤時刻がない、または再出勤）
                              // 履歴表示では現在時刻ではなく、レコードの作成時刻を使用
                              // これにより540分問題を防ぐ
                              const start = new Date(record.check_in_time!)
                              const end = new Date(record.created_at) // 作成時刻を使用
                              const diffSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
                              workTime = Math.max(1, Math.ceil(diffSeconds / 60)) // 1分未満でも1分として計算
                              
                              console.log('履歴での現在勤務中時間計算:', {
                                出勤時刻: record.check_in_time,
                                作成時刻: record.created_at,
                                計算結果: workTime,
                                判定: isCurrentWork,
                                再出勤判定: isRecheckIn
                              })
                            }
                            
                            // 表示状態の判定
                            let statusText = ''
                            let statusClass = 'text-gray-600'
                            
                            if (isCurrentWork || isRecheckIn) {
                              statusText = '現在勤務中'
                              statusClass = 'text-blue-600 font-medium'
                            } else {
                              statusText = `${index + 1}回目`
                            }
                            
                            return (
                              <div key={`${record.date}-${record.created_at}`} className={`text-sm ${statusClass}`}>
                                {statusText}: {record.check_in_time && formatTime(record.check_in_time)} - 
                                {record.check_out_time && !isRecheckIn ? formatTime(record.check_out_time) : '勤務中'} 
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
