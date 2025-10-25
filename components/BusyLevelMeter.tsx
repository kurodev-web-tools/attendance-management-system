'use client'

import { useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface BusyLevelMeterProps {
  initialLevel?: number
  initialComment?: string
  onUpdate: (level: number, comment: string) => void
  disabled?: boolean
  busyLevelDescriptions?: { [key: number]: string }
  busyLevelColors?: { [key: number]: string }
}

export function BusyLevelMeter({ 
  initialLevel = 50, 
  initialComment = '',
  onUpdate,
  disabled = false,
  busyLevelDescriptions,
  busyLevelColors
}: BusyLevelMeterProps) {
  const [level, setLevel] = useState(initialLevel)
  const [comment, setComment] = useState(initialComment)

  const handleLevelChange = (value: number[]) => {
    setLevel(value[0])
  }

  const handleSave = () => {
    onUpdate(level, comment)
  }

  const getBusyLevelText = (level: number) => {
    // 設定の説明文がある場合はそれを使用
    if (busyLevelDescriptions) {
      // 最も近いレベルの説明文を取得
      const levels = Object.keys(busyLevelDescriptions).map(Number).sort((a, b) => a - b)
      const closestLevel = levels.reduce((prev, curr) => 
        Math.abs(curr - level) < Math.abs(prev - level) ? curr : prev
      )
      return busyLevelDescriptions[closestLevel] || '普通'
    }
    
    // デフォルトの説明文
    if (level <= 20) return '😊 余裕がある'
    if (level <= 40) return '😐 少し忙しい'
    if (level <= 60) return '😅 普通'
    if (level <= 80) return '😰 忙しい'
    return '😵 超忙しい'
  }

  const getBusyLevelColor = (level: number) => {
    // 設定の色がある場合はそれを使用
    if (busyLevelColors) {
      // 最も近いレベルの色を取得
      const levels = Object.keys(busyLevelColors).map(Number).sort((a, b) => a - b)
      const closestLevel = levels.reduce((prev, curr) => 
        Math.abs(curr - level) < Math.abs(prev - level) ? curr : prev
      )
      return busyLevelColors[closestLevel] || '#eab308'
    }
    
    // デフォルトの色
    if (level <= 20) return 'bg-green-500'
    if (level <= 40) return 'bg-yellow-400'
    if (level <= 60) return 'bg-yellow-500'
    if (level <= 80) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <Card className="w-full">
      <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-200 border-b border-blue-200 py-3">
        <CardTitle className="text-base font-semibold text-blue-900">忙しさメーター</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">忙しさレベル</span>
            <span className="text-lg font-bold">{level}%</span>
          </div>
          <div className="flex justify-center mb-2">
            <span className="text-xl font-semibold">{getBusyLevelText(level)}</span>
          </div>
          <Slider
            value={[level]}
            onValueChange={handleLevelChange}
            max={100}
            step={10}
            disabled={disabled}
            className="w-full"
          />
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${level}%`,
                backgroundColor: busyLevelColors ? 
                  getBusyLevelColor(level) : 
                  undefined
              }}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">コメント（任意）</label>
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="今日の状況を教えてください..."
            disabled={disabled}
            maxLength={200}
          />
          <div className="text-xs text-gray-500 text-right">
            {comment.length}/200文字
          </div>
        </div>
        
        <Button 
          onClick={handleSave}
          disabled={disabled}
          className="w-full"
        >
          更新
        </Button>
      </CardContent>
    </Card>
  )
}
