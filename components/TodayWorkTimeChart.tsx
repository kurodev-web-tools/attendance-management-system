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
      <Card className="h-full flex flex-col">
        <CardHeader className="bg-white border-b border-gray-200">
          <CardTitle className="text-base font-semibold text-blue-900">今日の勤務時間推移</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">
            出勤記録がありません
          </div>
        </CardContent>
      </Card>
    )
  }

  // データポイントが少ない場合（勤務開始直後など）の処理
  if (data.length <= 2) {
    const currentMinutes = data[data.length - 1]?.minutes || 0
    const hours = Math.floor(currentMinutes / 60)
    const minutes = currentMinutes % 60
    
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="bg-white border-b border-gray-200">
          <CardTitle className="text-base font-semibold text-blue-900">今日の勤務時間推移</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="text-3xl font-bold text-blue-900">
            {hours}:{minutes.toString().padStart(2, '0')}
          </div>
          <div className="text-sm text-gray-600">
            現在の勤務時間
          </div>
          <div className="text-xs text-gray-500">
            まだデータが少ないためグラフは表示しません
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="bg-white border-b border-gray-200">
        <CardTitle className="text-base font-semibold text-blue-900">今日の勤務時間推移</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
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
      </CardContent>
    </Card>
  )
}
