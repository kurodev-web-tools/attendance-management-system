import { useEffect, useRef } from 'react'
import { UserSettings } from '@/lib/supabase'
import { calculateMinutesBetween } from '@/lib/timeUtils'

export function useLongWorkWarning(settings: UserSettings | null, checkInTime: string | undefined, isCheckedIn: boolean) {
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasWarnedRef = useRef<boolean>(false)

  // 通知を表示
  const showNotification = (title: string, body: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'long-work-warning',
        requireInteraction: false,
        silent: false
      })
    }
  }

  // 長時間勤務警告を設定
  const setLongWorkWarning = () => {
    if (!settings || !settings.notification_enabled || !checkInTime || !isCheckedIn) {
      return
    }

    if (settings.long_work_notification_hours <= 0) {
      return
    }

    // 既存の警告タイマーをクリア
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
      warningTimeoutRef.current = null
    }

    hasWarnedRef.current = false

    // 警告時間を分に変換
    const warningMinutes = settings.long_work_notification_hours * 60

    // 出勤時刻から警告時間後の時刻を計算
    const checkInDate = new Date(checkInTime)
    const warningTime = new Date(checkInDate.getTime() + warningMinutes * 60 * 1000)

    const now = new Date()
    const delay = warningTime.getTime() - now.getTime()

    if (delay > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        if (!hasWarnedRef.current) {
          showNotification(
            '長時間勤務警告',
            `${settings.long_work_notification_hours}時間を超える長時間勤務中です。休憩を取ることをお勧めします。`
          )
          hasWarnedRef.current = true
        }
      }, delay)
    }
  }

  // 出勤状態や設定が変更された時に警告を再設定
  useEffect(() => {
    setLongWorkWarning()

    // クリーンアップ
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current)
        warningTimeoutRef.current = null
      }
    }
  }, [
    settings?.notification_enabled,
    settings?.long_work_notification_hours,
    checkInTime,
    isCheckedIn
  ])

  return {
    setLongWorkWarning
  }
}
