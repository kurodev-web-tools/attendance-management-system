'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Edit, Trash2, Plus, Save, X } from 'lucide-react'
import { formatTime } from '@/lib/timeUtils'
import type { AttendanceRecord } from '@/lib/supabase'

interface AttendanceManagementProps {
  userId: string
  userEmail: string
  attendanceRecords: AttendanceRecord[]
  onUpdate: () => void
}

interface EditRecordData {
  id: string
  checkInTime: string
  checkOutTime: string
  date: string
}

export function AttendanceManagement({ userId, userEmail, attendanceRecords, onUpdate }: AttendanceManagementProps) {
  const [editRecord, setEditRecord] = useState<EditRecordData | null>(null)
  const [newRecord, setNewRecord] = useState<EditRecordData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 勤怠記録の更新
  const handleUpdate = async () => {
    if (!editRecord) return

    setLoading(true)
    setError(null)

    try {
      const requestData = {
        ...editRecord,
        checkInTime: editRecord.checkInTime,
        checkOutTime: editRecord.checkOutTime
      }
      
      console.log('PUT API - 送信データ:', requestData)
      
      const response = await fetch('/api/admin/attendance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '勤怠記録の更新に失敗しました')
      }

      setEditRecord(null)
      console.log('勤怠記録更新完了 - onUpdate呼び出し')
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // 勤怠記録の削除
  const handleDelete = async (id: string) => {
    if (!confirm('この勤怠記録を削除しますか？')) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/attendance?id=${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('勤怠記録の削除に失敗しました')
      }

      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // 勤怠記録の追加
  const handleAdd = async () => {
    if (!newRecord) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          checkInTime: newRecord.checkInTime,
          checkOutTime: newRecord.checkOutTime,
          date: newRecord.date
        })
      })

      if (!response.ok) {
        throw new Error('勤怠記録の追加に失敗しました')
      }

      setNewRecord(null)
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }


  // 日本時間固定で時刻を抽出
  const extractTime = (dateTime: string) => {
    if (!dateTime) return ''
    try {
      console.log('extractTime - 入力:', dateTime)
      // 時刻部分を抽出（例：2025-10-23T21:46:00 → 21:46）
      if (dateTime.includes('T')) {
        const timePart = dateTime.split('T')[1]?.substring(0, 5) || ''
        console.log('extractTime - 抽出結果:', timePart)
        return timePart
      }
      return dateTime
    } catch (error) {
      console.error('時刻抽出エラー:', error)
      return ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{userEmail} の勤怠記録管理</h3>
        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => setNewRecord({ id: '', checkInTime: '', checkOutTime: '', date: new Date().toLocaleDateString('ja-JP', {timeZone: 'Asia/Tokyo'}).replace(/\//g, '-').split('-').map((v, i) => i === 1 || i === 2 ? v.padStart(2, '0') : v).join('-') })}>
              <Plus className="h-4 w-4 mr-2" />
              記録追加
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>勤怠記録を追加</DialogTitle>
            </DialogHeader>
            {newRecord && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-date">日付</Label>
                  <Input
                    id="new-date"
                    type="date"
                    value={newRecord.date}
                    onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="new-checkin">出勤時刻</Label>
                  <Input
                    id="new-checkin"
                    type="time"
                    value={extractTime(newRecord.checkInTime)}
                    onChange={(e) => setNewRecord({ ...newRecord, checkInTime: `${newRecord.date}T${e.target.value}:00` })}
                  />
                </div>
                <div>
                  <Label htmlFor="new-checkout">退勤時刻</Label>
                  <Input
                    id="new-checkout"
                    type="time"
                    value={extractTime(newRecord.checkOutTime)}
                    onChange={(e) => setNewRecord({ ...newRecord, checkOutTime: `${newRecord.date}T${e.target.value}:00` })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAdd} disabled={loading} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    追加
                  </Button>
                  <Button variant="outline" onClick={() => setNewRecord(null)} className="flex-1">
                    <X className="h-4 w-4 mr-2" />
                    キャンセル
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {attendanceRecords.map((record) => (
          <Card key={record.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">日付:</span>
                      <p className="font-medium">{record.date}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">出勤:</span>
                      <p className="font-medium">{record.check_in_time ? formatTime(record.check_in_time) : '--:--'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">退勤:</span>
                      <p className="font-medium">{record.check_out_time ? formatTime(record.check_out_time) : '--:--'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">作成日時:</span>
                      <p className="font-medium text-xs">{new Date(record.created_at).toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'})}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      console.log('編集ボタンクリック - レコードデータ:', {
                        id: record.id,
                        check_in_time: record.check_in_time,
                        check_out_time: record.check_out_time,
                        date: record.date
                      })
                      const checkInTime = extractTime(record.check_in_time || '')
                      const checkOutTime = extractTime(record.check_out_time || '')
                      console.log('編集ボタンクリック - 抽出された時刻:', { checkInTime, checkOutTime })
                      setEditRecord({
                        id: record.id,
                        checkInTime,
                        checkOutTime,
                        date: record.date
                      })
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(record.id)}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 編集ダイアログ */}
      {editRecord && (
        <Dialog open={!!editRecord} onOpenChange={() => setEditRecord(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>勤怠記録を編集</DialogTitle>
              <DialogDescription>出退勤時刻を編集できます</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-date">日付</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editRecord.date}
                  onChange={(e) => setEditRecord({ ...editRecord, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-checkin">出勤時刻</Label>
                <Input
                  id="edit-checkin"
                  type="time"
                  value={extractTime(editRecord.checkInTime)}
                  onChange={(e) => setEditRecord({ ...editRecord, checkInTime: `${editRecord.date}T${e.target.value}:00` })}
                />
              </div>
              <div>
                <Label htmlFor="edit-checkout">退勤時刻</Label>
                <Input
                  id="edit-checkout"
                  type="time"
                  value={extractTime(editRecord.checkOutTime)}
                  onChange={(e) => setEditRecord({ ...editRecord, checkOutTime: `${editRecord.date}T${e.target.value}:00` })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUpdate} disabled={loading} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  更新
                </Button>
                <Button variant="outline" onClick={() => setEditRecord(null)} className="flex-1">
                  <X className="h-4 w-4 mr-2" />
                  キャンセル
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
