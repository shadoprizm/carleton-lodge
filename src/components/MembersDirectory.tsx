import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Phone, X, Crown, Shield, Star, Users } from 'lucide-react';
import { Link } from 'react-router';
import { supabase, LodgePosition, MemberDirectoryProfileWithPosition } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  LODGE_MEMBER_POSITION_RELATION_SELECT,
  memberPositions,
  primaryPosition,
  sortedPositions,
} from '../lib/lodgePositions';
import {
  displayLodgePositionName,
  LodgeRoleGroup,
  lodgeRoleGroup,
  lodgeRoleOrder,
} from '../lib/lodgeOfficerGroups';

function isRegularMemberPosition(positionName: string | null | undefined) {
  return positionName?.trim().toLowerCase() === 'member';
}

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

function getCardStyle(position: LodgePosition | null, roleGroup?: LodgeRoleGroup): CardStyle {
  const positionName = position?.name ?? 'Member';
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
      label: 'Principal Officer',
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
  if (roleGroup === 'EX_OFFICIO') {
    return {
      avatarBg: 'bg-stone-700',
      avatarRing: 'ring-amber-500',
      headerBg: 'from-stone-800 to-stone-700',
      badge: 'bg-amber-100',
      badgeText: 'text-amber-900',
      label: 'Ex Officio',
      Icon: Star,
      cardBorder: 'border-amber-200',
      size: 'md',
    };
  }
  if (roleGroup === 'ELECTED') {
    return {
      avatarBg: 'bg-blue-900',
      avatarRing: 'ring-blue-600',
      headerBg: 'from-blue-950 to-blue-800',
      badge: 'bg-blue-100',
      badgeText: 'text-blue-900',
      label: 'Elected Officer',
      Icon: Shield,
      cardBorder: 'border-blue-200',
      size: 'sm',
    };
  }
  if (roleGroup === 'APPOINTED') {
    return {
      avatarBg: 'bg-slate-700',
      avatarRing: 'ring-slate-500',
      headerBg: 'from-slate-800 to-slate-700',
      badge: 'bg-slate-100',
      badgeText: 'text-slate-700',
      label: 'Appointed Officer',
      Icon: Shield,
      cardBorder: 'border-slate-200',
      size: 'sm',
    };
  }
  if (position?.position_type === 'FUNCTIONAL') {
    return {
      avatarBg: 'bg-amber-800',
      avatarRing: 'ring-amber-500',
      headerBg: 'from-amber-950 to-amber-800',
      badge: 'bg-amber-100',
      badgeText: 'text-amber-900',
      label: 'Functional Role',
      Icon: Star,
      cardBorder: 'border-amber-200',
      size: 'sm',
    };
  }
  if (position) {
    return {
      avatarBg: 'bg-stone-700',
      avatarRing: 'ring-stone-500',
      headerBg: 'from-stone-800 to-stone-700',
      badge: 'bg-stone-100',
      badgeText: 'text-stone-700',
      label: 'Lodge Role',
      Icon: Shield,
      cardBorder: 'border-stone-200',
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
  member: MemberDirectoryProfileWithPosition | null;
  position: LodgePosition;
  roleGroup?: LodgeRoleGroup;
  size?: 'lg' | 'md' | 'sm';
  onClick: (m: MemberDirectoryProfileWithPosition) => void;
  delay?: number;
  cardRef?: React.RefObject<HTMLDivElement | null>;
};

function OfficerCard({ member, position, roleGroup, size, onClick, delay = 0, cardRef }: OfficerCardProps) {
  const style = getCardStyle(position, roleGroup);
  const cardSize = size ?? style.size;
  const initials = member ? getInitials(member.full_name) : '';
  const isVacant = !member || member.full_name.toLowerCase().includes('vacant');
  const Icon = style.Icon;
  const positionName = displayLodgePositionName(position.name);
  const selectMember = () => {
    if (member && !isVacant) onClick(member);
  };

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
      onClick={selectMember}
      onKeyDown={event => {
        if (!isVacant && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          selectMember();
        }
      }}
      role={!isVacant ? 'button' : undefined}
      tabIndex={!isVacant ? 0 : undefined}
      aria-label={!isVacant && member ? `View ${member.full_name}, ${positionName}` : undefined}
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
        <p className="font-semibold text-stone-900 text-sm leading-snug">{member?.full_name ?? 'Vacant'}</p>
        <p className="text-xs text-blue-900 font-medium mt-0.5">{positionName}</p>
        {member?.phone && (
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

type RoleAssignment = {
  member: MemberDirectoryProfileWithPosition;
  position: LodgePosition;
};

type RoleSlot = {
  key: string;
  member: MemberDirectoryProfileWithPosition | null;
  position: LodgePosition;
};

function roleSlots(
  assignments: RoleAssignment[],
  positions: LodgePosition[],
  group: LodgeRoleGroup,
  includeOpenSlots = false,
): RoleSlot[] {
  const assignmentsByPosition = new Map<string, RoleAssignment[]>();

  assignments.forEach(assignment => {
    const positionAssignments = assignmentsByPosition.get(assignment.position.id) ?? [];
    positionAssignments.push(assignment);
    assignmentsByPosition.set(assignment.position.id, positionAssignments);
  });

  const positionsById = new Map<string, LodgePosition>();
  positions.forEach(position => positionsById.set(position.id, position));
  assignments.forEach(assignment => positionsById.set(assignment.position.id, assignment.position));

  return [...positionsById.values()]
    .sort((left, right) =>
      lodgeRoleOrder(left.name, group) - lodgeRoleOrder(right.name, group)
      || left.display_order - right.display_order
      || left.name.localeCompare(right.name)
    )
    .flatMap(position => {
      const positionAssignments = assignmentsByPosition.get(position.id) ?? [];
      const assignedSlots = positionAssignments.map(assignment => ({
        key: `${assignment.member.id}:${position.id}`,
        member: assignment.member,
        position,
      }));
      const openSlotCount = includeOpenSlots
        ? Math.max(0, position.max_holders - assignedSlots.length)
        : 0;
      const openSlots = Array.from({ length: openSlotCount }, (_, index) => ({
        key: `${position.id}:vacant:${index}`,
        member: null,
        position,
      }));

      return [...assignedSlots, ...openSlots];
    });
}

function getBottom(r: Rect) {
  return { x: r.left + r.width / 2, y: r.top + r.height };
}

function getTop(r: Rect) {
  return { x: r.left + r.width / 2, y: r.top };
}

function getLeft(r: Rect) {
  return { x: r.left, y: r.top + r.height / 2 };
}

function getRight(r: Rect) {
  return { x: r.left + r.width, y: r.top + r.height / 2 };
}

type ConnectorSvgProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  wmRef: React.RefObject<HTMLDivElement | null>;
  ipmRef: React.RefObject<HTMLDivElement | null>;
  secRef: React.RefObject<HTMLDivElement | null>;
  swRef: React.RefObject<HTMLDivElement | null>;
  jwRef: React.RefObject<HTMLDivElement | null>;
  electedRefs: React.RefObject<HTMLDivElement | null>[];
  hasWm: boolean;
  hasIpm: boolean;
  hasSec: boolean;
  hasWardens: boolean;
  hasRemainingElected: boolean;
};

function ConnectorSvg({
  containerRef,
  wmRef,
  ipmRef,
  secRef,
  swRef,
  jwRef,
  electedRefs,
  hasWm,
  hasIpm,
  hasSec,
  hasWardens,
  hasRemainingElected,
}: ConnectorSvgProps) {
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
    const ipm = hasIpm ? rel(ipmRef.current) : null;
    const sec = hasSec ? rel(secRef.current) : null;
    const sw = hasWardens ? rel(swRef.current) : null;
    const jw = hasWardens ? rel(jwRef.current) : null;

    if (wm) {
      if (ipm) {
        const wmLeft = getLeft(wm);
        const ipmRight = getRight(ipm);
        const elbowX = (wmLeft.x + ipmRight.x) / 2;
        newPaths.push(`M ${wmLeft.x} ${wmLeft.y} L ${elbowX} ${wmLeft.y} L ${elbowX} ${ipmRight.y} L ${ipmRight.x} ${ipmRight.y}`);
      }

      if (sec) {
        const wmRight = getRight(wm);
        const secLeft = getLeft(sec);
        const elbowX = (wmRight.x + secLeft.x) / 2;
        newPaths.push(`M ${wmRight.x} ${wmRight.y} L ${elbowX} ${wmRight.y} L ${elbowX} ${secLeft.y} L ${secLeft.x} ${secLeft.y}`);
      }
    }

    const wardens = [sw, jw].filter(Boolean) as Rect[];
    if (wm && wardens.length > 0) {
      const wmBottom = getBottom(wm);
      const wardenTops = wardens.map(getTop);
      const barY = Math.min(...wardenTops.map(point => point.y));
      const leftMostX = Math.min(...wardenTops.map(point => point.x));
      const rightMostX = Math.max(...wardenTops.map(point => point.x));

      newPaths.push(`M ${wmBottom.x} ${wmBottom.y} L ${wmBottom.x} ${barY}`);
      if (wardenTops.length > 1) {
        newPaths.push(`M ${leftMostX} ${barY} L ${rightMostX} ${barY}`);
      }
      wardenTops.forEach(point => {
        newPaths.push(`M ${point.x} ${barY} L ${point.x} ${point.y}`);
      });
    }

    if (hasRemainingElected && electedRefs.length > 0) {
      const wardensSource = sw || jw;
      const electedRects = electedRefs.map(ref => rel(ref.current)).filter(Boolean) as Rect[];

      if (electedRects.length > 0 && wardensSource) {
        const sourceX = sw && jw
          ? (getBottom(sw).x + getBottom(jw).x) / 2
          : getBottom(wardensSource).x;
        const sourceY = Math.max(sw ? getBottom(sw).y : 0, jw ? getBottom(jw).y : 0);
        const electedTops = electedRects.map(getTop);
        const barY = Math.min(...electedTops.map(point => point.y));
        const leftMostX = Math.min(...electedTops.map(point => point.x));
        const rightMostX = Math.max(...electedTops.map(point => point.x));

        newPaths.push(`M ${sourceX} ${sourceY} L ${sourceX} ${barY}`);
        newPaths.push(`M ${leftMostX} ${barY} L ${rightMostX} ${barY}`);
        electedTops.forEach(point => {
          newPaths.push(`M ${point.x} ${barY} L ${point.x} ${point.y}`);
        });
      } else if (wm) {
        const wmBottom = getBottom(wm);
        const electedTops = electedRects.map(getTop);
        if (electedTops.length > 0) {
          const barY = Math.min(...electedTops.map(point => point.y));
          const leftMostX = Math.min(...electedTops.map(point => point.x));
          const rightMostX = Math.max(...electedTops.map(point => point.x));
          newPaths.push(`M ${wmBottom.x} ${wmBottom.y} L ${wmBottom.x} ${barY}`);
          newPaths.push(`M ${leftMostX} ${barY} L ${rightMostX} ${barY}`);
          electedTops.forEach(point => {
            newPaths.push(`M ${point.x} ${barY} L ${point.x} ${point.y}`);
          });
        }
      }
    }

    setPaths(newPaths);
    setSvgSize({ w: cRect.width, h: cRect.height });
  }, [containerRef, wmRef, ipmRef, secRef, swRef, jwRef, electedRefs, hasWm, hasIpm, hasSec, hasWardens, hasRemainingElected]);

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
      className="absolute inset-0 hidden pointer-events-none md:block"
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
  const [members, setMembers] = useState<MemberDirectoryProfileWithPosition[]>([]);
  const [lodgePositions, setLodgePositions] = useState<LodgePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberDirectoryProfileWithPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const wmRef = useRef<HTMLDivElement>(null);
  const ipmRef = useRef<HTMLDivElement>(null);
  const secRef = useRef<HTMLDivElement>(null);
  const swRef = useRef<HTMLDivElement>(null);
  const jwRef = useRef<HTMLDivElement>(null);
  const electedRefsMap = useRef<Map<string, React.RefObject<HTMLDivElement | null>>>(new Map());
  const electedRefsArray = useRef<React.RefObject<HTMLDivElement | null>[]>([]);

  useEffect(() => {
    if (user) fetchMembers();
  }, [user]);

  const fetchMembers = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [membersResult, positionsResult] = await Promise.all([
        supabase
          .from('lodge_members')
          .select(`id, full_name, phone, join_date, position_id, bio, visible_to_members, linked_profile_id, lodge_email, mailbox_status, mailbox_provisioned_at, mailbox_activated_at, created_at, updated_at, ${LODGE_MEMBER_POSITION_RELATION_SELECT}`)
          .eq('visible_to_members', true),
        supabase
          .from('lodge_positions')
          .select('id, name, display_order, position_type, max_holders, created_at')
          .order('display_order'),
      ]);

      if (membersResult.error) {
        console.error('Could not load the member directory:', membersResult.error);
        setMembers([]);
        setLoadError('The member directory could not be loaded. Please try again.');
        return;
      }

      const loadedMembers = (membersResult.data ?? []) as unknown as Array<
        Omit<MemberDirectoryProfileWithPosition, 'positions'> & {
          lodge_member_positions?: Array<{ lodge_positions: LodgePosition | null }>;
        }
      >;
      setMembers(loadedMembers.map(member => ({
        ...member,
        positions: sortedPositions(
          (member.lodge_member_positions ?? [])
            .map(assignment => assignment.lodge_positions)
            .filter((position): position is LodgePosition => position !== null),
        ),
      })));

      if (positionsResult.error) {
        console.warn('Could not load vacant Lodge positions:', positionsResult.error);
      } else {
        setLodgePositions((positionsResult.data ?? []) as LodgePosition[]);
      }
    } catch (error) {
      console.error('Could not load the member directory:', error);
      setMembers([]);
      setLoadError('The member directory could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const sorted = [...members].sort((a, b) => {
    const oA = primaryPosition(a)?.display_order ?? 999;
    const oB = primaryPosition(b)?.display_order ?? 999;
    return oA - oB;
  });

  const roleAssignments: RoleAssignment[] = sorted.flatMap(member =>
    memberPositions(member)
      .filter(position => !isRegularMemberPosition(position.name))
      .map(position => ({ member, position }))
  );
  const electedAssignments = roleAssignments.filter(
    assignment => lodgeRoleGroup(assignment.position.name) === 'ELECTED',
  );
  const appointedAssignments = roleAssignments.filter(
    assignment => lodgeRoleGroup(assignment.position.name) === 'APPOINTED',
  );
  const exOfficioAssignments = roleAssignments.filter(
    assignment => lodgeRoleGroup(assignment.position.name) === 'EX_OFFICIO',
  );
  const electedPositions = lodgePositions.filter(position => lodgeRoleGroup(position.name) === 'ELECTED');
  const appointedPositions = lodgePositions.filter(position => lodgeRoleGroup(position.name) === 'APPOINTED');
  const exOfficioPositions = lodgePositions.filter(position => lodgeRoleGroup(position.name) === 'EX_OFFICIO');
  const additionalRoleAssignments = roleAssignments
    .filter(assignment => lodgeRoleGroup(assignment.position.name) === 'OTHER')
    .sort((left, right) =>
      left.position.display_order - right.position.display_order
      || left.position.name.localeCompare(right.position.name)
    );
  const electedSlots = roleSlots(electedAssignments, electedPositions, 'ELECTED', true);
  const exOfficioSlots = roleSlots(exOfficioAssignments, exOfficioPositions, 'EX_OFFICIO', true);
  const wm = electedSlots.find(slot => slot.position.name === 'Worshipful Master');
  const ipm = exOfficioSlots.find(slot => slot.position.name === 'Immed Past Master');
  const secretary = electedSlots.find(slot => slot.position.name === 'Secretary');
  const wardens = electedSlots.filter(slot =>
    slot.position.name === 'Senior Warden' || slot.position.name === 'Junior Warden'
  );
  const sw = wardens.find(slot => slot.position.name === 'Senior Warden');
  const jw = wardens.find(slot => slot.position.name === 'Junior Warden');
  const remainingElectedSlots = electedSlots.filter(slot =>
    !['Worshipful Master', 'Secretary', 'Senior Warden', 'Junior Warden']
      .includes(slot.position.name)
  );
  const appointedSlots = roleSlots(appointedAssignments, appointedPositions, 'APPOINTED', true);
  const otherMembers = sorted.filter(member =>
    memberPositions(member).length === 0
    || memberPositions(member).every(position => isRegularMemberPosition(position.name))
  );

  remainingElectedSlots.forEach(slot => {
    if (!electedRefsMap.current.has(slot.key)) {
      electedRefsMap.current.set(slot.key, React.createRef<HTMLDivElement>());
    }
  });
  const newElectedRefs = remainingElectedSlots.map(slot =>
    electedRefsMap.current.get(slot.key)!
  );
  if (
    newElectedRefs.length !== electedRefsArray.current.length ||
    newElectedRefs.some((ref, index) => ref !== electedRefsArray.current[index])
  ) {
    electedRefsArray.current = newElectedRefs;
  }
  const electedRefs = electedRefsArray.current;

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
        ) : loadError ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white px-6 py-10 text-center shadow-sm" role="alert">
            <h2 className="font-serif text-2xl text-slate-900">Member directory unavailable</h2>
            <p className="mt-3 text-base text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={fetchMembers}
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-900 px-6 font-semibold text-amber-300 transition-colors hover:bg-slate-800"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {(ipm || electedSlots.length > 0) && (
              <section aria-labelledby="lodge-leadership-heading">
                <div className="mb-10 text-center">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Officers &amp; advisers</p>
                  <h2 id="lodge-leadership-heading" className="font-serif text-3xl text-blue-950">Lodge Leadership</h2>
                </div>

                <div ref={containerRef} className="relative">
                  <ConnectorSvg
                    containerRef={containerRef}
                    wmRef={wmRef}
                    ipmRef={ipmRef}
                    secRef={secRef}
                    swRef={swRef}
                    jwRef={jwRef}
                    electedRefs={electedRefs}
                    hasWm={!!wm}
                    hasIpm={!!ipm}
                    hasSec={!!secretary}
                    hasWardens={wardens.length > 0}
                    hasRemainingElected={remainingElectedSlots.length > 0}
                  />

                  <div
                    className="relative grid grid-cols-1 justify-center gap-6 md:grid-cols-[11rem_13rem_11rem] md:items-start md:gap-x-8 md:gap-y-12 lg:gap-x-12"
                    style={{ zIndex: 1 }}
                  >
                    {ipm && (
                      <section className="contents" aria-label="Ex-officio Lodge role">
                        <div
                          data-testid="immediate-past-master-slot"
                          className="order-6 mx-auto w-44 md:order-none md:col-start-1 md:row-start-2 md:mt-8"
                        >
                          <OfficerCard member={ipm.member} position={ipm.position} roleGroup="EX_OFFICIO" size="md" onClick={setSelectedMember} delay={0.08} cardRef={ipmRef} />
                        </div>
                      </section>
                    )}

                    {electedSlots.length > 0 && (
                      <section className="contents" aria-labelledby="elected-officers-heading">
                        <h3
                          id="elected-officers-heading"
                          className="order-1 text-center font-serif text-2xl text-blue-950 md:order-none md:col-span-3 md:col-start-1 md:row-start-1"
                        >
                          Elected Officers
                        </h3>

                        {wm && (
                          <div className="order-2 mx-auto w-52 md:order-none md:col-start-2 md:row-start-2">
                            <OfficerCard member={wm.member} position={wm.position} roleGroup="ELECTED" size="lg" onClick={setSelectedMember} delay={0} cardRef={wmRef} />
                          </div>
                        )}

                        {secretary ? (
                          <div className="order-3 mx-auto w-44 md:order-none md:col-start-3 md:row-start-2 md:mt-8">
                            <OfficerCard member={secretary.member} position={secretary.position} roleGroup="ELECTED" size="md" onClick={setSelectedMember} delay={0.12} cardRef={secRef} />
                          </div>
                        ) : <div className="hidden md:col-start-3 md:row-start-2 md:block" />}

                        {wardens.length > 0 && (
                          <div className="order-4 flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-12 md:order-none md:col-span-3 md:row-start-3">
                            {sw && (
                              <div className="w-44">
                                <OfficerCard member={sw.member} position={sw.position} roleGroup="ELECTED" size="md" onClick={setSelectedMember} delay={0.16} cardRef={swRef} />
                              </div>
                            )}
                            {jw && (
                              <div className="w-44">
                                <OfficerCard member={jw.member} position={jw.position} roleGroup="ELECTED" size="md" onClick={setSelectedMember} delay={0.2} cardRef={jwRef} />
                              </div>
                            )}
                          </div>
                        )}

                        {remainingElectedSlots.length > 0 && (
                          <div className="order-5 grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:order-none md:col-span-3 md:row-start-4 md:grid-cols-5">
                            {remainingElectedSlots.map((slot, index) => (
                              <OfficerCard
                                key={slot.key}
                                member={slot.member}
                                position={slot.position}
                                roleGroup="ELECTED"
                                size="sm"
                                onClick={setSelectedMember}
                                delay={0.24 + index * 0.04}
                                cardRef={electedRefsMap.current.get(slot.key)!}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    )}
                  </div>
                </div>
              </section>
            )}

            {appointedSlots.length > 0 && (
              <section className="mt-16 border-t border-slate-200 pt-10" aria-labelledby="appointed-officers-heading">
                <div className="mb-8 flex items-center gap-3">
                  <Shield size={18} className="text-slate-600" />
                  <h2 id="appointed-officers-heading" className="font-serif text-2xl text-blue-950">Appointed Officers</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{appointedSlots.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
                  {appointedSlots.map((slot, index) => (
                    <OfficerCard
                      key={slot.key}
                      member={slot.member}
                      position={slot.position}
                      roleGroup="APPOINTED"
                      size="sm"
                      onClick={setSelectedMember}
                      delay={0.05 + index * 0.04}
                    />
                  ))}
                </div>
              </section>
            )}

            {additionalRoleAssignments.length > 0 && (
              <section className="mt-14 border-t border-amber-200 pt-10" aria-labelledby="other-lodge-roles-heading">
                <div className="mb-7 flex items-center gap-3">
                  <Star size={18} className="text-amber-700" />
                  <h2 id="other-lodge-roles-heading" className="font-serif text-xl text-stone-700">Other Lodge Roles</h2>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{additionalRoleAssignments.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {additionalRoleAssignments.map((assignment, index) => (
                    <OfficerCard
                      key={`${assignment.member.id}:${assignment.position.id}`}
                      member={assignment.member}
                      position={assignment.position}
                      roleGroup="OTHER"
                      size="sm"
                      onClick={setSelectedMember}
                      delay={0.05 + index * 0.04}
                    />
                  ))}
                </div>
              </section>
            )}

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
              className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const selectedPrimaryPosition = primaryPosition(selectedMember);
                const selectedRoleGroup = selectedPrimaryPosition
                  ? lodgeRoleGroup(selectedPrimaryPosition.name)
                  : undefined;
                const style = getCardStyle(selectedPrimaryPosition, selectedRoleGroup);
                const initials = getInitials(selectedMember.full_name);
                const Icon = style.Icon;
                const selectedPositionNames = memberPositions(selectedMember)
                  .map(position => displayLodgePositionName(position.name))
                  .join(' · ') || 'Lodge Member';
                return (
                  <>
                    <div className={`relative bg-gradient-to-br ${style.headerBg} px-8 pt-10 pb-14 text-center`}>
                      <button
                        type="button"
                        aria-label="Close member details"
                        onClick={() => setSelectedMember(null)}
                        className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
                      >
                        <X size={20} />
                      </button>
                      <div className={`mx-auto w-20 h-20 rounded-full ${style.avatarBg} ring-4 ring-white/20 flex items-center justify-center text-white font-serif text-2xl font-bold mb-4`}>
                        {initials}
                      </div>
                      <h3 className="text-xl font-serif text-white leading-tight">{selectedMember.full_name}</h3>
                      <p className="text-amber-300 text-sm mt-1">{selectedPositionNames}</p>
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
                      {selectedMember.lodge_email && (
                        <div className="flex items-center space-x-3 rounded-lg bg-amber-50 p-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                            <Mail size={14} className="text-amber-800" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-stone-500">Lodge email</p>
                            <a
                              href={`mailto:${selectedMember.lodge_email}`}
                              className="block break-all text-sm font-semibold text-blue-950 underline underline-offset-4"
                            >
                              {selectedMember.lodge_email}
                            </a>
                          </div>
                        </div>
                      )}
                      {selectedMember.bio && (
                        <div className="pt-2 border-t border-stone-100">
                          <p className="text-xs text-stone-400 font-medium mb-2">About</p>
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700">{selectedMember.bio}</p>
                        </div>
                      )}
                      {!selectedMember.phone && !selectedMember.lodge_email && !selectedMember.bio && (
                        <p className="text-sm text-stone-400 text-center py-2">No additional details on file.</p>
                      )}
                      <Link
                        to={`/members/${selectedMember.id}`}
                        onClick={() => setSelectedMember(null)}
                        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-slate-900 px-5 font-semibold text-amber-300"
                      >
                        View Full Member Profile
                      </Link>
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
