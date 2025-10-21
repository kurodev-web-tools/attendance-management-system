/**
 * 管理者権限の判定
 */

/**
 * 指定されたメールアドレスが管理者かどうかを判定
 * @param email ユーザーのメールアドレス
 * @returns 管理者の場合true
 */
export const isAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false
  
  // クライアントサイドでは NEXT_PUBLIC_ プレフィックスが必要
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(email => email.trim()) || []
  return adminEmails.includes(email)
}

/**
 * 管理者メールアドレスの一覧を取得（デバッグ用）
 * @returns 管理者メールアドレスの配列
 */
export const getAdminEmails = (): string[] => {
  return process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || []
}
