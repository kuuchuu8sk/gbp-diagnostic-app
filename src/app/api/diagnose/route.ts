import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { GoogleGenAI } from "@google/genai";

// Initialize Upstash Redis for rate limiting (if env vars are present)
let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  // 50 requests per hour limit for testing & deployment compatibility
  ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(50, "1 h"),
  });
}

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Initialize Gemini
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const isValidGoogleMapsUrl = (url: string) => {
  // Support various common Google Maps URLs (google.com/maps, maps.app.goo.gl, g.page, goo.gl, g.co)
  return /^(https?:\/\/)?(www\.)?(google\.co\.jp|google\.com|maps\.app\.goo\.gl|g\.page|goo\.gl|g\.co)\/.*$/.test(url);
};

async function getGooglePlacesData(targetUrl: string, apiKey: string) {
  // 1. Resolve redirect if it's a short URL
  const initRes = await fetch(targetUrl, { redirect: "follow" });
  const finalUrl = initRes.url;

  // 2. Extract query based on URL format
  let query = "";
  let match = finalUrl.match(/\/place\/([^\/]+)\//);
  if (match) {
    query = decodeURIComponent(match[1]).replace(/\+/g, " ");
  } else {
    // try to get coordinates or fallback to full url
    const coordMatch = finalUrl.match(/@([-\d.]+),([-\d.]+)/);
    if (coordMatch) {
      query = `${coordMatch[1]},${coordMatch[2]}`;
    } else {
      query = finalUrl;
    }
  }

  // 3. Find Place
  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${apiKey}`;
  const findRes = await fetch(findUrl);
  const findData = await findRes.json();
  
  if (!findData.candidates || findData.candidates.length === 0) {
    throw new Error("指定されたURLから店舗を特定できませんでした。別の標準的な店舗共有URLでお試しください。");
  }
  const placeId = findData.candidates[0].place_id;

  // 4. Get Details
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,formatted_phone_number,website,opening_hours,photos,reviews&language=ja&key=${apiKey}`;
  const detailsRes = await fetch(detailsUrl);
  const detailsData = await detailsRes.json();

  if (!detailsData.result) {
    throw new Error("店舗の詳細情報が取得できませんでした。");
  }
  
  return detailsData.result;
}

const fetchPhotoAsBase64 = async (photoReference: string, apiKey: string): Promise<string | null> => {
  try {
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${apiKey}`;
    const res = await fetch(photoUrl);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } catch (error) {
    console.error("Photo fetch failed", error);
    return null;
  }
};

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";

    // 1. IP Rate Limiting Verification
    if (ratelimit) {
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        return NextResponse.json(
          { error: "リクエスト制限に達しました。1時間後に再度お試しください。" }, 
          { status: 429 }
        );
      }
    }

    const body = await req.json();
    const { targetUrl, email, recaptchaToken } = body;

    // 2. Input Validation
    if (!targetUrl || !email) {
      return NextResponse.json({ error: "必須項目が入力されていません。" }, { status: 400 });
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
        return NextResponse.json({ error: "Botの疑いがあるためリクエストを拒否しました。" }, { status: 403 });
      }
    }

    // 4. Call Google Places API
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return NextResponse.json({ error: "サーバーの設定エラー: Google Places API Key が不足しています。" }, { status: 500 });
    }
    console.log(`[API START] Fetching actual Places Data for ${targetUrl}...`);
    const placeData = await getGooglePlacesData(targetUrl, process.env.GOOGLE_PLACES_API_KEY);

    // 5. Fetch Photos & Call Gemini API
    if (!ai) {
      return NextResponse.json({ error: "サーバーの設定エラー: Gemini API Key が不足しています。" }, { status: 500 });
    }

    const photosBase64: string[] = [];
    if (placeData.photos && placeData.photos.length > 0) {
      console.log(`[API PHOTO] Fetching top photos for multimodal analysis...`);
      const photoRefs = placeData.photos.slice(0, 10).map((p: any) => p.photo_reference);
      const photoPromises = photoRefs.map((ref: string) => fetchPhotoAsBase64(ref, process.env.GOOGLE_PLACES_API_KEY!));
      const results = await Promise.all(photoPromises);
      results.forEach((b64) => {
        if (b64) photosBase64.push(b64);
      });
      console.log(`[API PHOTO] Successfully loaded ${photosBase64.length} photos.`);
    }

    console.log(`[API AI] Running Gemini Multimodal Analysis on ${placeData.name}...`);

    const systemPrompt = `
あなたはMEO・Googleビジネスプロフィール（GBP）のプロフェッショナルであり、最新のAI検索最適化（AEO）にも精通したトップコンサルタントです。
入力された店舗データと画像を統合的に分析し、次世代のAI検索時代に適応するための評価・提案を行ってください。

【対象店舗データ（テキスト情報）】
${JSON.stringify({ ...placeData, photos: undefined }, null, 2)}

送信された画像は、GBPのトップに優先的に表示されているものです。
画像を視覚的に解析し、以下のカテゴリがバランス良く含まれているか確認してください。
1. 外観・内観 / 2. 料理・商品 / 3. メニュー表・料金 / 4. 人・スタッフ

【評価ルール・トーン＆マナー（超重要）】
- 全5項目について、それぞれ20点満点（合計100点）で厳密に採点してください。
- 【採点基準（辛口判定）】大半の未対策の店舗は合計30〜50点になるように非常に厳しく判定してください。情報不足（写真が数枚しかない、口コミへの返信がない、詳細情報が空など）が一つでもある場合、その項目のスコアを容赦なく大幅に減点（5点未満など）してください。全体的に80点を超えるのは「頻繁に更新し、口コミ返信率100%レベルの完璧な店舗」のみです。診断を受けた店舗に「このままでは機会損失になりマズい」という伸び代と危機感を感じさせる厳しいスコアを算定してください。
- 【表現方法（寄り添い）】スコアは厳しくしますが、**文章のトーンは絶対にポジティブ**にしてください。「減点します」「不足しています」といった否定的な言葉は避け、「〜を追加設定することでさらにAIに推薦されやすくなります」「〜がないのは非常にもったいない機会損失です」といったプロらしく寄り添った表現を使用してください（点数はデキるコーチのように厳しく、言葉は優しく）。
- 各項目のフィードバック（reason）の中に必ず、「この情報がないとAI（GeminiやSGE等）が文脈を読み取れず、お客様の曖昧な検索に対して御社を推薦しにくくなる」といった『AI検索（AEO）』を見据えた独自のアドバイスを織り交ぜてください。
- 読みやすさ（スキャナビリティ）を重視し、重要なキーワードはHTMLタグ（<b>太字</b>）で装飾し、適宜 <br> で改行を入れて出力してください。

以下の5項目で評価します：
1. 基本情報（電話・ウェブサイト）
2. 詳細属性（営業時間等）
3. 視覚情報の充実度（画像評価の分析結果を必ず盛り込むこと）
4. 口コミの質と返信状況
5. 最新情報の発信（運用アドバイス）

【出力形式の強制】
以下の構造のJSONのみを返却してください（マークダウンのバッククォート等を含めず、純粋なJSONのみ出力）。
{
  "totalScore": (0から100の整数),
  "details": [
    {
      "category": "基本情報の最適化",
      "score": (0から20の整数),
      "reason": "公式サイトのURLが未設定です。<br>ここを連携させることで<b>AIが御社の魅力を深く学習</b>し、より多くの見込み客に推薦されるようになります！非常にもったいない機会損失です。"
    },
    ... (全5項目分を必ず含める)
  ],
  "actions": [
    "🔥最優先: (明日からできる、最もインパクトの大きい改善策トップ1)",
    "⭐重要: (次に着手すべき具体的な施策トップ2)",
    "🌱中長期: (継続・運用のアドバイス)"
  ]
}
`;

    const promptParts: any[] = [systemPrompt];
    photosBase64.forEach((b64) => {
      promptParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: b64
        }
      });
    });

    let chatResponse;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        chatResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: promptParts,
          config: {
            responseMimeType: "application/json",
          }
        });
        break;
      } catch (geminiError: any) {
        console.warn(`[API AI] Gemini API attempt ${attempt} failed:`, geminiError?.message || geminiError);
        // Retry for 503 Service Unavailable or specific demand errors
        const is503 = geminiError?.status === 503 || geminiError?.status === "UNAVAILABLE" || String(geminiError).includes("503") || String(geminiError).includes("high demand");
        
        if (is503 && attempt < maxRetries) {
          const waitMs = attempt * 2000; // 2s, then 4s...
          console.log(`Waiting ${waitMs}ms before retrying...`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
        } else {
          if (is503) {
            throw new Error("現在AIサーバーが非常に混み合っており、分析を実行できませんでした。しばらく経ってから再度お試しください。");
          }
          throw geminiError;
        }
      }
    }

    if (!chatResponse) {
      throw new Error("AI分析結果の取得に失敗しました。");
    }

    const aiResText = chatResponse.text;
    let report: any;
    try {
      report = JSON.parse(aiResText || "{}");
      if (!report.totalScore || !report.details) {
         throw new Error("Invalid format");
      }
    } catch(e) {
      console.error("Gemini parse error:", aiResText);
      throw new Error("AI分析結果のデータ構造エラーが発生しました。");
    }

      // 6. Send Email via Resend
      console.log(`[EMAIL] Sending full report to ${email}...`);

      if (resend) {
        // 本番環境（Vercel）で環境変数が設定されていない場合に備え、直接フォールバックを追加
        const adminEmail = process.env.EMAIL_NOTIFICATION_RECEIVER || "kuuchuu8sk@gmail.com";
        const senderEmail = process.env.EMAIL_SENDER || 'onboarding@resend.dev';

        // ユーザ向けメール
        const clientMailPromise = resend.emails.send({
          from: senderEmail,
          to: email,
          subject: `【AI診断完了】${placeData.name} のGoogleビジネスプロフィール解析結果`,
          html: htmlTemplate
        }).catch(err => console.error("[EMAIL] Client mail failed:", err));

        // 管理者向けメール
        const adminMailPromise = resend.emails.send({
          from: senderEmail,
          to: adminEmail,
          subject: `【新規AI診断】${placeData.name} (${report.totalScore}点)`,
          html: `
            <div style="background-color: #ffeb3b; color: #333; padding: 15px; font-family: sans-serif; text-align: center; font-weight: bold;">
              🚨 [管理者用通知] 新規のAI診断が実行されました<br>
              クライアントEmail: ${email} <br>
              対象マップURL: <a href="${targetUrl}">${targetUrl}</a>
            </div>
            ${htmlTemplate}
          `
        }).catch(err => console.error("[EMAIL] Admin mail failed:", err));

        // Vercel の 10秒タイムアウトを回避するため、2つのメール送信を「同時に」実行して待つ
        await Promise.all([clientMailPromise, adminMailPromise]);
      }

    // 7. Return to frontend
    return NextResponse.json({ success: true, score: report.totalScore });

  } catch (error: any) {
    console.error(`[API Error]`, error);
    return NextResponse.json({ error: error.message || "サーバー処理中にエラーが発生しました。" }, { status: 500 });
  }
}
