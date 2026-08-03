import { motion } from 'framer-motion';
import { Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { ContactForm } from './ContactForm';

const FacebookIcon = ({ size = 20 }: { size?: number }) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.23.2 2.23.2v2.46h-1.25c-1.24 0-1.62.77-1.62 1.56v1.9h2.76l-.44 2.91h-2.32V22C18.34 21.24 22 17.08 22 12.06Z" />
  </svg>
);

export const Contact = () => {
  return (
    <section id="contact" className="py-24 bg-gradient-to-br from-blue-900 to-blue-800 text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-serif mb-4">
            Get in Touch
          </h2>
          <p className="text-xl text-white/80 max-w-2xl mx-auto font-light">
            Interested in learning more about Freemasonry or visiting our Lodge?
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-4 backdrop-blur-sm">
              <MapPin size={28} />
            </div>
            <h3 className="text-xl font-serif mb-2">Location</h3>
            <p className="text-white/80 font-light">
              Carp, Ontario<br />
              West Ottawa
            </p>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-4 backdrop-blur-sm">
              <Mail size={28} />
            </div>
            <h3 className="text-xl font-serif mb-2">Email</h3>
            <a 
              href="mailto:carpmasons@gmail.com"
              className="text-white/80 font-light hover:text-amber-300 transition-colors"
            >
              carpmasons@gmail.com
            </a>
          </div>

        </motion.div>

        <ContactForm />

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 text-center space-y-2"
        >
          <p className="text-white/60 text-sm font-light">
            &copy; {new Date().getFullYear()} Carleton Lodge No. 465. All rights reserved.
          </p>
          <p className="text-white/60 text-sm font-light">
            Ancient Free and Accepted Masons of Canada
          </p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <Link
              to="/privacy-policy"
              className="text-white/50 hover:text-white/80 text-xs font-light transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-white/30 text-xs">|</span>
            <Link
              to="/terms-and-conditions"
              className="text-white/50 hover:text-white/80 text-xs font-light transition-colors"
            >
              Terms and Conditions
            </Link>
            <span className="text-white/30 text-xs">|</span>
            <Link
              to="/links"
              className="text-white/50 hover:text-white/80 text-xs font-light transition-colors"
            >
              Masonic Links
            </Link>
          </div>
          <div className="mt-10 flex items-center justify-center">
            <a
              href="https://www.facebook.com/CarletonLodge465"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-md transition-colors"
            >
              <FacebookIcon size={20} />
              <span className="font-medium">Follow us on Facebook</span>
            </a>
          </div>
          <div className="mt-12 flex justify-center">
            <img 
              src="/ontario-masons-logo.png" 
              alt="Ontario Masons" 
              className="h-16 object-contain opacity-90"
            />
          </div>
          <p className="text-white/50 text-xs font-light mt-6">
            Custom Built by{' '}
            <a
              href="https://www.astrawebdev.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 hover:text-white transition-colors underline"
            >
              Astra Web Dev
            </a>
            : A Division of North Star Holdings
          </p>
        </motion.div>
      </div>
    </section>
  );
};
