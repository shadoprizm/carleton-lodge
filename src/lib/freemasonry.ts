// Public-facing Freemasonry copy for the homepage section and the
// /freemasonry and /becoming-a-mason pages.
//
// Accuracy rules (see project proposal, section I):
// - Eligibility and "what is Freemasonry" statements follow the current
//   public language of the Grand Lodge of Canada in the Province of Ontario
//   (https://ontariomasons.ca and https://ontariomasons.ca/becoming-a-mason/).
// - Do NOT add claims that are not published by the Grand Lodge: no "belief
//   in a Supreme Being" requirement wording, no residency requirement, no
//   formal petition/ballot step list, no lodge-count statistics.

export const GRAND_LODGE_URL = 'https://ontariomasons.ca/';
export const GRAND_LODGE_BECOMING_URL = 'https://ontariomasons.ca/becoming-a-mason/';

export const freemasonryTagline = 'Making good men better';

export const freemasonryIntro =
  'Freemasonry is the oldest and largest fraternal organization in the world. Its members share a common goal of helping each other become better men, through a body of knowledge and a system of ethics based on the belief that each man has a responsibility to improve himself while being devoted to his family, faith, country, and fraternity.';

export interface Tenet {
  name: string;
  plainLanguage: string;
}

export const tenets: Tenet[] = [
  {
    name: 'Brotherly Love',
    plainLanguage:
      'Treating every person with respect and kindness, whatever their background, race, or creed.',
  },
  {
    name: 'Relief',
    plainLanguage:
      'Practising charity and caring for one another, our families, and our communities.',
  },
  {
    name: 'Truth',
    plainLanguage:
      'Valuing honesty, integrity, and the lifelong pursuit of knowledge and self-improvement.',
  },
];

export interface FreemasonryFact {
  heading: string;
  body: string;
}

// "What Freemasonry is — and is not", following Grand Lodge public language.
export const freemasonryFacts: FreemasonryFact[] = [
  {
    heading: 'A fraternity, first and foremost',
    body: 'Freemasonry is first and foremost a fraternity rather than a service organization, social club, or benevolent society. Charity matters deeply to Masons, but it is not the main objective of Freemasonry.',
  },
  {
    heading: 'Not a secret society',
    body: 'Masonry is not a secret society — we are happy to share what we know. The so-called Masonic "secrets" are confined to traditional modes of recognition by which a visiting Mason can prove himself to be one.',
  },
  {
    heading: 'Devoted to faith, without sectarianism',
    body: 'Masons are spiritual and moral people, each devoted to his own faith. There is no room for discussion of sectarian religion or partisan politics in Freemasonry.',
  },
  {
    heading: 'Taught through symbols and degrees',
    body: 'Masons participate in three progressive degrees, each one teaching an important lesson through the use of symbols — an approach to learning that is centuries old.',
  },
  {
    heading: 'Open to good men of every background',
    body: 'Masons come from every walk of life. Men are welcome regardless of race, colour, or creed; what matters is character.',
  },
];

// The only eligibility statement we publish — quoted from the Grand Lodge of
// Canada in the Province of Ontario (ontariomasons.ca).
export const eligibilityQuote =
  'Any man of faith, 21 years of age or older, who is of good moral character and reputation can become a Mason.';
export const eligibilityAttribution =
  'Grand Lodge of Canada in the Province of Ontario';

export const voluntaryPrinciple =
  'Freemasonry does not solicit members. By tradition, a man comes to Freemasonry of his own free will — the old expression is "to be one, ask one." If you are curious, you do not need to know a Mason and you do not need to wait to be asked. The first step is simply a conversation.';

export interface ConversationStep {
  title: string;
  body: string;
}

export const conversationSteps: ConversationStep[] = [
  {
    title: 'Start a conversation',
    body: 'Reach out to Carleton Lodge through our contact page, or complete the Grand Lodge\u2019s official inquiry form. Tell us a little about yourself and what has drawn you to Freemasonry.',
  },
  {
    title: 'Get to know us',
    body: 'A member of the Lodge will be in touch. You will have the chance to meet some of the brethren, ask anything you like, and get an honest sense of what Lodge life involves — with no obligation and no pressure.',
  },
  {
    title: 'Decide for yourself',
    body: 'If Freemasonry feels right for you, the members you have come to know can explain how to take the next step. The decision — and the timing — is always yours.',
  },
];
