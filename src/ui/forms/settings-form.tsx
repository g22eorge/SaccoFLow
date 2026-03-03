"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppSettings,
  SettingsField,
  settingsSections,
} from "@/src/lib/settings";

type SettingsFormProps = {
  initialSettings: AppSettings;
  canEdit: boolean;
};

type ThemePreference = "light" | "dark" | "system";
type EffectiveTheme = "light" | "dark";

const THEME_KEY = "saccoflow-theme";
const THEME_TOKENS: Record<EffectiveTheme, Record<string, string>> = {
  light: {
    "--background": "#f2f5fb",
    "--foreground": "#172033",
    "--surface": "#ffffff",
    "--surface-soft": "#f5f8ff",
    "--border": "#d8dfed",
    "--accent": "#f0c619",
    "--accent-strong": "#d8b110",
    "--ring": "#f0c61966",
    "--muted": "#4f5d78",
    "--muted-soft": "#70819c",
    "--cta-text": "#1a2334",
  },
  dark: {
    "--background": "#131a2a",
    "--foreground": "#eef2fb",
    "--surface": "#1d2738",
    "--surface-soft": "#243042",
    "--border": "#2f3d52",
    "--accent": "#f4cc1f",
    "--accent-strong": "#deba13",
    "--ring": "#f4cc1f66",
    "--muted": "#b7c2d8",
    "--muted-soft": "#95a3bc",
    "--cta-text": "#1a2334",
  },
};

const parseNumber = (value: string) => {
  if (!value.trim()) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const readThemePreference = (): ThemePreference => {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    return "system";
  }
  return "system";
};

const applyThemePreference = (preference: ThemePreference) => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const effectiveTheme =
    preference === "system" ? (prefersDark ? "dark" : "light") : preference;
  const root = document.documentElement;
  const tokens = THEME_TOKENS[effectiveTheme];
  for (const [token, value] of Object.entries(tokens)) {
    root.style.setProperty(token, value);
  }
  root.classList.toggle("dark", effectiveTheme === "dark");
  root.setAttribute("data-theme", effectiveTheme);
  root.style.colorScheme = effectiveTheme;
};

const setThemePreference = (preference: ThemePreference) => {
  try {
    window.localStorage.setItem(THEME_KEY, preference);
  } catch {
    // no-op when storage is unavailable
  }
  applyThemePreference(preference);
};

export function SettingsForm({ initialSettings, canEdit }: SettingsFormProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>("system");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const preference = readThemePreference();
    setThemePreferenceState(preference);
    applyThemePreference(preference);
  }, []);

  const updateField = (
    sectionKey: keyof AppSettings,
    field: SettingsField,
    value: string | boolean,
  ) => {
    setSettings((previous) => {
      const next = structuredClone(previous) as AppSettings;
      const section = next[sectionKey] as Record<string, unknown>;

      if (field.type === "number") {
        section[field.key] = parseNumber(String(value));
      } else if (field.type === "boolean") {
        section[field.key] = Boolean(value);
      } else {
        section[field.key] = String(value);
      }

      return next;
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to save settings");
      }

      setMessage("Settings saved.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unexpected error",
      );
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    sectionKey: keyof AppSettings,
    field: SettingsField,
    currentValue: unknown,
  ) => {
    if (field.type === "boolean") {
      return (
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(currentValue)}
            disabled={!canEdit}
            onChange={(event) =>
              updateField(sectionKey, field, event.currentTarget.checked)
            }
          />
          <span>{field.label}</span>
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <label className="space-y-1 text-sm">
          <span className="block text-slate-600">{field.label}</span>
          <select
            value={String(currentValue)}
            disabled={!canEdit}
            onChange={(event) =>
              updateField(sectionKey, field, event.target.value)
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    const inputType = field.type === "number" ? "number" : field.type;
    return (
      <label className="space-y-1 text-sm">
        <span className="block text-slate-600">{field.label}</span>
        <input
          type={inputType}
          value={String(currentValue)}
          disabled={!canEdit}
          onChange={(event) =>
            updateField(sectionKey, field, event.target.value)
          }
          className="w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose how this browser displays the app.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["light", "dark", "system"] as const).map((option) => {
            const selected = themePreference === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setThemePreferenceState(option);
                  setThemePreference(option);
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-background"
                }`}
              >
                {option === "light"
                  ? "Light"
                  : option === "dark"
                    ? "Dark"
                    : "System"}
              </button>
            );
          })}
        </div>
      </section>

      {settingsSections.map((section) => {
        const sectionData = settings[section.key] as Record<string, unknown>;
        return (
          <section
            key={section.key}
            className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{section.description}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {section.fields.map((field) => (
                <div key={`${section.key}.${field.key}`}>
                  {renderInput(section.key, field, sectionData[field.key])}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <button
          type="submit"
          disabled={!canEdit || loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save All Settings"}
        </button>
        {!canEdit ? (
          <p className="mt-2 text-sm text-slate-600">
            You have read-only access to settings.
          </p>
        ) : null}
        {message ? (
          <p className="mt-2 text-sm text-emerald-700">{message}</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
    </form>
  );
}
