'use client'

import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

interface BusyLevelData {
  date: string
  level: number
  comment: string | null
}

interface BusyLevelChartProps {
  userId: string
}

export function BusyLevelChart({ userId }: BusyLevelChartProps) {
  const [data, setData] = useState<BusyLevelData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBusyLevelData = async () => {
      if (!userId) return

      try {
        // 過去7日間の忙しさレベルデータを取得
        const today = new Date()
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(today.getDate() - 6)

        const startDate = sevenDaysAgo.toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-')
        const endDate = today.toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-')

        const { data: busyData, error } = await supabase
          .from('busy_levels')
          .select('*')
          .eq('user_id', userId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('updated_at', { ascending: true })

        if (error) {
          console.error('忙しさレベルデータ取得エラー:', error)
          console.error('エラーの詳細:', JSON.stringify(error, null, 2))
          
          // テーブルが存在しない場合の処理
          if (error.code === 'PGRST205') {
            console.log('busy_levelsテーブルが存在しません')
            setData([])
            return
          }
          
          return
        }

        // 各日の最新の忙しさレベルを抽出
        interface BusyLevelRecord {
          date: string
          updated_at: string
          level: number
          comment: string | null
        }
        const latestDailyBusyLevels = new Map<string, BusyLevelRecord>()
        busyData?.forEach((record: BusyLevelRecord) => {
          const existingRecord = latestDailyBusyLevels.get(record.date)
          if (!existingRecord || 
              new Date(record.updated_at) > new Date(existingRecord.updated_at)) {
            latestDailyBusyLevels.set(record.date, record)
          }
        })

        // 過去7日間のデータを生成（データがない日は0として表示）
        const chartData: BusyLevelData[] = []
        for (let i = 0; i < 7; i++) {
          const date = new Date(sevenDaysAgo)
          date.setDate(sevenDaysAgo.getDate() + i)
          const dateStr = date.toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-')
          
          const record = latestDailyBusyLevels.get(dateStr)
          chartData.push({
            date: date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric' }).replace('/', '/'),
            level: record?.level || 0,
            comment: record?.comment || null
          })
        }

        setData(chartData)
      } catch (error) {
        console.error('忙しさレベルデータ取得エラー:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBusyLevelData()
    const interval = setInterval(fetchBusyLevelData, 5 * 60 * 1000) // 5分ごとに更新
    return () => clearInterval(interval)
  }, [userId])

  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-200 border-b border-blue-200 py-3">
          <CardTitle className="text-base font-semibold text-blue-900">忙しさレベル推移</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 flex-1 flex items-center justify-center">
          <div className="text-gray-500">
            読み込み中...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-200 border-b border-blue-200 py-3">
          <CardTitle className="text-base font-semibold text-blue-900">忙しさレベル推移</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 flex-1 flex items-center justify-center">
          <div className="text-gray-500">
            忙しさレベルの記録がありません
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-200 border-b border-blue-200 py-3">
        <CardTitle className="text-base font-semibold text-blue-900">忙しさレベル推移</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 flex-1">
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                formatter={(value: number) => [`${value}%`, '忙しさレベル']}
                labelFormatter={(label) => `日付: ${label}`}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as BusyLevelData
                    return (
                      <div className="bg-white p-3 border rounded shadow-lg">
                        <p className="font-medium">{`日付: ${label}`}</p>
                        <p className="text-blue-600">{`忙しさレベル: ${data.level}%`}</p>
                        {data.comment && (
                          <p className="text-gray-600 text-sm mt-1">{`コメント: ${data.comment}`}</p>
                        )}
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Line 
                type="monotone" 
                dataKey="level" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
