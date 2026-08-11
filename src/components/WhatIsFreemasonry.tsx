import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { freemasonryIntro, freemasonryTagline, tenets } from '../lib/freemasonry';

export const WhatIsFreemasonry = () => {
  return (
    <section className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700 mb-3">
            {freemasonryTagline}
          </p>
          <h2 className="text-5xl md:text-6xl font-serif text-slate-900 mb-6">
            What is Freemasonry?
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto font-light leading-relaxed">
            {freemasonryIntro}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="grid gap-8 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-slate-200 max-w-5xl mx-auto mb-12"
        >
          {tenets.map((tenet) => (
            <div key={tenet.name} className="text-center sm:px-8">
              <h3 className="text-2xl font-serif text-slate-900 mb-2">{tenet.name}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{tenet.plainLanguage}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="text-center"
        >
          <Link
            to="/freemasonry"
            className="inline-flex items-center space-x-2 text-amber-700 hover:text-amber-800 font-semibold text-lg"
          >
            <span>Learn more about Freemasonry</span>
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
