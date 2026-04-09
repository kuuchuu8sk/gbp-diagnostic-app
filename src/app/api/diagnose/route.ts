import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";

// Initialize Upstash Redis for rate limiting (if env vars are present)
let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  // 5 requests per hour limit
  ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
  });
}

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const isValidGoogleMapsUrl = (url: string) => {
  return /^(https?:\/\/)?(www\.)?(google\.co\.jp\/maps|google\.com\/maps|maps\.app\.goo\.gl|g\.page)\/.*$/.test(url);
};

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";

    // 1. IP Rate Limiting Verification
    if (ratelimit) {
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        console.warn(`[RATE LIMIT] IP ${ip} exceeded the 5 reqs/hr limit.`);
        return NextResponse.json(
          { error: "リクエスト制限に達しました。1時間後に再度お試しください。" }, 
          { status: 429 }
        );
      }
    }

    const body = await req.json();
    const { targetUrl, email, companyName, recaptchaToken } = body;

    // 2. Input Validation (Prompt Injection & Spam Control)
    if (!targetUrl || !email || !companyName) {
      return NextResponse.json({ error: "必須項目が入力されていません。" }, { status: 400 });
    }
    if (companyName.length > 100) {
      return NextResponse.json({ error: "会社名が長すぎます。" }, { status: 400 });
    }
    if (!isValidGoogleMapsUrl(targetUrl)) {
      return NextResponse.json({ error: "有効なGoogleマップのURLを入力してください。" }, { status: 400 });
    }

    // 3. reCAPTCHA v3 Server-side Verification
    if (process.env.RECAPTCHA_SECRET_KEY && recaptchaToken) {
      const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success || verifyData.score < 0.5) {
        console.warn(`[BOT DETECTED] IP: ${ip}, Score: ${verifyData.score}`);
        return NextResponse.json({ error: "Botの疑いがあるためリクエストを拒否しました。" }, { status: 403 });
      }
    } else {
      console.log(`[ReCAPTCHA] By-passed due to missing Secret Key or Token (Test Mode)`);
    }

    // --- Core Architecture: Call Google API & AI (Mocked if keys are null) ---
    console.log(`[API START] Gathering Places Data for ${targetUrl}...`);
    // TODO: implement real Places API integration
    
    console.log(`[API AI] Running Gemini Analysis...`);
    // TODO: implement real Gemini logic
    const mockScore = Math.floor(Math.random() * 30) + 60; // 60-90

    // --- Send Email via Resend ---
    if (resend) {
      console.log(`[EMAIL] Sending full report to ${email} and notification to sales...`);
      // Mail to Client
      await resend.emails.send({
        from: process.env.EMAIL_SENDER || 'onboarding@resend.dev',
        to: email,
        subject: `【Kuuchuu8sk AI診断】${companyName} 様のGBP診断レポート`,
        html: `<p>本日はAI診断をご利用いただきありがとうございます。</p><p>総合スコア: <strong>${mockScore}点</strong></p><p>詳細な改善アクションは追ってご連絡いたします。</p>`
      });

      // Notification to Sales Team
      if (process.env.EMAIL_NOTIFICATION_RECEIVER) {
        await resend.emails.send({
          from: process.env.EMAIL_SENDER || 'onboarding@resend.dev',
          to: process.env.EMAIL_NOTIFICATION_RECEIVER,
          subject: `【新規AI診断通知】${companyName} 様`,
          text: `新規のAI診断がありました。\n企業名・店舗名: ${companyName}\nMap URL: ${targetUrl}\nEmail: ${email}\nScore: ${mockScore}`
        });
      }
    } else {
      console.log(`[EMAIL] Mock email sent (RESEND_API_KEY is missing). Score to client: ${mockScore}`);
    }

    // 4. Return success to frontend (only simple score)
    return NextResponse.json({ success: true, score: mockScore });

  } catch (error) {
    console.error(`[API Error]`, error);
    return NextResponse.json({ error: "サーバー処理中にエラーが発生しました。" }, { status: 500 });
  }
}
