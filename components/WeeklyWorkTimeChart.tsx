'use client'

import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

interface WeeklyWorkTimeData {
  date: string
  workMinutes: number
  workHours: string
}

interface WeeklyWorkTimeChartProps {
  userId: string
}

export function WeeklyWorkTimeChart({ userId }: WeeklyWorkTimeChartProps) {
  const [data, setData] = useState<WeeklyWorkTimeData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWeeklyData = async () => {
      if (!userId) return

      try {
        // 過去7日間のデータを取得
        const today = new Date()
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(today.getDate() - 6)

        const startDate = sevenDaysAgo.toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-')
        const endDate = today.toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-')

        const { data: attendanceData, error } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', userId)
          .gte('date', startDate)
          .lte('date', endDate)
          .not('check_in_time', 'is', null)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('週間データ取得エラー:', error)
          return
        }

        // 日付ごとにグループ化して勤務時間を計算
        const dailyData = new Map<string, number>()

        // 過去7日間の日付を初期化
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today)
          date.setDate(today.getDate() - i)
          const dateStr = date.toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-')
          dailyData.set(dateStr, 0)
        }

        // 勤務時間を計算
        if (attendanceData) {
          const recordsByDate = attendanceData.reduce((groups, record) => {
            const date = record.date
            if (!groups[date]) {
              groups[date] = []
            }
            groups[date].push(record)
            return groups
          }, {} as Record<string, typeof attendanceData>)

          Object.entries(recordsByDate).forEach(([date, records]) => {
            const sortedRecords = (records as typeof attendanceData).sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )

            // 重複を除去してユニークな出退勤ペアを構築
            const uniqueRecords = new Map<string, typeof attendanceData[0]>()
            
            sortedRecords.forEach((record) => {
              if (record.check_in_time) {
                const key = `${record.check_in_time}`
                if (!uniqueRecords.has(key) || !uniqueRecords.get(key)!.check_out_time) {
                  uniqueRecords.set(key, record)
                }
              }
            })

            // 総勤務時間を計算
            let totalMinutes = 0
            uniqueRecords.forEach((record) => {
              if (record.check_in_time && record.check_out_time) {
                const startTime = new Date(record.check_in_time)
                const endTime = new Date(record.check_out_time)
                const minutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))
                totalMinutes += minutes
              }
            })

            dailyData.set(date, totalMinutes)
          })
        }

        // グラフ用データを生成
        const chartData: WeeklyWorkTimeData[] = Array.from(dailyData.entries()).map(([date, minutes]) => {
          const dateObj = new Date(date)
          const dayOfWeek = dateObj.toLocaleDateString('ja-JP', { weekday: 'short' })
          const monthDay = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
          
          return {
            date: `${monthDay}(${dayOfWeek})`,
            workMinutes: minutes,
            workHours: `${Math.floor(minutes / 60)}:${(minutes % 60).toString().padStart(2, '0')}`
          }
        })

        setData(chartData)
      } catch (error) {
        console.error('週間データ取得エラー:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchWeeklyData()
  }, [userId])

  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-blue-900">週間勤務時間推移</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">
            読み込み中...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="bg-white border-b border-gray-200">
        <CardTitle className="text-base font-semibold text-blue-900">週間勤務時間推移</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${Math.floor(value / 60)}:${(value % 60).toString().padStart(2, '0')}`}
              />
              <Tooltip 
                formatter={(value: number) => [`${Math.floor(value / 60)}:${(value % 60).toString().padStart(2, '0')}`, '勤務時間']}
                labelFormatter={(label) => `日付: ${label}`}
              />
              <Bar 
                dataKey="workMinutes" 
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
