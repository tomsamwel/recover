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
  clsx: (...v: Array<string | false | null | undefined>) => string;
};

export function GateChecklist({ gatesOpen, setGatesOpen, gateProgress, gates, gateDone, toggleGate, showGateInfo, clsx }: Props) {
  return (
    <div className="pnl gt">
      <button type="button" className="gth" onClick={() => setGatesOpen((v) => !v)} aria-expanded={gatesOpen}>
        <div className="cap">Criteria gates</div>
        <div className="gtr">
          <div className="gpm">
            <span className="numS">
              {gateProgress.done}/{gateProgress.total}
            </span>
            <div className="gpb">
              <motion.div className="gpf" animate={{ width: `${Math.round(gateProgress.pct * 100)}%` }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} />
            </div>
          </div>
          <ChevronDown className={clsx("car", gatesOpen && "carOn")} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {gatesOpen && (
          <motion.div className="gtb" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
            {!gates.length ? (
              <div className="sub">No gates in this week.</div>
            ) : (
              <div className="gtl">
                {gates.map((g) => {
                  const on = Boolean(gateDone[g.id]);
                  return (
                    <div key={g.id} className={clsx("gr", on && "grOn")}>
                      <button type="button" className="gm" onClick={() => toggleGate(g.id)}>
                        <span className={clsx("gc", on && "gcOn")} aria-hidden />
                        <span className="gtx">{g.title}</span>
                      </button>
                      <button type="button" className="ib" onClick={() => showGateInfo(g.id)} aria-label="Gate details" title="Details">
                        <Info className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
