'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, LogIn, LogOut } from 'lucide-react'
import { formatTime } from '@/lib/timeUtils'

interface AttendanceButtonsProps {
  isCheckedIn: boolean
  checkInTime?: string
  checkOutTime?: string
  onCheckIn: () => void
  onCheckOut: () => void
  disabled?: boolean
  recommendedStartTime?: string
  recommendedEndTime?: string
}

export function AttendanceButtons({
  isCheckedIn,
  checkInTime,
  checkOutTime,
  onCheckIn,
  onCheckOut,
  disabled = false,
  recommendedStartTime,
  recommendedEndTime
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
        {/* 推奨時刻表示 */}
        {(recommendedStartTime || recommendedEndTime) && (
          <div className="space-y-1 p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-blue-600 font-medium">推奨時刻</div>
            {recommendedStartTime && (
              <div className="text-sm text-blue-700">
                推奨出勤: {recommendedStartTime}
              </div>
            )}
            {recommendedEndTime && (
              <div className="text-sm text-blue-700">
                推奨退勤: {recommendedEndTime}
              </div>
            )}
          </div>
        )}

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
            disabled={disabled || !isCheckedIn}
            variant="destructive"
            className="h-12"
          >
            <LogOut className="h-4 w-4 mr-2" />
            休憩・退勤
          </Button>
        </div>

        {/* 出勤・退勤時刻表示 */}
        {(checkInTime || checkOutTime) && (
          <div className="space-y-2 p-3 bg-green-50 rounded-lg">
            <div className="text-sm text-green-700">
              出勤時刻: {checkInTime ? formatTime(checkInTime) : '--:--'}
            </div>
            {checkOutTime && (
              <div className="text-sm text-red-700">
                退勤時刻: {formatTime(checkOutTime)}
              </div>
            )}
          </div>
        )}

        {/* 勤務状況表示 */}
        {(isCheckedIn || checkOutTime) && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-700">
              {isCheckedIn ? '勤務中' : '勤務終了 - 再度出勤可能'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
