'use client'

import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface WorkTimeData {
  time: string
  minutes: number
}

interface TodayWorkTimeChartProps {
  checkInTime?: string
  checkOutTime?: string
  currentTime: string
}

export function TodayWorkTimeChart({ checkInTime, checkOutTime, currentTime }: TodayWorkTimeChartProps) {
  // 今日の勤務時間データを生成
  const generateWorkTimeData = (): WorkTimeData[] => {
    if (!checkInTime) return []

    const data: WorkTimeData[] = []
    const startTime = new Date(checkInTime)
    const endTime = checkOutTime ? new Date(checkOutTime) : new Date(currentTime)
    
    // 30分間隔でデータポイントを生成
    const current = new Date(startTime)
    while (current <= endTime) {
      const minutes = Math.floor((current.getTime() - startTime.getTime()) / (1000 * 60))
      data.push({
        time: current.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        minutes: minutes
      })
      current.setMinutes(current.getMinutes() + 30)
    }

    return data
  }

  const data = generateWorkTimeData()

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">今日の勤務時間推移</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            出勤記録がありません
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">今日の勤務時間推移</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${Math.floor(value / 60)}:${(value % 60).toString().padStart(2, '0')}`}
              />
              <Tooltip 
                formatter={(value: number) => [`${Math.floor(value / 60)}:${(value % 60).toString().padStart(2, '0')}`, '勤務時間']}
                labelFormatter={(label) => `時刻: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="minutes" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
