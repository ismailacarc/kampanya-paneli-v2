import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/api/google-auth/callback'
  )

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',   // refresh_token için şart
    prompt: 'consent',        // her seferinde refresh_token alsın
    scope: ['https://www.googleapis.com/auth/adwords']
  })

  return NextResponse.redirect(url)
}
