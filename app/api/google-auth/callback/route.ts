import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      `http://localhost:3000/google-ads?hata=${encodeURIComponent(error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      'http://localhost:3000/google-ads?hata=kod_gelmedi'
    )
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/api/google-auth/callback'
    )

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        'http://localhost:3000/google-ads?hata=refresh_token_gelmedi'
      )
    }

    // Token'ı query param ile sayfaya gönder — kullanıcı .env'e ekleyecek
    return NextResponse.redirect(
      `http://localhost:3000/google-ads?refresh_token=${encodeURIComponent(tokens.refresh_token)}&basarili=1`
    )

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : 'Bilinmeyen hata'
    return NextResponse.redirect(
      `http://localhost:3000/google-ads?hata=${encodeURIComponent(mesaj)}`
    )
  }
}
