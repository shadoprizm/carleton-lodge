import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  Loader2,
  RefreshCw,
  SearchCheck,
  XCircle,
} from "lucide-react";
import { supabase, TrustedKnowledgeSource } from "../../lib/supabase";

const authorityLabel: Record<TrustedKnowledgeSource["authority"], string> = {
  grand_lodge: "Grand Lodge",
  district_1: "Ottawa District 1",
  district_2: "Ottawa District 2",
  lodge: "Individual lodge",
};

const statusStyle: Record<TrustedKnowledgeSource["fetch_status"], string> = {
  pending: "bg-slate-100 text-slate-700",
  refreshing: "bg-blue-100 text-blue-900",
  healthy: "bg-emerald-100 text-emerald-900",
  unchanged: "bg-emerald-100 text-emerald-900",
  error: "bg-red-100 text-red-900",
};

const statusLabel: Record<TrustedKnowledgeSource["fetch_status"], string> = {
  pending: "Waiting for first check",
  refreshing: "Checking now",
  healthy: "Healthy",
  unchanged: "Healthy — no changes",
  error: "Needs attention",
};

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not checked yet";

export const AdminTrustedSourcesPage = () => {
  const [sources, setSources] = useState<TrustedKnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshingId, setRefreshingId] = useState<string | "all" | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    setLoading(true);
    const { data, error: sourceError } = await supabase
      .from("trusted_knowledge_sources")
      .select("*")
      .order("authority")
      .order("name");
    if (sourceError) {
      setError("Trusted sources could not be loaded.");
    } else {
      setSources((data as TrustedKnowledgeSource[] | null) ?? []);
      setError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const summary = useMemo(
    () => ({
      enabled: sources.filter((source) => source.enabled).length,
      healthy: sources.filter((source) =>
        ["healthy", "unchanged"].includes(source.fetch_status),
      ).length,
      pending: sources.filter(
        (source) =>
          source.fetch_status === "pending" ||
          source.fetch_status === "refreshing",
      ).length,
      errors: sources.filter((source) => source.fetch_status === "error")
        .length,
      liveDomains: new Set(
        sources
          .filter((source) => source.enabled && source.allow_live_search)
          .map((source) => source.domain),
      ).size,
    }),
    [sources],
  );

  const metrics = [
    ["Enabled sources", summary.enabled, Globe2],
    ["Healthy", summary.healthy, CheckCircle2],
    ["Waiting", summary.pending, Clock3],
    ["Needs attention", summary.errors, AlertTriangle],
    ["Live-search domains", summary.liveDomains, SearchCheck],
  ] as const;

  const refresh = async (sourceId?: string) => {
    setRefreshingId(sourceId ?? "all");
    setError("");
    setMessage("");
    const sourceIds = sourceId
      ? [sourceId]
      : sources.filter((source) => source.enabled).map((source) => source.id);
    let checked = 0;
    let failed = 0;
    let requestFailed = false;
    for (const id of sourceIds) {
      const { data, error: refreshError } = await supabase.functions.invoke(
        "refresh-trusted-sources",
        {
          body: { source_id: id, force: true, limit: 1 },
        },
      );
      if (refreshError) {
        requestFailed = true;
        continue;
      }
      const result = data as { checked?: number; failed?: number };
      checked += result.checked ?? 0;
      failed += result.failed ?? 0;
    }
    if (requestFailed)
      setError(
        "One or more source checks could not be completed. Please try those sources again.",
      );
    setMessage(
      `Checked ${checked} source${checked === 1 ? "" : "s"}${failed ? `; ${failed} need attention` : ""}.`,
    );
    await loadSources();
    setRefreshingId(null);
  };

  const updateSource = async (
    source: TrustedKnowledgeSource,
    changes:
      | Pick<TrustedKnowledgeSource, "enabled">
      | Pick<TrustedKnowledgeSource, "allow_live_search">,
  ) => {
    setSavingId(source.id);
    setError("");
    setMessage("");
    const { error: updateError } = await supabase
      .from("trusted_knowledge_sources")
      .update(changes)
      .eq("id", source.id);
    if (updateError) {
      setError("That trusted-source setting could not be saved.");
    } else {
      setSources((current) =>
        current.map((item) =>
          item.id === source.id ? { ...item, ...changes } : item,
        ),
      );
      setMessage("Trusted-source settings saved.");
    }
    setSavingId(null);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-900">
            <Globe2 size={22} />
            <span className="text-sm font-bold uppercase tracking-[0.12em]">
              Lodge Guide resources
            </span>
          </div>
          <h2 className="mt-2 font-serif text-3xl text-slate-950">
            Trusted Masonic Sources
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            These are the only external websites Lodge Guide may index or
            search. New domains require deliberate administrator approval.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshingId !== null}
          className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-slate-900 px-5 font-semibold text-amber-300 disabled:opacity-60"
        >
          {refreshingId === "all" ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <RefreshCw size={18} />
          )}{" "}
          Check all sources
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value, Icon]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <Icon size={18} className="text-blue-800" aria-hidden="true" />
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {String(value)}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {String(label)}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
        >
          {message}
        </p>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 animate-spin" /> Loading trusted sources…
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {sources.map((source) => (
            <article
              key={source.id}
              className={`rounded-xl border p-5 ${source.enabled ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-75"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-900">
                      {authorityLabel[source.authority]}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[source.fetch_status]}`}
                    >
                      {statusLabel[source.fetch_status]}
                    </span>
                    {source.source_kind === "calendar_ics" && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-950">
                        Official calendar
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-serif text-xl text-slate-950">
                    {source.name}
                  </h3>
                  <a
                    href={source.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex max-w-full items-center gap-2 break-all text-sm font-semibold text-blue-800 underline underline-offset-4"
                  >
                    <ExternalLink size={15} className="shrink-0" />
                    {source.source_url}
                  </a>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="font-semibold text-slate-500">
                        Last checked
                      </dt>
                      <dd className="mt-1 text-slate-800">
                        {formatDateTime(source.last_checked_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">
                        Last changed
                      </dt>
                      <dd className="mt-1 text-slate-800">
                        {formatDateTime(source.last_changed_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">
                        Check interval
                      </dt>
                      <dd className="mt-1 text-slate-800">
                        Every{" "}
                        {source.refresh_interval_minutes >= 1440
                          ? `${source.refresh_interval_minutes / 1440} day${source.refresh_interval_minutes === 1440 ? "" : "s"}`
                          : `${source.refresh_interval_minutes / 60} hours`}
                      </dd>
                    </div>
                  </dl>
                  {source.last_error && (
                    <p className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">
                      <XCircle size={17} className="mt-0.5 shrink-0" />
                      {source.last_error}
                    </p>
                  )}
                </div>

                <div className="flex min-w-48 flex-col gap-2">
                  <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                    Index source
                    <input
                      type="checkbox"
                      checked={source.enabled}
                      disabled={savingId === source.id}
                      onChange={(event) =>
                        void updateSource(source, {
                          enabled: event.target.checked,
                        })
                      }
                      className="h-5 w-5 accent-blue-900"
                    />
                  </label>
                  <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                    Live-search domain
                    <input
                      type="checkbox"
                      checked={source.allow_live_search}
                      disabled={
                        savingId === source.id ||
                        !source.enabled ||
                        source.source_kind === "calendar_ics"
                      }
                      onChange={(event) =>
                        void updateSource(source, {
                          allow_live_search: event.target.checked,
                        })
                      }
                      className="h-5 w-5 accent-blue-900"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void refresh(source.id)}
                    disabled={!source.enabled || refreshingId !== null}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-800 disabled:opacity-50"
                  >
                    {refreshingId === source.id ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <RefreshCw size={16} />
                    )}{" "}
                    Check now
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
