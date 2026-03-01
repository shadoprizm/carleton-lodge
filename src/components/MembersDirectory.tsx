import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, X, Crown, Shield, Star, Users } from 'lucide-react';
import { supabase, LodgeMemberWithPosition } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const ORG_TIERS: Record<string, number> = {
  'Worshipful Master': 0,
  'Secretary': 1,
  'Senior Warden': 2,
  'Junior Warden': 2,
  'Treasurer': 3,
  'Senior Deacon': 3,
  'Junior Deacon': 3,
  'Inner Guard': 3,
  'Senior Steward': 3,
  'Junior Steward': 3,
  'Chaplain': 3,
  'Dir. of Ceremonies': 3,
  'Tyler': 3,
  'Immed Past Master': 3,
  "Ass't Secretary": 3,
  'Piper': 3,
};

function getInitials(name: string) {
  const parts = name.replace(/^(W\.\s*Bro\.|V\.W\.\s*Bro\.|Bro\.|V\.W\.)/i, '').trim().split(' ');
  return parts.filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
}

type CardStyle = {
  avatarBg: string;
  avatarRing: string;
  headerBg: string;
  badge: string;
  badgeText: string;
  label: string;
  Icon: React.ElementType;
  cardBorder: string;
  size: 'lg' | 'md' | 'sm';
};

function getCardStyle(positionName: string): CardStyle {
  if (positionName === 'Worshipful Master') {
    return {
      avatarBg: 'bg-amber-700',
      avatarRing: 'ring-amber-500',
      headerBg: 'from-amber-900 to-amber-700',
      badge: 'bg-amber-100',
      badgeText: 'text-amber-800',
      label: 'Principal Officer',
      Icon: Crown,
      cardBorder: 'border-amber-300',
      size: 'lg',
    };
  }
  if (positionName === 'Secretary') {
    return {
      avatarBg: 'bg-teal-800',
      avatarRing: 'ring-teal-500',
      headerBg: 'from-teal-900 to-teal-700',
      badge: 'bg-teal-100',
      badgeText: 'text-teal-800',
      label: 'Lodge Officer',
      Icon: Shield,
      cardBorder: 'border-teal-300',
      size: 'md',
    };
  }
  if (positionName === 'Senior Warden' || positionName === 'Junior Warden') {
    return {
      avatarBg: 'bg-blue-900',
      avatarRing: 'ring-blue-600',
      headerBg: 'from-blue-950 to-blue-800',
      badge: 'bg-blue-100',
      badgeText: 'text-blue-900',
      label: 'Principal Officer',
      Icon: Crown,
      cardBorder: 'border-blue-300',
      size: 'md',
    };
  }
  if (ORG_TIERS[positionName] === 3) {
    return {
      avatarBg: 'bg-slate-700',
      avatarRing: 'ring-slate-500',
      headerBg: 'from-slate-800 to-slate-700',
      badge: 'bg-slate-100',
      badgeText: 'text-slate-700',
      label: 'Lodge Officer',
      Icon: Shield,
      cardBorder: 'border-slate-200',
      size: 'sm',
    };
  }
  return {
    avatarBg: 'bg-stone-600',
    avatarRing: 'ring-stone-400',
    headerBg: 'from-stone-700 to-stone-600',
    badge: 'bg-stone-100',
    badgeText: 'text-stone-700',
    label: 'Member',
    Icon: Star,
    cardBorder: 'border-stone-200',
    size: 'sm',
  };
}

type OfficerCardProps = {
  member: LodgeMemberWithPosition;
  size?: 'lg' | 'md' | 'sm';
  onClick: (m: LodgeMemberWithPosition) => void;
  delay?: number;
  cardRef?: React.RefObject<HTMLDivElement>;
};

function OfficerCard({ member, size, onClick, delay = 0, cardRef }: OfficerCardProps) {
  const positionName = member.lodge_positions?.name ?? 'Member';
  const style = getCardStyle(positionName);
  const cardSize = size ?? style.size;
  const initials = getInitials(member.full_name);
  const isVacant = member.full_name.toLowerCase().includes('vacant');
  const Icon = style.Icon;

  const avatarSize =
    cardSize === 'lg' ? 'w-16 h-16 text-xl' :
    cardSize === 'md' ? 'w-12 h-12 text-base' :
    'w-10 h-10 text-sm';

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={!isVacant ? { y: -4, transition: { duration: 0.2 } } : {}}
      onClick={() => !isVacant && onClick(member)}
      className={`group bg-white rounded-xl border ${style.cardBorder} shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isVacant ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
    >
      <div className={`bg-gradient-to-br ${style.headerBg} px-4 pt-4 pb-6`}>
        <div className={`mx-auto ${avatarSize} rounded-full ${style.avatarBg} ring-2 ${style.avatarRing} flex items-center justify-center text-white font-serif font-bold`}>
          {isVacant ? '?' : initials}
        </div>
      </div>
      <div className="relative -mt-4 flex justify-center">
        <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm ${style.badge} ${style.badgeText}`}>
          <Icon size={10} />
          {style.label}
        </div>
      </div>
      <div className="px-4 pb-4 pt-2 text-center">
        <p className="font-semibold text-stone-900 text-sm leading-snug">{member.full_name}</p>
        <p className="text-xs text-blue-900 font-medium mt-0.5">{positionName}</p>
        {member.phone && (
          <div className="flex items-center justify-center mt-2 text-xs text-stone-400 gap-1">
            <Phone size={10} />
            <span>{member.phone}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

type Rect = { top: number; left: number; width: number; height: number };

function getBottom(r: Rect) {
  return { x: r.left + r.width / 2, y: r.top + r.height };
}

function getTop(r: Rect) {
  return { x: r.left + r.width / 2, y: r.top };
}

function getLeft(r: Rect) {
  return { x: r.left, y: r.top + r.height / 2 };
}

type ConnectorSvgProps = {
  containerRef: React.RefObject<HTMLDivElement>;
  wmRef: React.RefObject<HTMLDivElement>;
  secRef: React.RefObject<HTMLDivElement>;
  swRef: React.RefObject<HTMLDivElement>;
  jwRef: React.RefObject<HTMLDivElement>;
  tier3Refs: React.RefObject<HTMLDivElement>[];
  hasWm: boolean;
  hasSec: boolean;
  hasWardens: boolean;
  hasTier3: boolean;
};

function ConnectorSvg({ containerRef, wmRef, secRef, swRef, jwRef, tier3Refs, hasWm, hasSec, hasWardens, hasTier3 }: ConnectorSvgProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const rel = (el: HTMLDivElement | null): Rect | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: r.top - cRect.top,
        left: r.left - cRect.left,
        width: r.width,
        height: r.height,
      };
    };

    const newPaths: string[] = [];
    const wm = hasWm ? rel(wmRef.current) : null;
    const sec = hasSec ? rel(secRef.current) : null;
    const sw = hasWardens ? rel(swRef.current) : null;
    const jw = hasWardens ? rel(jwRef.current) : null;

    const midY_wmToSec = wm && sec ? (getBottom(wm).y + getTop(sec).y) / 2 : 0;

    // WM -> down to midpoint then branch to Secretary and continue to Wardens
    if (wm) {
      const wmBottom = getBottom(wm);

      if (sec && !sw && !jw) {
        // WM to Secretary only (no wardens)
        const secLeft = getLeft(sec);
        newPaths.push(`M ${wmBottom.x} ${wmBottom.y} L ${wmBottom.x} ${midY_wmToSec} L ${secLeft.x} ${secLeft.y}`);
      } else if (sec && (sw || jw)) {
        // WM down to junction, then perpendicular L-shaped branch to Secretary
        const secLeft = getLeft(sec);
        const secMidY = sec.top + sec.height / 2;
        const junction = { x: wmBottom.x, y: secMidY };
        // vertical from WM down to Secretary's mid-height
        newPaths.push(`M ${wmBottom.x} ${wmBottom.y} L ${junction.x} ${junction.y}`);
        // horizontal branch right to Secretary
        newPaths.push(`M ${junction.x} ${junction.y} L ${secLeft.x} ${secLeft.y}`);
        // continue vertical down from junction toward wardens
        if (sw || jw) {
          const wardensTopY = Math.min(sw ? getTop(sw).y : Infinity, jw ? getTop(jw).y : Infinity);
          newPaths.push(`M ${junction.x} ${junction.y} L ${junction.x} ${wardensTopY}`);
        }
      } else if (!sec && (sw || jw)) {
        // WM to wardens directly
        const wardensTopY = Math.min(sw ? getTop(sw).y : Infinity, jw ? getTop(jw).y : Infinity);
        newPaths.push(`M ${wmBottom.x} ${wmBottom.y} L ${wmBottom.x} ${wardensTopY}`);
      }
    }

    // Wardens horizontal bar + drops
    if (sw && jw) {
      const swTop = getTop(sw);
      const jwTop = getTop(jw);
      const barY = Math.min(swTop.y, jwTop.y);
      // horizontal bar
      newPaths.push(`M ${swTop.x} ${barY} L ${jwTop.x} ${barY}`);
      // drops to each card
      newPaths.push(`M ${swTop.x} ${barY} L ${swTop.x} ${swTop.y}`);
      newPaths.push(`M ${jwTop.x} ${barY} L ${jwTop.x} ${jwTop.y}`);
    } else if (sw) {
      // just one warden
    } else if (jw) {
      // just one warden
    }

    // Wardens -> Tier3: line from midpoint between wardens down to a horizontal bar over tier3 cards
    if (hasTier3 && tier3Refs.length > 0) {
      const wardensSource = sw || jw;
      if (wardensSource) {
        const sourceX = sw && jw
          ? (getBottom(sw).x + getBottom(jw).x) / 2
          : getBottom(wardensSource!).x;
        const sourceY = Math.max(sw ? getBottom(sw).y : 0, jw ? getBottom(jw).y : 0);

        const tier3Rects = tier3Refs.map(r => rel(r.current)).filter(Boolean) as Rect[];
        if (tier3Rects.length > 0) {
          const barY = tier3Rects[0].top;
          const leftMostX = Math.min(...tier3Rects.map(r => getTop(r).x));
          const rightMostX = Math.max(...tier3Rects.map(r => getTop(r).x));

          // vertical from wardens midpoint down to bar
          newPaths.push(`M ${sourceX} ${sourceY} L ${sourceX} ${barY}`);
          // horizontal bar across all tier3 cards
          newPaths.push(`M ${leftMostX} ${barY} L ${rightMostX} ${barY}`);
          // drop to each tier3 card
          tier3Rects.forEach(r => {
            const t = getTop(r);
            newPaths.push(`M ${t.x} ${barY} L ${t.x} ${t.y}`);
          });
        }
      } else if (wm) {
        // No wardens, connect WM to tier3 directly
        const wmBottom = getBottom(wm);
        const tier3Rects = tier3Refs.map(r => rel(r.current)).filter(Boolean) as Rect[];
        if (tier3Rects.length > 0) {
          const barY = tier3Rects[0].top;
          const leftMostX = Math.min(...tier3Rects.map(r => getTop(r).x));
          const rightMostX = Math.max(...tier3Rects.map(r => getTop(r).x));
          newPaths.push(`M ${wmBottom.x} ${wmBottom.y} L ${wmBottom.x} ${barY}`);
          newPaths.push(`M ${leftMostX} ${barY} L ${rightMostX} ${barY}`);
          tier3Rects.forEach(r => {
            const t = getTop(r);
            newPaths.push(`M ${t.x} ${barY} L ${t.x} ${t.y}`);
          });
        }
      }
    }

    setPaths(newPaths);
    setSvgSize({ w: cRect.width, h: cRect.height });
  }, [containerRef, wmRef, secRef, swRef, jwRef, tier3Refs, hasWm, hasSec, hasWardens, hasTier3]);

  useLayoutEffect(() => {
    recalculate();
  }, [recalculate]);

  useEffect(() => {
    window.addEventListener('resize', recalculate);
    return () => window.removeEventListener('resize', recalculate);
  }, [recalculate]);

  if (!svgSize.w || !svgSize.h) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={svgSize.w}
      height={svgSize.h}
      style={{ zIndex: 0 }}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export const MembersDirectory = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<LodgeMemberWithPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<LodgeMemberWithPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const wmRef = useRef<HTMLDivElement>(null);
  const secRef = useRef<HTMLDivElement>(null);
  const swRef = useRef<HTMLDivElement>(null);
  const jwRef = useRef<HTMLDivElement>(null);
  const tier3RefsMap = useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());
  const tier3RefsArray = useRef<React.RefObject<HTMLDivElement>[]>([]);

  useEffect(() => {
    if (user) fetchMembers();
  }, [user]);

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lodge_members')
      .select('*, lodge_positions (*)')
      .eq('visible_to_members', true);
    if (!error && data) setMembers(data as LodgeMemberWithPosition[]);
    setLoading(false);
  };

  if (!user) return null;

  const sorted = [...members].sort((a, b) => {
    const oA = a.lodge_positions?.display_order ?? 999;
    const oB = b.lodge_positions?.display_order ?? 999;
    return oA - oB;
  });

  const wm = sorted.find(m => m.lodge_positions?.name === 'Worshipful Master');
  const secretary = sorted.find(m => m.lodge_positions?.name === 'Secretary');
  const wardens = sorted.filter(m =>
    m.lodge_positions?.name === 'Senior Warden' || m.lodge_positions?.name === 'Junior Warden'
  );
  const sw = wardens.find(m => m.lodge_positions?.name === 'Senior Warden');
  const jw = wardens.find(m => m.lodge_positions?.name === 'Junior Warden');
  const tier3Officers = sorted.filter(m => ORG_TIERS[m.lodge_positions?.name ?? ''] === 3);
  const otherMembers = sorted.filter(m => !m.lodge_positions);

  // Ensure refs exist for all tier3 officers
  tier3Officers.forEach(m => {
    if (!tier3RefsMap.current.has(m.id)) {
      tier3RefsMap.current.set(m.id, React.createRef<HTMLDivElement>());
    }
  });
  const newTier3Refs = tier3Officers.map(m => tier3RefsMap.current.get(m.id)!);
  if (
    newTier3Refs.length !== tier3RefsArray.current.length ||
    newTier3Refs.some((r, i) => r !== tier3RefsArray.current[i])
  ) {
    tier3RefsArray.current = newTier3Refs;
  }
  const tier3Refs = tier3RefsArray.current;

  return (
    <section className="min-h-screen bg-stone-50">
      <div className="relative bg-blue-950 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <p className="text-amber-400 text-sm font-medium tracking-widest uppercase mb-3">Carleton Lodge No. 465</p>
            <h1 className="text-5xl font-serif text-white mb-4">Officers & Brethren</h1>
            <div className="w-16 h-px bg-amber-500 mx-auto mb-6" />
            <p className="text-blue-200 max-w-xl mx-auto text-lg">
              The lodge officers and brethren of Carleton Lodge for the current year.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex space-x-2">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-2.5 h-2.5 bg-blue-900 rounded-full"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Org chart with SVG connectors */}
            <div ref={containerRef} className="relative">
              <ConnectorSvg
                containerRef={containerRef}
                wmRef={wmRef}
                secRef={secRef}
                swRef={swRef}
                jwRef={jwRef}
                tier3Refs={tier3Refs}
                hasWm={!!wm}
                hasSec={!!secretary}
                hasWardens={wardens.length > 0}
                hasTier3={tier3Officers.length > 0}
              />

              <div className="relative" style={{ zIndex: 1 }}>
                {/* Tier 0: Worshipful Master */}
                {wm && (
                  <div className="flex justify-center mb-10">
                    <div className="w-52">
                      <OfficerCard member={wm} size="lg" onClick={setSelectedMember} delay={0} cardRef={wmRef} />
                    </div>
                  </div>
                )}

                {/* Tier 1: Secretary offshoot (positioned to the right of center) */}
                {secretary && (
                  <div className="flex justify-center mb-10">
                    {/* spacer on left keeps the center line aligned with WM */}
                    <div className="flex items-center" style={{ width: '100%', maxWidth: 640 }}>
                      <div style={{ flex: 1 }} />
                      <div className="w-px" style={{ flex: '0 0 2px' }} />
                      <div style={{ flex: 0, width: 80 }} />
                      <div className="w-44 shrink-0">
                        <OfficerCard member={secretary} size="md" onClick={setSelectedMember} delay={0.1} cardRef={secRef} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tier 2: Senior Warden + Junior Warden */}
                {wardens.length > 0 && (
                  <div className="flex justify-center gap-12 mb-10">
                    {sw && (
                      <div className="w-44">
                        <OfficerCard member={sw} size="md" onClick={setSelectedMember} delay={0.15} cardRef={swRef} />
                      </div>
                    )}
                    {jw && (
                      <div className="w-44">
                        <OfficerCard member={jw} size="md" onClick={setSelectedMember} delay={0.2} cardRef={jwRef} />
                      </div>
                    )}
                  </div>
                )}

                {/* Tier 3: Remaining lodge officers */}
                {tier3Officers.length > 0 && (
                  <div className="flex flex-col items-center mb-4">
                    <p className="text-center text-xs font-bold tracking-widest uppercase text-stone-600 mb-4 -mt-6">Lodge Officers</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full">
                      {tier3Officers.map((m, i) => {
                        const ref = tier3RefsMap.current.get(m.id)!;
                        return (
                          <OfficerCard
                            key={m.id}
                            member={m}
                            size="sm"
                            onClick={setSelectedMember}
                            delay={0.25 + i * 0.04}
                            cardRef={ref}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Regular members without a position */}
            {otherMembers.length > 0 && (
              <div className="mt-16 pt-10 border-t border-stone-200">
                <div className="flex items-center gap-3 mb-8">
                  <Users size={18} className="text-stone-400" />
                  <h2 className="text-lg font-serif text-stone-700">Brethren</h2>
                  <span className="text-xs text-stone-400 font-medium bg-stone-100 px-2 py-0.5 rounded-full">{otherMembers.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {otherMembers.map((m, i) => {
                    const initials = getInitials(m.full_name);
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.05 + i * 0.03 }}
                        onClick={() => setSelectedMember(m)}
                        className="flex items-center gap-4 bg-white rounded-xl border border-stone-100 shadow-sm px-4 py-3 cursor-pointer hover:shadow-md hover:border-stone-200 transition-all group"
                      >
                        <div className="w-10 h-10 rounded-full bg-stone-600 ring-2 ring-stone-200 flex items-center justify-center text-white font-serif font-bold text-sm shrink-0 group-hover:ring-stone-400 transition-all">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-stone-900 text-sm truncate">{m.full_name}</p>
                          <p className="text-xs text-stone-400">Brother</p>
                        </div>
                        {m.phone && (
                          <div className="ml-auto flex items-center gap-1 text-xs text-stone-300 shrink-0">
                            <Phone size={11} />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedMember && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedMember(null)}
          >
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const positionName = selectedMember.lodge_positions?.name ?? 'Member';
                const style = getCardStyle(positionName);
                const initials = getInitials(selectedMember.full_name);
                const Icon = style.Icon;
                return (
                  <>
                    <div className={`relative bg-gradient-to-br ${style.headerBg} px-8 pt-10 pb-14 text-center`}>
                      <button
                        onClick={() => setSelectedMember(null)}
                        className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
                      >
                        <X size={20} />
                      </button>
                      <div className={`mx-auto w-20 h-20 rounded-full ${style.avatarBg} ring-4 ring-white/20 flex items-center justify-center text-white font-serif text-2xl font-bold mb-4`}>
                        {initials}
                      </div>
                      <h3 className="text-xl font-serif text-white leading-tight">{selectedMember.full_name}</h3>
                      <p className="text-amber-300 text-sm mt-1">{positionName}</p>
                    </div>
                    <div className="relative -mt-6 mx-6">
                      <div className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${style.badge} ${style.badgeText}`}>
                        <Icon size={12} />
                        <span>{style.label}</span>
                      </div>
                    </div>
                    <div className="px-8 pt-6 pb-8 space-y-4">
                      {selectedMember.phone && (
                        <div className="flex items-center space-x-3 p-3 bg-stone-50 rounded-lg">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                            <Phone size={14} className="text-blue-900" />
                          </div>
                          <div>
                            <p className="text-xs text-stone-400 font-medium">Phone</p>
                            <a
                              href={`tel:${selectedMember.phone}`}
                              className="text-sm text-stone-800 font-medium hover:text-blue-900 transition-colors"
                            >
                              {selectedMember.phone}
                            </a>
                          </div>
                        </div>
                      )}
                      {selectedMember.bio && (
                        <div className="pt-2 border-t border-stone-100">
                          <p className="text-xs text-stone-400 font-medium mb-2">About</p>
                          <p className="text-sm text-stone-700 leading-relaxed">{selectedMember.bio}</p>
                        </div>
                      )}
                      {!selectedMember.phone && !selectedMember.bio && (
                        <p className="text-sm text-stone-400 text-center py-2">No additional details on file.</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
