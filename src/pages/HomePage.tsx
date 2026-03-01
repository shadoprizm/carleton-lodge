import { useRef } from 'react';
import { Hero } from '../components/Hero';
import { Events } from '../components/Events';
import { History } from '../components/History';
import { Contact } from '../components/Contact';

export const HomePage = () => {
  const eventsRef = useRef<HTMLDivElement>(null);

  const scrollToEvents = () => {
    const element = document.getElementById('events');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <Hero onScrollToEvents={scrollToEvents} />
      <div ref={eventsRef}>
        <Events />
      </div>
      <History />
      <Contact />
    </>
  );
};
