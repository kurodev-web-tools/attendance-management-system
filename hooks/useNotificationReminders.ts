import { useEffect, useRef } from 'react'
import { UserSettings } from '@/lib/supabase'

interface NotificationSettings {
  checkInReminderMinutes: number
  checkOutReminderMinutes: number
  recommendedStartTime: string
  recommendedEndTime: string
  notificationEnabled: boolean
}

export function useNotificationReminders(settings: UserSettings | null) {
  const notificationTimeoutRefs = useRef<NodeJS.Timeout[]>([])

  // 通知の許可を確認・要求
  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('このブラウザは通知をサポートしていません')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      console.log('通知が拒否されています')
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  // 通知を表示
  const showNotification = (title: string, body: string, icon?: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        tag: 'attendance-reminder', // 同じタグの通知は1つだけ表示
        requireInteraction: false, // 自動で消える
        silent: false
      })
    }
  }

  // 時刻を分に変換（HH:MM形式）
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  // 現在時刻を分に変換
  const getCurrentMinutes = (): number => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  }

  // リマインダーを設定
  const setReminders = async () => {
    if (!settings || !settings.notification_enabled) {
      console.log('通知が無効または設定がありません')
      return
    }

    const hasPermission = await requestNotificationPermission()
    if (!hasPermission) {
      console.log('通知の許可が得られませんでした')
      return
    }

    // 既存のタイマーをクリア
    notificationTimeoutRefs.current.forEach(timeout => clearTimeout(timeout))
    notificationTimeoutRefs.current = []

    const currentMinutes = getCurrentMinutes()
    const startTimeMinutes = timeToMinutes(settings.recommended_start_time)
    const endTimeMinutes = timeToMinutes(settings.recommended_end_time)

    console.log('リマインダー設定:', {
      currentMinutes,
      startTimeMinutes,
      endTimeMinutes,
      checkInReminder: settings.check_in_reminder_minutes,
      checkOutReminder: settings.check_out_reminder_minutes
    })

    // 出勤リマインダー
    if (settings.check_in_reminder_minutes > 0) {
      const reminderTime = startTimeMinutes - settings.check_in_reminder_minutes
      const delay = (reminderTime - currentMinutes) * 60 * 1000 // ミリ秒に変換

      if (delay > 0) {
        console.log(`出勤リマインダーを${delay / 1000 / 60}分後に設定`)
        const timeout = setTimeout(() => {
          showNotification(
            '出勤リマインダー',
            `そろそろ出勤時間です（推奨: ${settings.recommended_start_time}）`
          )
        }, delay)
        notificationTimeoutRefs.current.push(timeout)
      }
    }

    // 退勤リマインダー
    if (settings.check_out_reminder_minutes > 0) {
      const reminderTime = endTimeMinutes - settings.check_out_reminder_minutes
      const delay = (reminderTime - currentMinutes) * 60 * 1000 // ミリ秒に変換

      if (delay > 0) {
        console.log(`退勤リマインダーを${delay / 1000 / 60}分後に設定`)
        const timeout = setTimeout(() => {
          showNotification(
            '退勤リマインダー',
            `そろそろ退勤時間です（推奨: ${settings.recommended_end_time}）`
          )
        }, delay)
        notificationTimeoutRefs.current.push(timeout)
      }
    }
  }

  // 設定が変更された時にリマインダーを再設定
  useEffect(() => {
    setReminders()

    // クリーンアップ
    return () => {
      notificationTimeoutRefs.current.forEach(timeout => clearTimeout(timeout))
      notificationTimeoutRefs.current = []
    }
  }, [
    settings?.notification_enabled,
    settings?.check_in_reminder_minutes,
    settings?.check_out_reminder_minutes,
    settings?.recommended_start_time,
    settings?.recommended_end_time
  ])

  return {
    requestNotificationPermission,
    showNotification,
    setReminders
  }
}
