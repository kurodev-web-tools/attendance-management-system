'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, Download, Clock, TrendingUp } from 'lucide-react'
import { formatTime } from '@/lib/timeUtils'
import { formatMinutesToTime, formatDateJapanese } from '@/lib/monthlyReportUtils'
import type { MonthlyReportData, EmployeeList } from '@/lib/monthlyReportUtils'

interface ReportProps {
  onBack: () => void
}

type ReportType = 'monthly' | 'yearly'

export function Report({ onBack }: ReportProps) {
  const [reportType, setReportType] = useState<ReportType>('monthly')
  const [reportData, setReportData] = useState<MonthlyReportData | null>(null)
  const [employeeList, setEmployeeList] = useState<EmployeeList[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(parseInt(new Date().toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).split('/')[0]))
  const [selectedMonth, setSelectedMonth] = useState<number>(parseInt(new Date().toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).split('/')[1]))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 年度と月の選択肢を生成
  const currentYear = parseInt(new Date().toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).split('/')[0])
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  // 従業員リストを取得
  const fetchEmployeeList = useCallback(async () => {
    try {
      const response = await fetch('/api/employees', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('従業員リストの取得に失敗しました')
      }

      const data = await response.json()
      setEmployeeList(data)
    } catch (err) {
      console.error('従業員リスト取得エラー:', err)
      setError(err instanceof Error ? err.message : '従業員リストの取得に失敗しました')
    }
  }, [])

  // レポートデータを取得
  const fetchReport = useCallback(async () => {
    if (!selectedUserId) return

    setLoading(true)
    setError(null)

    try {
      const endpoint = reportType === 'monthly'
        ? `/api/monthly-report?userId=${selectedUserId}&year=${selectedYear}&month=${selectedMonth}`
        : `/api/yearly-report?userId=${selectedUserId}&year=${selectedYear}`
      
      const response = await fetch(endpoint, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('レポートの取得に失敗しました')
      }

      const data = await response.json()
      setReportData(data)
    } catch (err) {
      console.error('レポート取得エラー:', err)
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [selectedUserId, selectedYear, selectedMonth, reportType])

  // CSVエクスポート
  const exportToCSV = async () => {
    if (!selectedUserId) return

    try {
      const endpoint = reportType === 'monthly'
        ? `/api/monthly-report/csv?userId=${selectedUserId}&year=${selectedYear}&month=${selectedMonth}`
        : `/api/yearly-report/csv?userId=${selectedUserId}&year=${selectedYear}`
      
      const response = await fetch(endpoint, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('CSVエクスポートに失敗しました')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filename = reportType === 'monthly'
        ? `勤怠レポート_${selectedYear}年${selectedMonth}月_${selectedUserId}.csv`
        : `勤怠レポート_${selectedYear}年_${selectedUserId}.csv`
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('CSVエクスポートエラー:', err)
      setError(err instanceof Error ? err.message : 'CSVエクスポートに失敗しました')
    }
  }

  // レポートタイプ変更時にデータをクリア
  useEffect(() => {
    setReportData(null)
    setError(null)
  }, [reportType])

  // コンポーネントマウント時に従業員リストを取得
  useEffect(() => {
    fetchEmployeeList()
  }, [fetchEmployeeList])

  // パラメータが変更されたときにレポートを再取得
  useEffect(() => {
    if (selectedUserId) {
      fetchReport()
    }
  }, [selectedUserId, selectedYear, selectedMonth, reportType, fetchReport])

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          レポート
        </h1>
        <Button 
          variant="outline" 
          onClick={() => {
            if (selectedUserId) {
              fetchReport()
            }
          }}
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? '読み込み中...' : '更新'}
        </Button>
      </div>

      {/* レポートタイプ切り替え */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button
              variant={reportType === 'monthly' ? 'default' : 'outline'}
              onClick={() => setReportType('monthly')}
              className="flex-1"
            >
              月次レポート
            </Button>
            <Button
              variant={reportType === 'yearly' ? 'default' : 'outline'}
              onClick={() => setReportType('yearly')}
              className="flex-1"
            >
              年次レポート
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* フィルター */}
      <Card>
        <CardHeader>
          <CardTitle>レポート条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">従業員</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">従業員を選択</option>
                {employeeList.map((employee) => (
                  <option key={employee.user_id} value={employee.user_id}>
                    {employee.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">年</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full p-2 border rounded-md"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </select>
            </div>
            {reportType === 'monthly' && (
              <div>
                <label className="block text-sm font-medium mb-2">月</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full p-2 border rounded-md"
                >
                  {months.map((month) => (
                    <option key={month} value={month}>
                      {month}月
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Button onClick={fetchReport} disabled={loading || !selectedUserId}>
                {loading ? '読み込み中...' : 'レポート生成'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* エラー表示 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* レポート結果 */}
      {reportData && (
        <div className="space-y-6">
          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">総勤務時間</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMinutesToTime(reportData.totalWorkMinutes)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">勤務日数</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.workDays}日</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">平均勤務時間</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMinutesToTime(reportData.averageWorkMinutes)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">最長勤務日</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMinutesToTime(reportData.longestWorkDay)}</div>
              </CardContent>
            </Card>
          </div>

          {/* 詳細情報 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>詳細情報</CardTitle>
                <Button onClick={exportToCSV} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  CSVエクスポート
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">最速出勤時刻</p>
                  <p className="font-medium">
                    {reportData.earliestCheckIn 
                      ? formatTime(reportData.earliestCheckIn)
                      : 'なし'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">最遅退勤時刻</p>
                  <p className="font-medium">
                    {reportData.latestCheckOut 
                      ? formatTime(reportData.latestCheckOut)
                      : 'なし'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 日別詳細 */}
          <Card>
            <CardHeader>
              <CardTitle>{reportType === 'monthly' ? '日別詳細' : '月別詳細'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reportData.dailyData
                  .filter(day => day.workMinutes > 0)
                  .map((day) => (
                    <div key={day.date} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{formatDateJapanese(day.date)}</p>
                        {reportType === 'monthly' && (
                          <div className="text-sm text-gray-500">
                            {day.checkInTime && (
                              <span>出勤: {formatTime(day.checkInTime)}</span>
                            )}
                            {day.checkOutTime && (
                              <span className="ml-2">退勤: {formatTime(day.checkOutTime)}</span>
                            )}
                            {!day.checkOutTime && (
                              <span className="ml-2 text-blue-600">勤務中</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatMinutesToTime(day.workMinutes)}</p>
                        {reportType === 'monthly' && (
                          <p className="text-sm text-gray-500">
                            {day.isCompleteDay ? '完了' : '勤務中'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}