import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Moon, RefreshCcw, Sun, Upload } from "lucide-react";
import type { DefaultScheduleEntry, ScheduleAnchor, SchedulePeriod, ScheduleWeek } from "../../domain/schedule";
import { canResetSurgeryDate, formatSurgeryDateLabel, surgeryDateSourceHint, type SurgeryDateSource } from "../surgeryDate";

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
  surgeryDateValue: string;
  onSurgeryDateChange: (value: string) => void;
  onClearSurgeryDateOverride: () => void;
  surgeryDateSource: SurgeryDateSource;
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
    surgeryDateValue,
    onSurgeryDateChange,
    onClearSurgeryDateOverride,
    surgeryDateSource,
    weeks,
    selectedWeek,
    autoWeek,
    setSelectedWeek,
    week,
    clsx,
  } = props;

  const [dateSettingsOpen, setDateSettingsOpen] = useState(false);
  const surgeryDateLabel = formatSurgeryDateLabel(surgeryDateValue);
  const sourceHint = surgeryDateSourceHint(surgeryDateSource);
  const showReset = canResetSurgeryDate(surgeryDateSource);

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
        <div className={clsx("dateAccordion", dateSettingsOpen && "dateAccordionOn")}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.995 }}
            className="dateAccordionHead"
            onClick={() => setDateSettingsOpen((v) => !v)}
            aria-expanded={dateSettingsOpen}
            aria-controls="surgery-date-settings"
          >
            <div className="dateAccLeft">
              <div className="cap">Surgery date</div>
              <div className="dateAccValue">{surgeryDateLabel}</div>
              <div className="dateAccHint">{sourceHint}</div>
            </div>
            <div className="dateAccIcon" aria-hidden>
              <ChevronDown className={clsx("h-4 w-4", "dateAccChevron", dateSettingsOpen && "dateAccChevronOn")} />
            </div>
          </motion.button>
          <div id="surgery-date-settings" className={clsx("datePanelWrap", dateSettingsOpen && "datePanelWrapOn")} aria-hidden={!dateSettingsOpen}>
            <div className="datePanel">
              <div className="dateField">
                <label className="cap" htmlFor="surgery-date-picker">
                  Select date
                </label>
                <input id="surgery-date-picker" type="date" className="dateIn" value={surgeryDateValue} onChange={(e) => onSurgeryDateChange(e.target.value)} />
              </div>
              <div className="dateMetaRow">
                <span className="dateHint">{sourceHint}</span>
                {showReset ? (
                  <motion.button type="button" whileTap={{ scale: 0.98 }} className="dateResetAction" onClick={onClearSurgeryDateOverride}>
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Use schedule date
                  </motion.button>
                ) : null}
              </div>
              <div className="dateAnchor">
                Schedule anchor: <span className="ak" title={anchor?.at}>{anchorLabel}</span>
                {anchor?.type ? <span className="atk"> · {anchor.type}</span> : null}
              </div>
            </div>
          </div>
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
