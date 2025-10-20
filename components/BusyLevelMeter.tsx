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
}

export function BusyLevelMeter({ 
  initialLevel = 50, 
  initialComment = '',
  onUpdate,
  disabled = false 
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
    if (level <= 20) return '😊 余裕がある'
    if (level <= 40) return '😐 少し忙しい'
    if (level <= 60) return '😅 普通'
    if (level <= 80) return '😰 忙しい'
    return '😵 超忙しい'
  }

  const getBusyLevelColor = (level: number) => {
    if (level <= 20) return 'bg-green-500'
    if (level <= 40) return 'bg-yellow-400'
    if (level <= 60) return 'bg-yellow-500'
    if (level <= 80) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>忙しさメーター</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">忙しさレベル</span>
            <span className="text-lg font-bold">{level}%</span>
          </div>
          <Slider
            value={[level]}
            onValueChange={handleLevelChange}
            max={100}
            step={10}
            disabled={disabled}
            className="w-full"
          />
          <div className="flex justify-center">
            <span className="text-lg">{getBusyLevelText(level)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getBusyLevelColor(level)}`}
              style={{ width: `${level}%` }}
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
