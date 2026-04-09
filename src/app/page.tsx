import DiagnosticForm from "@/components/DiagnosticForm";

export default function Home() {
  return (
    <main className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-white/[0.03] blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 right-[-10%] w-[600px] h-[600px] bg-neutral-900 blur-[150px] rounded-full"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        {/* Left Column: Copy */}
        <div className="text-center lg:text-left animate-slide-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium tracking-widest text-neutral-400 mb-6 uppercase">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            AI Powered Analysis
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-sans tracking-tight font-light mb-6 leading-[1.15]">
            MEO集客の<br className="hidden sm:block" />
            <span className="font-semibold text-gradient">最適解</span>を見つける
          </h1>
          <p className="text-neutral-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0 font-light mb-8">
            Googleビジネスプロフィールを最新のAIが解析。<br />
            競合との差分、改善すべき具体的なアクションをワンクリックで診断し、集客力を最大化します。
          </p>
          
          <div className="hidden lg:grid grid-cols-2 gap-6 pt-8 border-t border-white/10">
            <div>
              <div className="text-2xl font-display font-light text-white mb-1">01.</div>
              <div className="text-sm text-neutral-500">店舗状況の正確なスキャンとAI分析</div>
            </div>
            <div>
              <div className="text-2xl font-display font-light text-white mb-1">02.</div>
              <div className="text-sm text-neutral-500">明日から実践可能なアクションリスト生成</div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Form */}
        <div className="relative w-full max-w-md mx-auto lg:max-w-none animate-slide-up animation-delay-100">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            {/* Subtle glow border */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            <div className="mb-8 text-center sm:text-left">
              <h3 className="text-xl font-medium text-white mb-2">無料AI診断を開始する</h3>
              <p className="text-xs sm:text-sm text-neutral-400">
                URLと情報をご入力ください。約30秒で診断が完了します。
              </p>
            </div>

            <DiagnosticForm />
          </div>
        </div>
      </div>
    </main>
  );
}
