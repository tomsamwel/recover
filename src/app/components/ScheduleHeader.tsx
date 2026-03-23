import React, { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronDown, FolderOpen, RefreshCcw, Upload } from "lucide-react";
import type { DefaultScheduleEntry, ScheduleAnchor, SchedulePeriod, ScheduleWeek } from "../../domain/schedule";
import { canResetSurgeryDate, formatSurgeryDateLabel, surgeryDateSourceHint, type SurgeryDateSource } from "../surgeryDate";

type Props = {
  defaultsRef: React.RefObject<HTMLDivElement | null>;
  defaultMenuOpen: boolean;
  setDefaultMenuOpen: (v: boolean | ((cur: boolean) => boolean)) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  defaultSchedules: DefaultScheduleEntry[];
  selectedDefaultId: string;
  applyDefaultSchedule: (id: string) => void;
  defaultState: { loading: boolean; error: string | null };
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
};

const clsx = (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ");

export function ScheduleHeader(props: Props) {
  const {
    defaultsRef,
    defaultMenuOpen,
    setDefaultMenuOpen,
    fileRef,
    defaultSchedules,
    selectedDefaultId,
    applyDefaultSchedule,
    defaultState,
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
  } = props;

  const [dateSettingsOpen, setDateSettingsOpen] = useState(false);
  const surgeryDateLabel = formatSurgeryDateLabel(surgeryDateValue);
  const sourceHint = surgeryDateSourceHint(surgeryDateSource);
  const showReset = canResetSurgeryDate(surgeryDateSource);
  const selectedDefaultLabel = defaultSchedules.find((entry) => entry.id === selectedDefaultId)?.label ?? "Load default";

  return (
    <div className="railSections">
      <section className="railSection railSectionStatus" aria-label="Current recovery status">
        <div className="sectionLabel">Current status</div>
        <div className="statusMetricRow">
          <div className="statusMetric">
            <div className="metricValue">{day}</div>
            <div className="metricLabel">Post-op day</div>
          </div>
          <div className="statusMetric">
            <div className="metricValue metricValuePhase">{period?.label ?? "No phase"}</div>
            <div className="metricLabel">Phase</div>
          </div>
        </div>
      </section>

      <section className="railSection" aria-label="Surgery date settings">
        <button
          type="button"
          className="accordionButton"
          onClick={() => setDateSettingsOpen((v) => !v)}
          aria-expanded={dateSettingsOpen}
          aria-controls="surgery-date-settings"
        >
          <div className="accordionCopy">
            <div className="sectionLabel">Surgery date</div>
            <div className="sectionTitle">{surgeryDateLabel}</div>
            <div className="sectionText">{sourceHint}</div>
          </div>
          <span className="accordionIcon" aria-hidden>
            <ChevronDown className={clsx("accordionChevron", dateSettingsOpen && "accordionChevronOpen")} />
          </span>
        </button>

        <div
          id="surgery-date-settings"
          className={clsx("accordionPanel", dateSettingsOpen && "accordionPanelOpen")}
          aria-hidden={!dateSettingsOpen}
        >
          <div className="field">
            <label htmlFor="surgery-date-picker">Select date</label>
            <div className="fieldInputWrap fieldInputWrapIcon">
              <CalendarDays className="fieldLeadingIcon" />
              <input
                id="surgery-date-picker"
                type="date"
                className="fieldInput"
                value={surgeryDateValue}
                onChange={(e) => onSurgeryDateChange(e.target.value)}
              />
            </div>
          </div>

          <div className="inlineMetaRow">
            <span className="sectionText">Schedule anchor: {anchorLabel}</span>
            {anchor?.type ? <span className="sectionText">Type: {anchor.type}</span> : null}
          </div>

          {showReset ? (
            <motion.button type="button" whileTap={{ scale: 0.98 }} className="textAction" onClick={onClearSurgeryDateOverride}>
              <RefreshCcw className="textActionIcon" />
              Use schedule date
            </motion.button>
          ) : null}
        </div>
      </section>

      <section className="railSection" aria-label="Protocol source">
        <div className="sectionLabel">Protocol source</div>
        <div className="sourceActions">
          <motion.button type="button" whileTap={{ scale: 0.98 }} className="actionButton" onClick={() => fileRef.current?.click()}>
            <Upload className="actionButtonIcon" />
            Upload JSON
          </motion.button>

          <div ref={defaultsRef} className="menuWrap">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              className={clsx("actionButton", "actionButtonSecondary", defaultMenuOpen && "actionButtonSecondaryOpen")}
              onClick={() => setDefaultMenuOpen((v) => !v)}
              aria-expanded={defaultMenuOpen}
            >
              <FolderOpen className="actionButtonIcon" />
              <span className="actionButtonText">{selectedDefaultLabel}</span>
              <ChevronDown className={clsx("actionButtonChevron", defaultMenuOpen && "actionButtonChevronOpen")} />
            </motion.button>

            {defaultMenuOpen ? (
              <div className="menuPanel">
                {!defaultSchedules.length ? (
                  <div className="menuEmpty">No defaults found</div>
                ) : (
                  defaultSchedules.map((entry) => {
                    const active = selectedDefaultId === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={clsx("menuItem", active && "menuItemActive")}
                        onClick={() => applyDefaultSchedule(entry.id)}
                        disabled={defaultState.loading}
                      >
                        {entry.label}
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        </div>

        {defaultState.error ? <div className="statusNote statusNoteError">{defaultState.error}</div> : null}
      </section>

      <section className="railSection" aria-label="Week selection">
        <div className="sectionLabel">Week focus</div>
        <div className="weekPicker">
          {weeks.map((w) => {
            const active = w.weekNumber === selectedWeek;
            const isAuto = w.weekNumber === autoWeek;
            return (
              <button
                key={w.weekNumber}
                type="button"
                className={clsx("weekButton", active && "weekButtonActive")}
                onClick={() => setSelectedWeek(w.weekNumber)}
                aria-pressed={active}
              >
                <span>W{w.weekNumber}</span>
                {isAuto ? <span className="weekButtonAuto" aria-hidden /> : null}
              </button>
            );
          })}
        </div>

        <div className="weekSummary">
          <div className="sectionTitle">{week.label ?? `Week ${week.weekNumber}`}</div>
          {week.description ? <div className="sectionText">{week.description}</div> : null}
        </div>
      </section>
    </div>
  );
}
