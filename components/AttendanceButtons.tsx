'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, LogIn, LogOut, Coffee } from 'lucide-react'
import { formatTime } from '@/lib/timeUtils'

interface AttendanceButtonsProps {
  isCheckedIn: boolean
  isOnBreak: boolean
  checkInTime?: string
  checkOutTime?: string
  breakStartTime?: string
  breakEndTime?: string
  onCheckIn: () => void
  onCheckOut: () => void
  onBreakStart: () => void
  onBreakEnd: () => void
  disabled?: boolean
}

export function AttendanceButtons({
  isCheckedIn,
  isOnBreak,
  checkInTime,
  checkOutTime,
  breakStartTime,
  breakEndTime,
  onCheckIn,
  onCheckOut,
  onBreakStart,
  onBreakEnd,
  disabled = false
}: AttendanceButtonsProps) {

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          勤怠記録
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 出勤・退勤ボタン */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={onCheckIn}
            disabled={disabled || isCheckedIn}
            variant={isCheckedIn ? "secondary" : "default"}
            className="h-12"
          >
            <LogIn className="h-4 w-4 mr-2" />
            出勤
          </Button>
          <Button
            onClick={onCheckOut}
            disabled={disabled || !isCheckedIn || isOnBreak}
            variant="destructive"
            className="h-12"
          >
            <LogOut className="h-4 w-4 mr-2" />
            退勤
          </Button>
        </div>

        {/* 出勤・退勤時刻表示 */}
        {(isCheckedIn || checkOutTime) && (
          <div className="space-y-2 p-3 bg-green-50 rounded-lg">
            <div className="text-sm text-green-700">
              出勤時刻: {checkInTime ? formatTime(checkInTime) : '--:--'}
            </div>
            {checkOutTime && (
              <div className="text-sm text-red-700">
                退勤時刻: {formatTime(checkOutTime)}
              </div>
            )}
            {/* デバッグ情報 */}
            {checkInTime && (
              <div className="text-xs text-gray-500">
                デバッグ - UTC: {checkInTime} | JST: {formatTime(checkInTime)}
              </div>
            )}
          </div>
        )}

        {/* 休憩ボタン */}
        {isCheckedIn && !checkOutTime && (
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={onBreakStart}
              disabled={disabled || isOnBreak}
              variant={isOnBreak ? "secondary" : "outline"}
              className="h-12"
            >
              <Coffee className="h-4 w-4 mr-2" />
              休憩開始
            </Button>
            <Button
              onClick={onBreakEnd}
              disabled={disabled || !isOnBreak}
              variant="outline"
              className="h-12"
            >
              <Coffee className="h-4 w-4 mr-2" />
              休憩終了
            </Button>
          </div>
        )}

        {/* 休憩時刻表示 */}
        {isOnBreak && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-700">
              休憩開始: {breakStartTime ? formatTime(breakStartTime) : '--:--'}
            </div>
            {breakEndTime && (
              <div className="text-sm text-blue-700">
                休憩終了: {formatTime(breakEndTime)}
              </div>
            )}
          </div>
        )}

        {/* 勤務状況表示 */}
        {(isCheckedIn || checkOutTime) && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-700">
              {checkOutTime ? '勤務終了 - 再度出勤可能' : isOnBreak ? '休憩中' : '勤務中'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
