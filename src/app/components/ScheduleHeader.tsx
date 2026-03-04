import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Moon, Sun, Upload } from "lucide-react";
import type { DefaultScheduleEntry, ScheduleAnchor, SchedulePeriod, ScheduleWeek } from "../../domain/schedule";

type Props = {
  dm: boolean;
  setDm: (value: boolean) => void;
  defaultsRef: React.RefObject<HTMLDivElement | null>;
  defaultMenuOpen: boolean;
  setDefaultMenuOpen: (v: boolean | ((cur: boolean) => boolean)) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  defaultSchedules: DefaultScheduleEntry[];
  selectedDefaultId: string;
  applyDefaultSchedule: (id: string) => void;
  defaultState: { loading: boolean; error: string | null };
  todayLabel: string;
  day: number;
  period: SchedulePeriod | null;
  anchor: ScheduleAnchor | undefined;
  anchorLabel: string;
  weeks: ScheduleWeek[];
  selectedWeek: number;
  autoWeek: number;
  setSelectedWeek: (weekNumber: number) => void;
  week: ScheduleWeek;
  clsx: (...v: Array<string | false | null | undefined>) => string;
};

export function ScheduleHeader(props: Props) {
  const {
    dm,
    setDm,
    defaultsRef,
    defaultMenuOpen,
    setDefaultMenuOpen,
    fileRef,
    defaultSchedules,
    selectedDefaultId,
    applyDefaultSchedule,
    defaultState,
    todayLabel,
    day,
    period,
    anchor,
    anchorLabel,
    weeks,
    selectedWeek,
    autoWeek,
    setSelectedWeek,
    week,
    clsx,
  } = props;

  return (
    <>
      <div className="top">
        <div>
          <div className="h1">Timeline</div>
        </div>

        <div className="topr">
          <div className="tb" role="group" aria-label="Theme toggle">
            <motion.button type="button" whileTap={{ scale: 0.98 }} className={clsx("tseg", !dm && "tsegOn")} onClick={() => setDm(false)}>
              <Sun className="ti" />
            </motion.button>
            <motion.button type="button" whileTap={{ scale: 0.98 }} className={clsx("tseg", dm && "tsegOn")} onClick={() => setDm(true)}>
              <Moon className="ti" />
            </motion.button>
          </div>
          <div ref={defaultsRef} className={clsx("upl", defaultMenuOpen && "uplOn")}>
            <motion.button type="button" whileTap={{ scale: 0.98 }} className="uplPart uplMain" onClick={() => fileRef.current?.click()}>
              <Upload className="h-[15px] w-[15px]" />
            </motion.button>
            <div className="uplDiv" aria-hidden />
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              className="uplPart uplChevron"
              onClick={() => setDefaultMenuOpen((v) => !v)}
              aria-expanded={defaultMenuOpen}
            >
              <ChevronDown className={clsx("h-4 w-4", "car", defaultMenuOpen && "carOn")} />
            </motion.button>

            <AnimatePresence>
              {defaultMenuOpen && (
                <motion.div className="uplMenu" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}>
                  {!defaultSchedules.length ? (
                    <div className="uplIt mut">No defaults found</div>
                  ) : (
                    defaultSchedules.map((entry) => {
                      const active = selectedDefaultId === entry.id;
                      return (
                        <button key={entry.id} type="button" className={clsx("uplIt", active && "uplItOn")} onClick={() => applyDefaultSchedule(entry.id)} disabled={defaultState.loading}>
                          <span>{entry.label}</span>
                        </button>
                      );
                    })
                  )}
                  {defaultState.error ? <div className="uplErr">{defaultState.error}</div> : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mut">{todayLabel}</div>
        </div>
      </div>

      <div className="pnl ph">
        <div className="phl">
          <div className="cap">Post-op day</div>
          <div className="num">{day}</div>
          {period ? (
            <>
              <div className="dot" />
              <div className="cap">Phase</div>
              <div className="mut">{period.label}</div>
            </>
          ) : null}
        </div>
        <div className="fnt">
          Anchor: <span className="ak" title={anchor?.at}>{anchorLabel}</span>
          {anchor?.type ? <span className="atk"> · {anchor.type}</span> : null}
        </div>
      </div>

      <div className="weekbar">
        {weeks.map((w) => {
          const active = w.weekNumber === selectedWeek;
          const isAuto = w.weekNumber === autoWeek;
          return (
            <button key={w.weekNumber} type="button" className={clsx("weekpill", active && "weekpill-on")} onClick={() => setSelectedWeek(w.weekNumber)}>
              <span className="weekpill-t">{w.weekNumber}</span>
              {isAuto && <span className="weekpill-dot" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="wk">
        <div className="cap">{week.label ?? `Week ${week.weekNumber}`}</div>
        {week.description ? <div className="sub">{week.description}</div> : null}
      </div>
    </>
  );
}
