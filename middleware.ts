import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(_req) {
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
