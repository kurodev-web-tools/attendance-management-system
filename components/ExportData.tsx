'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Calendar, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getAttendanceDataForExport, convertToCSV, downloadCSV } from '@/lib/exportUtils'

interface ExportDataProps {
  userId: string
}

export function ExportData({ userId }: ExportDataProps) {
  const [isExporting, setIsExporting] = useState(false)

  // 今月のデータをエクスポート
  const handleExportMonthly = async () => {
    setIsExporting(true)
    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`

      const data = await getAttendanceDataForExport(supabase, userId, startDate, endDate)
      
      if (data.length === 0) {
        toast.error('エクスポートするデータがありません')
        return
      }

      const csvContent = convertToCSV(data)
      const filename = `勤怠データ_${year}年${month}月.csv`
      downloadCSV(csvContent, filename)
      
      toast.success('データをエクスポートしました')
    } catch (error) {
      console.error('エクスポートエラー:', error)
      toast.error('データのエクスポートに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }

  // 今年のデータをエクスポート
  const handleExportYearly = async () => {
    setIsExporting(true)
    try {
      const now = new Date()
      const year = now.getFullYear()
      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`

      const data = await getAttendanceDataForExport(supabase, userId, startDate, endDate)
      
      if (data.length === 0) {
        toast.error('エクスポートするデータがありません')
        return
      }

      const csvContent = convertToCSV(data)
      const filename = `勤怠データ_${year}年.csv`
      downloadCSV(csvContent, filename)
      
      toast.success('データをエクスポートしました')
    } catch (error) {
      console.error('エクスポートエラー:', error)
      toast.error('データのエクスポートに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          データエクスポート
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            勤怠データをCSV形式でダウンロードできます
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={handleExportMonthly}
              disabled={isExporting}
              className="w-full"
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              今月のデータをエクスポート
            </Button>
            
            <Button
              onClick={handleExportYearly}
              disabled={isExporting}
              className="w-full"
              variant="outline"
            >
              <Calendar className="h-4 w-4 mr-2" />
              今年のデータをエクスポート
            </Button>
          </div>
          
          {isExporting && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
              データをエクスポート中...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
