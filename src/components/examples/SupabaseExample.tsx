'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { supabase, User } from '@/lib/supabase'

export function SupabaseExample() {
  const [users, setUsers] = useState<User[]>([])
  const [newUser, setNewUser] = useState({ email: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 사용자 목록 가져오기
  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/users')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '사용자 데이터를 가져오는데 실패했습니다.')
      }

      setUsers(data.users || [])
    } catch (error) {
      console.error('사용자 조회 오류:', error)
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 새 사용자 생성
  const createUser = async () => {
    if (!newUser.email || !newUser.name) {
      setError('이메일과 이름을 모두 입력해주세요.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '사용자 생성에 실패했습니다.')
      }

      // 사용자 목록 새로고침
      await fetchUsers()
      
      // 입력 필드 초기화
      setNewUser({ email: '', name: '' })
      
      alert('사용자가 성공적으로 생성되었습니다!')

    } catch (error) {
      console.error('사용자 생성 오류:', error)
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 사용자 삭제
  const deleteUser = async (userId: string) => {
    if (!confirm('정말 이 사용자를 삭제하시겠습니까?')) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '사용자 삭제에 실패했습니다.')
      }

      // 사용자 목록 새로고침
      await fetchUsers()
      
      alert('사용자가 성공적으로 삭제되었습니다!')

    } catch (error) {
      console.error('사용자 삭제 오류:', error)
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Supabase 실시간 구독 예시
  useEffect(() => {
    // 초기 데이터 로드
    fetchUsers()

    // 실시간 구독 설정
    const subscription = supabase
      .channel('users-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users'
        },
        (payload) => {
          console.log('실시간 변경 감지:', payload)
          // 변경사항이 있을 때 데이터 새로고침
          fetchUsers()
        }
      )
      .subscribe()

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Supabase 연동 예시</h1>
      
      {/* 에러 메시지 */}
      {error && (
        <Card className="p-4 mb-4 bg-red-50 border-red-200">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      {/* 새 사용자 생성 폼 */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">새 사용자 생성</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            type="email"
            placeholder="이메일 주소"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            disabled={loading}
          />
          <Input
            type="text"
            placeholder="사용자 이름"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            disabled={loading}
          />
          <Button 
            onClick={createUser}
            disabled={loading || !newUser.email || !newUser.name}
          >
            {loading ? '생성 중...' : '사용자 생성'}
          </Button>
        </div>
      </Card>

      {/* 사용자 목록 */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">사용자 목록</h2>
          <Button 
            onClick={fetchUsers}
            disabled={loading}
            variant="outline"
          >
            {loading ? '로딩 중...' : '새로고침'}
          </Button>
        </div>

        {users.length === 0 ? (
          <p className="text-gray-500 text-center py-8">등록된 사용자가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div 
                key={user.id} 
                className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                  <p className="text-xs text-gray-400">
                    생성일: {user.created_at ? new Date(user.created_at).toLocaleString() : '알 수 없음'}
                  </p>
                </div>
                <Button
                  onClick={() => user.id && deleteUser(user.id)}
                  disabled={loading}
                  variant="destructive"
                  size="sm"
                >
                  삭제
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 사용 방법 안내 */}
      <Card className="p-6 mt-6 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold mb-3 text-blue-800">사용 방법</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p>• 위 폼을 사용해서 새 사용자를 생성할 수 있습니다.</p>
          <p>• 실시간으로 데이터베이스 변경사항이 반영됩니다.</p>
          <p>• API 엔드포인트: /api/users (GET, POST)</p>
          <p>• API 엔드포인트: /api/users/[id] (GET, PUT, DELETE)</p>
          <p>• 캡처 세션 관리: /api/capture-sessions</p>
        </div>
      </Card>
    </div>
  )
}
