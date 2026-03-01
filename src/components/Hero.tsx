import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface HeroProps {
  onScrollToEvents: () => void;
}

export const Hero = ({ onScrollToEvents }: HeroProps) => {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('/Gemini_Generated_Image_3y3hvn3y3hvn3y3h.png')`,
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-blue-900/60 to-slate-800/70" />

      <div className="absolute inset-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
      }} />

      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/30" />

      <div className="relative h-full flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="max-w-5xl"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mb-6"
          >
            <div className="inline-block px-4 py-2 border border-amber-400/40 rounded-full backdrop-blur-sm bg-amber-900/20">
              <p className="text-amber-200/90 text-sm tracking-[0.3em] uppercase font-light">
                Est. January 12, 1904
              </p>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.7 }}
            className="text-4xl md:text-6xl lg:text-7xl font-serif text-white mb-4 leading-tight"
          >
            Carleton Lodge 465
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-xl md:text-2xl text-amber-200/80 font-serif mb-4 tracking-wide"
          >
            A.F. &amp; A.M.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="text-base md:text-lg text-white/90 font-light tracking-wide leading-relaxed max-w-2xl mx-auto mb-2"
          >
            Grand Lodge of Canada in the Province of Ontario
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="text-base md:text-lg text-white/80 font-light italic tracking-wide leading-relaxed max-w-2xl mx-auto"
          >
            Carpe Diem
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button
              onClick={onScrollToEvents}
              className="px-8 py-4 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-all font-medium tracking-wide shadow-lg"
            >
              View Upcoming Events
            </button>
            <button
              onClick={() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 border-2 border-amber-400 text-amber-100 rounded-md hover:bg-amber-400/10 transition-all font-medium tracking-wide"
            >
              Explore Our History
            </button>
          </motion.div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          onClick={onScrollToEvents}
          className="absolute bottom-12 text-white/70 hover:text-white transition-colors cursor-pointer"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown size={32} />
          </motion.div>
        </motion.button>
      </div>
    </div>
  );
};
