import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface Pathway {
  question: string;
  description: string;
  linkLabel: string;
  path: string;
}

const pathways: Pathway[] = [
  {
    question: 'Curious about Freemasonry?',
    description: '2B1ASK1 — “To be one, ask one.” Learn what Freemasonry is and how a conversation begins.',
    linkLabel: 'Becoming a Mason',
    path: '/becoming-a-mason',
  },
  {
    question: 'Visiting from another Lodge?',
    description: 'Find our meeting night, location, and how to reach us.',
    linkLabel: 'Visit or contact us',
    path: '/contact',
  },
  {
    question: 'Carleton Lodge member?',
    description: 'Sign in for summons, the member directory, and documents.',
    linkLabel: 'Go to My Lodge',
    path: '/my-lodge',
  },
];

export const Pathways = () => {
  return (
    <section aria-label="Find your way" className="py-14 bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="divide-y divide-white/10 md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
          {pathways.map((pathway, index) => (
            <motion.div
              key={pathway.path}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="py-6 md:px-8 md:py-2 first:md:pl-0 last:md:pr-0"
            >
              <h2 className="text-xl font-serif text-amber-100 mb-2">{pathway.question}</h2>
              <p className="text-sm leading-relaxed text-slate-300 font-light mb-3">
                {pathway.description}
              </p>
              <Link
                to={pathway.path}
                className="inline-flex min-h-11 items-center space-x-2 text-amber-300 hover:text-amber-200 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 rounded"
              >
                <span>{pathway.linkLabel}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
