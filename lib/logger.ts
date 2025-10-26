/**
 * 環境変数に基づいてログ出力を制御するロガー
 * 本番環境では自動的に無効化される
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  /**
   * デバッグログ（開発環境のみ）
   */
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args)
    }
  },

  /**
   * 情報ログ
   */
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args)
    }
  },

  /**
   * 警告ログ
   */
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args)
  },

  /**
   * エラーログ（常に出力）
   */
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args)
  },

  /**
   * グループ化されたログ
   */
  group: (label: string, content: () => void) => {
    if (isDevelopment) {
      console.group(label)
      content()
      console.groupEnd()
    }
  },
}

/**
 * 本番環境でも出力したい重要な情報
 */
export const criticalLogger = {
  error: (...args: unknown[]) => {
    console.error('[CRITICAL]', ...args)
  },
}

