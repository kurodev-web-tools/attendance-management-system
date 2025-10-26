/**
 * シンプルなRate Limiting実装
 * メモリベース（本番環境ではRedis等の推奨）
 */

interface RateLimitStore {
  [key: string]: number[]
}

const store: RateLimitStore = {}

/**
 * Rate Limitingチェック
 * @param identifier ユーザー識別子（IPアドレス or ユーザーID）
 * @param limit 許可されるリクエスト数
 * @param window 時間窓（ミリ秒）
 * @returns 制限を超えている場合true
 */
export function rateLimit(identifier: string, limit: number, window: number): boolean {
  const now = Date.now()
  
  // 該当IDのタイムスタンプ配列を取得（存在しない場合は作成）
  if (!store[identifier]) {
    store[identifier] = []
  }
  
  // 古いタイムスタンプを削除（時間窓外のものを除去）
  store[identifier] = store[identifier].filter(timestamp => now - timestamp < window)
  
  // 制限チェック
  if (store[identifier].length >= limit) {
    return true // 制限超過
  }
  
  // 新しいタイムスタンプを追加
  store[identifier].push(now)
  
  return false // 制限内
}

/**
 * 古いデータをクリーンアップ（メモリリーク防止）
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now()
  const maxAge = 3600000 // 1時間
  
  Object.keys(store).forEach(key => {
    const timestamps = store[key].filter(timestamp => now - timestamp < maxAge)
    if (timestamps.length === 0) {
      delete store[key]
    } else {
      store[key] = timestamps
    }
  })
}

// 5分ごとにクリーンアップを実行
if (typeof window === 'undefined') {
  setInterval(cleanupRateLimitStore, 300000) // 5分
}

