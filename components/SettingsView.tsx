import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, RotateCcw, Settings } from 'lucide-react'
import { getUserSettings, updateUserSettings, resetUserSettings, DEFAULT_SETTINGS } from '@/lib/settings'
import { UserSettings } from '@/lib/supabase'
import { toast } from 'sonner'

interface SettingsViewProps {
  userId: string
  onBack: () => void
}

export function SettingsView({ userId, onBack }: SettingsViewProps) {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const userSettings = await getUserSettings(userId)
      setSettings(userSettings)
    } catch (error) {
      console.error('設定の読み込みエラー:', error)
      // テーブルが存在しない場合はデフォルト設定を使用
      const defaultSettings = {
        id: '',
        user_id: userId,
        ...DEFAULT_SETTINGS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      setSettings(defaultSettings)
      toast.warning('設定テーブルが存在しません。デフォルト設定を使用します。')
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 設定を読み込み
  useEffect(() => {
    loadSettings()
  }, [userId, loadSettings])

  // 通知許可を要求
  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast.error('このブラウザは通知をサポートしていません')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      toast.error('通知が拒否されています。ブラウザの設定で許可してください。')
      return false
    }

    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      toast.success('通知が有効になりました')
      return true
    } else {
      toast.error('通知の許可が必要です')
      return false
    }
  }

  // 設定を保存
  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    try {
      await updateUserSettings(userId, settings)
      toast.success('設定を保存しました')
    } catch (error) {
      console.error('設定の保存エラー:', error)
      console.error('エラーの詳細:', JSON.stringify(error, null, 2))
      toast.error(`設定の保存に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    } finally {
      setSaving(false)
    }
  }

  // 設定をリセット
  const handleReset = async () => {
    if (!confirm('設定をデフォルトに戻しますか？')) return

    setSaving(true)
    try {
      const resetSettings = await resetUserSettings(userId)
      setSettings(resetSettings)
      toast.success('設定をデフォルトに戻しました')
    } catch (error) {
      console.error('設定のリセットエラー:', error)
      toast.error('設定のリセットに失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // 設定値の更新
  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    if (!settings) return
    setSettings(prev => prev ? { ...prev, [key]: value } : null)
  }

  // 忙しさレベルの説明文を更新
  const updateBusyLevelDescription = (level: number, description: string) => {
    if (!settings) return
    setSettings(prev => prev ? {
      ...prev,
      busy_level_descriptions: {
        ...prev.busy_level_descriptions,
        [level]: description
      }
    } : null)
  }

  // 忙しさレベルの色を更新
  const updateBusyLevelColor = (level: number, color: string) => {
    if (!settings) return
    setSettings(prev => prev ? {
      ...prev,
      busy_level_colors: {
        ...prev.busy_level_colors,
        [level]: color
      }
    } : null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>設定を読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">設定の読み込みに失敗しました</p>
        <Button onClick={loadSettings} className="mt-4">
          再試行
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          設定
        </h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            リセット
          </Button>
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {/* 勤務時間設定 */}
      <Card>
        <CardHeader>
          <CardTitle>勤務時間設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                標準勤務時間（時間）
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={settings.standard_work_hours}
                onChange={(e) => updateSetting('standard_work_hours', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                休憩時間（分）
              </label>
              <input
                type="number"
                min="0"
                max="180"
                value={settings.break_duration}
                onChange={(e) => updateSetting('break_duration', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                推奨出勤時刻
              </label>
              <input
                type="time"
                value={settings.recommended_start_time}
                onChange={(e) => updateSetting('recommended_start_time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                推奨退勤時刻
              </label>
              <input
                type="time"
                value={settings.recommended_end_time}
                onChange={(e) => updateSetting('recommended_end_time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 通知設定 */}
      <Card>
        <CardHeader>
          <CardTitle>通知設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notification_enabled"
              checked={settings.notification_enabled}
              onChange={async (e) => {
                if (e.target.checked) {
                  const granted = await requestNotificationPermission()
                  if (granted) {
                    updateSetting('notification_enabled', true)
                  }
                } else {
                  updateSetting('notification_enabled', false)
                }
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="notification_enabled" className="text-sm font-medium">
              通知を有効にする
            </label>
          </div>
          <div className="text-sm text-gray-600">
            通知を有効にすると、ブラウザの通知許可が求められます
          </div>

          {settings.notification_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  出勤リマインダー（分前）
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={settings.check_in_reminder_minutes}
                  onChange={(e) => updateSetting('check_in_reminder_minutes', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  退勤リマインダー（分前）
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={settings.check_out_reminder_minutes}
                  onChange={(e) => updateSetting('check_out_reminder_minutes', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  残業通知（時間超過時）
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={settings.overtime_notification_hours}
                  onChange={(e) => updateSetting('overtime_notification_hours', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  長時間勤務警告（時間超過時）
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={settings.long_work_notification_hours}
                  onChange={(e) => updateSetting('long_work_notification_hours', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 忙しさレベル設定 */}
      <Card>
        <CardHeader>
          <CardTitle>忙しさレベル設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(DEFAULT_SETTINGS.busy_level_descriptions).map((level) => (
              <div key={level} className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: settings.busy_level_colors[parseInt(level)] }}
                />
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">
                    レベル {level}
                  </label>
                  <input
                    type="text"
                    value={settings.busy_level_descriptions[parseInt(level)]}
                    onChange={(e) => updateBusyLevelDescription(parseInt(level), e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="color"
                    value={settings.busy_level_colors[parseInt(level)]}
                    onChange={(e) => updateBusyLevelColor(parseInt(level), e.target.value)}
                    className="w-full mt-2 h-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
