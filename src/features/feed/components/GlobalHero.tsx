export function GlobalHero() {

    return (
        <div className="relative overflow-hidden rounded-3xl mb-12 shadow-2xl shadow-rose-500/10 border border-white/5">
            {/* Background with Modern Mesh Gradient */}
            <div className="absolute inset-0 bg-[#0f172a]" />
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.15)_0,transparent_70%)] blur-3xl animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(30,64,175,0.1)_0,transparent_70%)] blur-3xl" />

            {/* Animated Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

            <div className="relative px-8 py-12 md:px-12 md:py-16 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="max-w-2xl text-center md:text-left">
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider mb-6">
                        <span className="flex h-2 w-2 rounded-full bg-green-400 mr-2 animate-pulse" />
                        Decentralized Gateway
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                        Explore the <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-200 to-white">Global Hive</span> Ecosystem
                    </h1>
                    <p className="text-xl text-rose-50/90 mb-8 max-w-lg leading-relaxed">
                        The heartbeat of decentralized communities. Discover trending content, join vibrant discussions, and earn rewards on the most active Web3 social network.
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                        <button className="px-8 py-3 bg-white text-[#e11d48] rounded-xl font-bold shadow-xl hover:bg-rose-50 transition-all active:scale-95">
                            Start Exploring
                        </button>
                        <button className="px-8 py-3 bg-white/10 text-white border border-white/30 rounded-xl font-bold backdrop-blur-sm hover:bg-white/20 transition-all active:scale-95">
                            Join a Community
                        </button>
                    </div>
                </div>

                <div className="hidden lg:flex items-center justify-center">
                    <div className="relative w-64 h-64">
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl animate-pulse" />
                        <img
                            src="/vite.svg"
                            alt="Hive Logo"
                            className="relative w-full h-full object-contain filter drop-shadow-2xl animate-bounce"
                            style={{ animationDuration: '3s' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
