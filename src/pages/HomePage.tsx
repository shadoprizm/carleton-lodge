import { Hero } from '../components/Hero';
import { Announcements } from '../components/Announcements';
import { WhatIsFreemasonry } from '../components/WhatIsFreemasonry';
import { Pathways } from '../components/Pathways';
import { AboutLodge } from '../components/AboutLodge';
import { Events } from '../components/Events';
import { History } from '../components/History';
import { ContactCtaBand } from '../components/ContactCtaBand';

export const HomePage = () => {
  return (
    <>
      <Hero />
      <Announcements />
      <WhatIsFreemasonry />
      <Pathways />
      <AboutLodge />
      <Events />
      <History />
      <ContactCtaBand />
    </>
  );
};
