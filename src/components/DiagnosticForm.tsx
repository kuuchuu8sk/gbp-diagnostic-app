"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle, MapPin, Building2, Mail, Sparkles, Loader2 } from "lucide-react";

type FormState = "idle" | "loading" | "success" | "error";

export default function DiagnosticForm() {
  const [targetUrl, setTargetUrl] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [score, setScore] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl, email, companyName, recaptchaToken: "test_token" })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to process Request");
      }
      
      setScore(data.score);
      setFormState("success");
    } catch (error: any) {
      setErrorMessage("診断中にエラーが発生しました。もう一度お試しください。");
      setFormState("error");
    }
  };

  if (formState === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="relative">
          <div className="absolute -inset-4 bg-white/10 rounded-full blur-xl animate-pulse"></div>
          <Loader2 className="w-12 h-12 text-white animate-spin relative" />
        </div>
        <h3 className="mt-8 text-xl font-medium tracking-wide">AIがプロファイルを分析中...</h3>
        <p className="mt-2 text-muted-foreground text-sm">店舗データ、レビュー、競合状況をスキャンしています。</p>
      </div>
    );
  }

  if (formState === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 border border-white/10 mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold mb-2">診断が完了しました</h2>
        <div className="my-8">
          <p className="text-sm text-muted-foreground mb-2">総合AIスコア</p>
          <div className="text-6xl font-display font-light text-gradient tracking-tighter">
            {score}<span className="text-3xl text-muted-foreground ml-1">/100</span>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-md w-full glass-panel">
          <div className="flex items-start gap-4 text-left">
            <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-white mb-1">詳細レポートを送信しました</h4>
              <p className="text-sm text-neutral-400 leading-relaxed">
                項目別の詳細なスコア分析と、AIが導き出した「明日からできる具体的な改善アクション」を {email} 宛に送信しました。ご確認ください。
              </p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setFormState("idle")}
          className="mt-8 text-sm text-muted-foreground hover:text-white transition-colors"
        >
          別の店舗を診断する
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up animation-delay-200">
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {errorMessage}
        </div>
      )}
      
      <div className="space-y-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Building2 className="w-5 h-5 text-neutral-500 group-focus-within:text-white transition-colors" />
          </div>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 transition-all font-light"
            placeholder="会社名・店舗名"
          />
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MapPin className="w-5 h-5 text-neutral-500 group-focus-within:text-white transition-colors" />
          </div>
          <input
            type="url"
            required
            pattern="https?://.*"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 transition-all font-light"
            placeholder="Googleマップの店舗URL"
          />
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Mail className="w-5 h-5 text-neutral-500 group-focus-within:text-white transition-colors" />
          </div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 transition-all font-light"
            placeholder="レポート受け取り用メールアドレス"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full relative overflow-hidden group bg-white text-black font-medium py-3.5 rounded-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 mt-4"
      >
        <span className="relative z-10 font-bold">AI診断を無料で実行する</span>
        <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
      </button>

      <p className="text-center text-xs text-neutral-600 mt-6 !leading-relaxed">
        This site is protected by reCAPTCHA and the Google <br/>
        <a href="#" className="underline hover:text-neutral-400 transition-colors">Privacy Policy</a> and <a href="#" className="underline hover:text-neutral-400 transition-colors">Terms of Service</a> apply.
      </p>
    </form>
  );
}
