/**
 * 日付フォーマット関連のユーティリティ
 */

/**
 * 今日の日付を JST で yyyy-MM-dd 形式で取得
 */
export function getToday(): string {
  return new Date()
    .toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
    .replace(/\//g, '-')
    .split('-')
    .map((v, i) => (i === 1 || i === 2 ? v.padStart(2, '0') : v))
    .join('-')
}

/**
 * Date オブジェクトを yyyy-MM-dd 形式に変換
 */
export function formatDateToYYYYMMDD(date: Date): string {
  return date
    .toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
    .replace(/\//g, '-')
    .split('-')
    .map((v, i) => (i === 1 || i === 2 ? v.padStart(2, '0') : v))
    .join('-')
}

/**
 * 現在時刻を JST で取得
 */
export function getCurrentTime(): string {
  return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

/**
 * 月の範囲を取得
 */
export function getMonthRange(year: number, month: number) {
  const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

  return { monthStart, monthEnd }
}

/**
 * 年の範囲を取得
 */
export function getYearRange(year: number, month?: number, day?: number) {
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1
  const currentDay = currentDate.getDate()

  const yearStart = `${year}-01-01`
  const yearEnd = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`

  return { yearStart, yearEnd }
}
