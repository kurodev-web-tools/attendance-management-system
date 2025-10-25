import { useState, useEffect } from 'react'
import { getUserSettings } from '@/lib/settings'
import { UserSettings } from '@/lib/supabase'

export function useUserSettings(userId: string) {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const loadSettings = async () => {
      try {
        setLoading(true)
        setError(null)
        const userSettings = await getUserSettings(userId)
        setSettings(userSettings)
      } catch (err) {
        console.error('設定の読み込みエラー:', err)
        setError('設定の読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [userId])

  return { settings, loading, error }
}
