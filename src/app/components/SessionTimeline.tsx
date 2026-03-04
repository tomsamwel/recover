import React from "react";
import { motion } from "framer-motion";
import type { Session } from "../scheduleViewModel";
import type { IconName, DoneState } from "../scheduleViewModel";

type Props = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  nowY: number;
  sessions: Session[];
  totals: Record<string, { done: number; total: number; progress: number }>;
  isOverdue: (sessionId: string) => boolean;
  toggleSession: (sessionId: string) => void;
  dotRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  ICONS: Record<IconName, React.ComponentType<{ className?: string }>>;
  done: DoneState;
  toggleItem: (sessionId: string, itemId: string) => void;
  setOpenExercise: (sessionId: string, itemId: string) => void;
  Tile: React.ComponentType<{
    title: string;
    Icon: React.ComponentType<{ className?: string }>;
    done: boolean;
    variant: "active" | "overdue" | "done";
    onToggle: () => void;
    onInfo: () => void;
  }>;
  SessionDot: React.ComponentType<{
    progress: number;
    doneAll: boolean;
    overdue: boolean;
    onClick: () => void;
    innerRef?: (el: HTMLButtonElement | null) => void;
  }>;
};

export function SessionTimeline({ containerRef, nowY, sessions, totals, isOverdue, toggleSession, dotRefs, ICONS, done, toggleItem, setOpenExercise, Tile, SessionDot }: Props) {
  return (
    <div ref={containerRef} className="tlw">
      <div className="rail" aria-hidden />
      <motion.div className="rail-fill" aria-hidden animate={{ height: nowY }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
      <motion.div className="now-dot" aria-hidden animate={{ top: nowY }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />

      <div className="sp">
        {sessions.map((s) => {
          const tot = totals[s.id] ?? { done: 0, total: 0, progress: 0 };
          const overdue = isOverdue(s.id);
          return (
            <div key={s.id} className="row">
              <div className="row-rail">
                <SessionDot
                  progress={tot.progress}
                  doneAll={tot.done === tot.total}
                  overdue={overdue}
                  onClick={() => toggleSession(s.id)}
                  innerRef={(el) => {
                    dotRefs.current[s.id] = el;
                  }}
                />
              </div>

              <div className="cnt">
                <div className="hdr">
                  <div className="rt">{s.time || ""}</div>
                  <div className="st">{s.title}</div>
                </div>
                <div className="grid">
                  {s.items.map((it) => {
                    const Icon = ICONS[it.icon];
                    const doneIt = Boolean(done[s.id]?.[it.id]);
                    const variant: "active" | "overdue" | "done" = doneIt ? "done" : overdue ? "overdue" : "active";
                    return (
                      <Tile
                        key={it.id}
                        title={it.title}
                        Icon={Icon}
                        done={doneIt}
                        variant={variant}
                        onToggle={() => toggleItem(s.id, it.id)}
                        onInfo={() => setOpenExercise(s.id, it.id)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
