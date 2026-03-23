import React, { memo } from "react";
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

export const SessionTimeline = memo(function SessionTimeline({
  containerRef,
  nowY,
  sessions,
  totals,
  isOverdue,
  toggleSession,
  dotRefs,
  ICONS,
  done,
  toggleItem,
  setOpenExercise,
  Tile,
  SessionDot,
}: Props) {
  return (
    <div ref={containerRef} className="timelineCanvas">
      <div className="timelineTrack" aria-hidden />
      <motion.div className="timelineTrackFill" aria-hidden animate={{ height: nowY }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
      <motion.div className="timelineNow" aria-hidden animate={{ top: nowY }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />

      <div className="sessionStack">
        {sessions.map((s, index) => {
          const tot = totals[s.id] ?? { done: 0, total: 0, progress: 0 };
          const overdue = isOverdue(s.id);

          return (
            <motion.section
              key={s.id}
              className="sessionRow"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.24), duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="sessionMarker">
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

              <div className="sessionBody">
                <div className="sessionHeader">
                  <div className="sessionTime">{s.time || "Any time"}</div>
                  <div className="sessionMeta">
                    <h4 className="sessionTitle">{s.title}</h4>
                    <p className="sessionCaption">
                      {tot.done}/{tot.total} complete
                      {overdue ? " · Needs attention" : ""}
                    </p>
                  </div>
                </div>

                <div className="exerciseGrid">
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
            </motion.section>
          );
        })}
      </div>
    </div>
  );
});
