import { withAuth } from 'next-auth/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export default withAuth(
  function middleware(req: NextRequest) {
    // Rate Limiting（API routesのみ）
    if (req.nextUrl.pathname.startsWith('/api/') && !req.nextUrl.pathname.startsWith('/api/auth')) {
      // IPアドレスを取得
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      
      // 1分間に60リクエストまで許可
      if (rateLimit(ip, 60, 60000)) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        )
      }
    }
    
    // セッションが存在する場合、リクエストを続行
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // API routesの場合、トークンが必要
        // auth routesは除外
        if (req.nextUrl.pathname.startsWith('/api/auth')) {
          return true
        }
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return !!token
        }
        // その他のページは認証をスキップ（クライアント側で制御）
        return true
      },
    },
  }
)

export const config = {
  matcher: ['/api/:path*']
}
