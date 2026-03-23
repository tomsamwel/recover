import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Info } from "lucide-react";
import type { Gate } from "../../domain/schedule";

type Props = {
  gatesOpen: boolean;
  setGatesOpen: (v: boolean | ((cur: boolean) => boolean)) => void;
  gateProgress: { done: number; total: number; pct: number };
  gates: Gate[];
  gateDone: Record<string, boolean>;
  toggleGate: (id: string) => void;
  showGateInfo: (id: string) => void;
};

const clsx = (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ");

export function GateChecklist({ gatesOpen, setGatesOpen, gateProgress, gates, gateDone, toggleGate, showGateInfo }: Props) {
  return (
    <section className="gatePanel" aria-label="Criteria gates">
      <button type="button" className="gatePanelToggle" onClick={() => setGatesOpen((v) => !v)} aria-expanded={gatesOpen}>
        <div>
          <div className="sectionLabel">Criteria gates</div>
          <h3 className="sectionTitle">Progress only when the checks still hold.</h3>
        </div>

        <div className="gateProgress">
          <span className="gateProgressValue">
            {gateProgress.done}/{gateProgress.total}
          </span>
          <span className="gateProgressBar" aria-hidden>
            <motion.span
              className="gateProgressFill"
              animate={{ width: `${Math.round(gateProgress.pct * 100)}%` }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
          <ChevronDown className={clsx("gateChevron", gatesOpen && "gateChevronOpen")} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {gatesOpen && (
          <motion.div
            className="gateList"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {!gates.length ? (
              <div className="gateEmpty">No gates in this week.</div>
            ) : (
              gates.map((g) => {
                const on = Boolean(gateDone[g.id]);
                return (
                  <div key={g.id} className={clsx("gateRow", on && "gateRowDone")}>
                    <button type="button" className="gateMain" onClick={() => toggleGate(g.id)}>
                      <span className={clsx("gateCheck", on && "gateCheckDone")} aria-hidden />
                      <span className="gateText">{g.title}</span>
                    </button>
                    <button
                      type="button"
                      className="infoButton"
                      onClick={() => showGateInfo(g.id)}
                      aria-label={`Open gate details for ${g.title}`}
                      title="Details"
                    >
                      <Info className="infoButtonIcon" />
                    </button>
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
