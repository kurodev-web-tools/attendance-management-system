import { supabase, UserSettings } from './supabase'

// デフォルト設定
export const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  // 勤務時間設定
  standard_work_hours: 8,
  recommended_start_time: '09:00',
  recommended_end_time: '18:00',
  break_duration: 60,
  
  // 通知設定
  check_in_reminder_minutes: 30,
  check_out_reminder_minutes: 30,
  overtime_notification_hours: 8,
  long_work_notification_hours: 10,
  notification_enabled: true,
  
  // 忙しさレベル設定
  busy_level_descriptions: {
    0: '非常に暇',
    25: '暇',
    50: '普通',
    75: '忙しい',
    100: '非常に忙しい'
  },
  busy_level_colors: {
    0: '#10b981', // green-500
    25: '#84cc16', // lime-500
    50: '#eab308', // yellow-500
    75: '#f97316', // orange-500
    100: '#ef4444' // red-500
  }
}

// ユーザー設定を取得
export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  try {
    console.log('設定取得 - userId:', userId)
    
    // 認証状態を確認
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('Supabase認証状態:', { session, sessionError })
    
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    console.log('設定取得結果:', { data, error })

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }

    if (!data) {
      // 設定が存在しない場合はデフォルト設定を返す（データベースに保存しない）
      console.log('設定が存在しないため、デフォルト設定を返します')
      return {
        id: '',
        user_id: userId,
        ...DEFAULT_SETTINGS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }

    return data
  } catch (error) {
    console.error('設定の取得エラー:', error)
    throw error
  }
}

// デフォルト設定を作成
export const createDefaultSettings = async (userId: string): Promise<UserSettings> => {
  try {
    const settingsData = {
      user_id: userId,
      ...DEFAULT_SETTINGS
    }

    const { data, error } = await supabase
      .from('user_settings')
      .insert(settingsData)
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('デフォルト設定の作成エラー:', error)
    console.error('エラーの詳細:', JSON.stringify(error, null, 2))
    throw error
  }
}

// ユーザー設定を更新
export const updateUserSettings = async (userId: string, settings: Partial<UserSettings>): Promise<UserSettings> => {
  try {
    // 設定データの検証
    console.log('更新する設定データ:', settings)
    
    // まず既存の設定を確認
    const existingSettings = await getUserSettings(userId)
    
    if (!existingSettings || !existingSettings.id) {
      // 設定が存在しない場合は新規作成
      console.log('既存設定が存在しないため、新規作成します')
      return await createDefaultSettings(userId)
    }

    const updateData = {
      ...settings,
      updated_at: new Date().toISOString()
    }

    console.log('Supabaseに送信するデータ:', updateData)

    const { data, error } = await supabase
      .from('user_settings')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Supabaseエラー:', error)
      throw error
    }

    console.log('更新成功:', data)
    return data
  } catch (error) {
    console.error('設定の更新エラー:', error)
    console.error('エラーの詳細:', JSON.stringify(error, null, 2))
    throw error
  }
}

// 設定をリセット（デフォルトに戻す）
export const resetUserSettings = async (userId: string): Promise<UserSettings> => {
  try {
    const resetData = {
      ...DEFAULT_SETTINGS,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('user_settings')
      .update(resetData)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('設定のリセットエラー:', error)
    console.error('エラーの詳細:', JSON.stringify(error, null, 2))
    throw error
  }
}
