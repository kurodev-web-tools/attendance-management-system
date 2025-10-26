import { useState, useEffect } from 'react'
import { supabase, AttendanceRecord } from '@/lib/supabase'
import { calculateWorkTimeFromRecords, calculateWorkDays } from '@/lib/workTimeCalculator'
import { getToday, getMonthRange, getYearRange } from '@/lib/dateUtils'
import { logger } from '@/lib/logger'

interface WorkDaysStats {
  monthlyWorkDays: number
  yearlyWorkDays: number
}

export function useWorkTimeCalculation(userEmail: string | undefined, isCheckedIn: boolean, checkOutTime: string | undefined) {
  const [totalWorkMinutes, setTotalWorkMinutes] = useState(0)
  const [workDaysStats, setWorkDaysStats] = useState<WorkDaysStats>({
    monthlyWorkDays: 0,
    yearlyWorkDays: 0,
  })
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const refresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  useEffect(() => {
    const calculateTotalWorkTime = async () => {
      if (!userEmail) return

      try {
        const today = getToday()

        // 今日の全ての勤怠記録を取得
        const { data: allRecords } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', userEmail)
          .eq('date', today)
          .not('check_in_time', 'is', null)
          .order('created_at', { ascending: true })

        if (allRecords && allRecords.length > 0) {
          const totalMinutes = calculateWorkTimeFromRecords(allRecords as AttendanceRecord[], isCheckedIn)
          setTotalWorkMinutes(totalMinutes)
          logger.debug('最終累積勤務時間:', totalMinutes)

          // 勤務日数を計算
          await calculateWorkDays()
        } else {
          setTotalWorkMinutes(0)
        }
      } catch (error) {
        logger.error('累積勤務時間の計算エラー:', error)
      }
    }

    const calculateWorkDays = async () => {
      if (!userEmail) return

      try {
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth() + 1
        const currentDay = currentDate.getDate()

        // 月の範囲を取得
        const { monthStart, monthEnd } = getMonthRange(currentYear, currentMonth)

        // 年の範囲を取得
        const { yearStart, yearEnd } = getYearRange(currentYear)

        // 今月の勤怠記録を取得
        const { data: monthlyRecords } = await supabase
          .from('attendance_records')
          .select('date, check_in_time, check_out_time')
          .eq('user_id', userEmail)
          .gte('date', monthStart)
          .lte('date', monthEnd)
          .not('check_in_time', 'is', null)

        // 今年の勤怠記録を取得
        const { data: yearlyRecords } = await supabase
          .from('attendance_records')
          .select('date, check_in_time, check_out_time')
          .eq('user_id', userEmail)
          .gte('date', yearStart)
          .lte('date', yearEnd)
          .not('check_in_time', 'is', null)

        if (monthlyRecords && yearlyRecords) {
          const monthlyWorkDaysSet = calculateWorkDays(monthlyRecords as AttendanceRecord[])
          const yearlyWorkDaysSet = calculateWorkDays(yearlyRecords as AttendanceRecord[])

          const monthlyWorkDays = monthlyWorkDaysSet.size
          const yearlyWorkDays = yearlyWorkDaysSet.size

          setWorkDaysStats({
            monthlyWorkDays,
            yearlyWorkDays,
          })

          logger.debug('勤務日数計算完了:', {
            monthlyWorkDays,
            yearlyWorkDays,
          })
        }
      } catch (error) {
        logger.error('勤務日数の計算エラー:', error)
      }
    }

    calculateTotalWorkTime()
  }, [userEmail, isCheckedIn, checkOutTime, refreshTrigger])

  return {
    totalWorkMinutes,
    workDaysStats,
    refresh,
  }
}
