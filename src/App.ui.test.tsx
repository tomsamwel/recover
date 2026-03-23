// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { SCHEDULE_STORAGE_KEY, SELECTED_WEEK_KEY, THEME_KEY } from "./app/storage/keys";
import type { Schedule } from "./domain/schedule";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

const scheduleFixture: Schedule = {
  version: 1,
  metadata: {
    anchor: { type: "surgeryEnd", at: "2026-03-01T09:00:00+01:00" },
    weekLengthDays: 7,
    periods: [
      { id: "p0", label: "Protection", startDay: 0, endDay: 6 },
      { id: "p1", label: "Build", startDay: 7, endDay: 13 },
    ],
  },
  weeks: [
    {
      weekNumber: 0,
      label: "Week 0 Calm",
      description: "Protection and circulation work.",
      gates: [
        {
          id: "incision",
          title: "Incision calm",
          detail: ["No heat or spreading redness."],
        },
      ],
      sessions: [
        {
          id: "am",
          title: "Morning reset",
          timeOfDay: "08:00",
          exercises: [
            {
              id: "hand-pump",
              name: "Hand pump",
              purpose: "Promote circulation.",
              instructions: "Open and close the hand 20x",
            },
          ],
        },
      ],
    },
    {
      weekNumber: 1,
      label: "Week 1 Build",
      description: "Add gentle mobility and repeatable checks.",
      gates: [
        {
          id: "pain-window",
          title: "Pain settles fast",
          detail: ["Pain returns to baseline within 30 minutes."],
        },
      ],
      sessions: [
        {
          id: "midday",
          title: "Midday mobility",
          timeOfDay: "12:00",
          exercises: [
            {
              id: "scapula",
              name: "Scapula set",
              purpose: "Restore support.",
              instructions: "Hold three seconds for eight reps",
            },
          ],
        },
      ],
    },
  ],
};

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

type RenderedApp = {
  container: HTMLDivElement;
  root: Root;
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function waitFor(assertion: () => void | Promise<void>, timeoutMs = 1500) {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 16));
      });
    }
  }

  throw lastError;
}

function getButtonByText(container: ParentNode, text: string) {
  const match = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.replace(/\s+/g, " ").includes(text));
  if (!match) throw new Error(`Button with text '${text}' not found.`);
  return match as HTMLButtonElement;
}

function queryButtonByLabel(container: ParentNode, label: string) {
  return container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
}

function getControlByLabel(container: ParentNode, labelText: string) {
  const label = Array.from(container.querySelectorAll("label")).find((node) => node.textContent?.includes(labelText));
  if (!label) throw new Error(`Label '${labelText}' not found.`);
  const control = label.querySelector("input, textarea, select");
  if (!control) throw new Error(`Control for label '${labelText}' not found.`);
  return control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function setNativeValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype =
    control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : control instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(control, value);
}

async function changeValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  await act(async () => {
    setNativeValue(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

async function renderApp() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<App />);
  });
  await flush();

  return { container, root } satisfies RenderedApp;
}

async function unmountApp(rendered: RenderedApp) {
  await act(async () => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

beforeEach(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(scheduleFixture));
  localStorage.setItem(SELECTED_WEEK_KEY, "0");
  localStorage.setItem(THEME_KEY, "l");
  window.location.hash = "#/timeline";

  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal(
    "requestAnimationFrame",
    ((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as typeof requestAnimationFrame
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  document.body.innerHTML = "";
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Recover UI", () => {
  it("switches between timeline and editor routes", async () => {
    const rendered = await renderApp();
    try {
      await click(getButtonByText(rendered.container, "Editor"));
      await waitFor(() => {
        expect(window.location.hash).toBe("#/editor");
        expect(rendered.container.textContent).toContain("Protocol editor");
      });

      await click(getButtonByText(rendered.container, "Timeline"));
      await waitFor(() => {
        expect(window.location.hash).toBe("#/timeline");
        expect(rendered.container.textContent).toContain("Session flow");
      });
    } finally {
      await unmountApp(rendered);
    }
  });

  it("persists the selected theme", async () => {
    const rendered = await renderApp();
    try {
      const darkTheme = queryButtonByLabel(rendered.container, "Dark theme");
      expect(darkTheme).not.toBeNull();

      await click(darkTheme!);
      await waitFor(() => {
        expect(localStorage.getItem(THEME_KEY)).toBe("d");
        expect(rendered.container.querySelector(".themeDark")).not.toBeNull();
      });
    } finally {
      await unmountApp(rendered);
    }
  });

  it("updates the active week and persists the selection", async () => {
    const rendered = await renderApp();
    try {
      await click(getButtonByText(rendered.container, "W1"));
      await waitFor(() => {
        expect(rendered.container.textContent).toContain("Week 1 Build");
        expect(localStorage.getItem(SELECTED_WEEK_KEY)).toBe("1");
      });
    } finally {
      await unmountApp(rendered);
    }
  });

  it("expands gates and opens then closes the detail sheet", async () => {
    const rendered = await renderApp();
    try {
      await click(getButtonByText(rendered.container, "Criteria gates"));
      await waitFor(() => {
        expect(rendered.container.textContent).toContain("Incision calm");
      });

      const exerciseDetails = queryButtonByLabel(rendered.container, "Open exercise details for Hand pump");
      expect(exerciseDetails).not.toBeNull();

      await click(exerciseDetails!);
      await waitFor(() => {
        const dialog = rendered.container.querySelector('[role="dialog"]');
        expect(dialog).not.toBeNull();
        expect(dialog?.textContent).toContain("Hand pump");
      });

      const closeButton = queryButtonByLabel(rendered.container, "Close details");
      expect(closeButton).not.toBeNull();
      await click(closeButton!);

      await waitFor(() => {
        expect(rendered.container.querySelector('[role="dialog"]')).toBeNull();
      });
    } finally {
      await unmountApp(rendered);
    }
  });

  it("disables export when the editor becomes invalid", async () => {
    const rendered = await renderApp();
    try {
      await click(getButtonByText(rendered.container, "Editor"));
      await waitFor(() => {
        expect(rendered.container.textContent).toContain("Protocol editor");
      });

      const anchorInput = getControlByLabel(rendered.container, "Anchor datetime") as HTMLInputElement;
      await changeValue(anchorInput, "not-a-date");

      await waitFor(() => {
        const downloadButton = getButtonByText(rendered.container, "Download JSON");
        expect(downloadButton.disabled).toBe(true);
        expect(rendered.container.textContent).toContain("Validation issues");
      });
    } finally {
      await unmountApp(rendered);
    }
  });
});
