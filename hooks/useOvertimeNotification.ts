import { useEffect, useRef } from 'react'
import { UserSettings } from '@/lib/supabase'

export function useOvertimeNotification(settings: UserSettings | null, checkInTime: string | undefined, isCheckedIn: boolean) {
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasNotifiedRef = useRef<boolean>(false)

  // 通知を表示
  const showNotification = (title: string, body: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'overtime-notification',
        requireInteraction: false,
        silent: false
      })
    }
  }

  // 残業通知を設定
  const setOvertimeNotification = () => {
    if (!settings || !settings.notification_enabled || !checkInTime || !isCheckedIn) {
      return
    }

    if (settings.overtime_notification_hours <= 0) {
      return
    }

    // 既存の通知タイマーをクリア
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current)
      notificationTimeoutRef.current = null
    }

    hasNotifiedRef.current = false

    // 残業時間を分に変換
    const overtimeMinutes = settings.overtime_notification_hours * 60

    // 出勤時刻から残業時間後の時刻を計算
    const checkInDate = new Date(checkInTime)
    const overtimeTime = new Date(checkInDate.getTime() + overtimeMinutes * 60 * 1000)

    const now = new Date()
    const delay = overtimeTime.getTime() - now.getTime()

    console.log('残業通知設定:', {
      checkInTime,
      overtimeHours: settings.overtime_notification_hours,
      overtimeMinutes,
      overtimeTime: overtimeTime.toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'}),
      delayMinutes: delay / 1000 / 60
    })

    if (delay > 0) {
      notificationTimeoutRef.current = setTimeout(() => {
        if (!hasNotifiedRef.current) {
          showNotification(
            '残業通知',
            `${settings.overtime_notification_hours}時間の残業時間に達しました。お疲れ様です！`
          )
          hasNotifiedRef.current = true
          console.log('残業通知を表示しました')
        }
      }, delay)
    }
  }

  // 出勤状態や設定が変更された時に通知を再設定
  useEffect(() => {
    setOvertimeNotification()

    // クリーンアップ
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
        notificationTimeoutRef.current = null
      }
    }
  }, [
    settings?.notification_enabled,
    settings?.overtime_notification_hours,
    checkInTime,
    isCheckedIn
  ])

  return {
    setOvertimeNotification
  }
}
