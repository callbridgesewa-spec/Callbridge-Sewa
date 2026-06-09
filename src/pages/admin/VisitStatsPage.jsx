import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useJathaData } from "../../hooks/useJathaData";
import {
  computeVisitStats,
  saveVisitStats,
  fetchVisitStats,
} from "../../services/visitStatsService";

function VisitStatsPage() {
  const { entries, loading: entriesLoading } = useJathaData(true);

  // Lookup: badgeId -> { fatherHusband, gender, age } (from live jatha entries)
  const detailsByBadgeId = useMemo(() => {
    const map = new Map();
    entries.forEach(({ prospect }) => {
      const badge = String(prospect?.badgeId || "").trim();
      if (!badge || badge === "-" || map.has(badge)) return;
      map.set(badge, {
        fatherHusband: prospect.fatherHusbandName || prospect.guardian || "-",
        gender: prospect.gender || "-",
        age: prospect.age || "-",
      });
    });
    return map;
  }, [entries]);

  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [statsSuccess, setStatsSuccess] = useState("");
  const [visitStats, setVisitStats] = useState([]);
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    if (statsLoaded) return;
    (async () => {
      setStatsLoading(true);
      setStatsError("");
      try {
        setVisitStats(await fetchVisitStats());
        setStatsLoaded(true);
      } catch (err) {
        setStatsError(err.message || "Failed to load visit stats.");
      } finally {
        setStatsLoading(false);
      }
    })();
  }, [statsLoaded]);

  const handleExport = () => {
    const headers = [
      "SR.", "Badge ID", "Name", "Father's/Husband Name", "Gender", "Age",
      "Bhati Count", "Bhati %", "Beas Count", "Beas %",
      "Other Major Centres Count", "Other Major Centres %", "Total Visits",
    ];
    const rows = visitStats.map((stat, i) => {
      const d = detailsByBadgeId.get(stat.badgeId) || {};
      return [
        i + 1,
        stat.badgeId || "",
        stat.prospectName || "",
        d.fatherHusband || "-",
        d.gender || "-",
        d.age || "-",
        stat.bhatiCount || 0,
        stat.bhatiPercentage || 0,
        stat.beasCount || 0,
        stat.beasPercentage || 0,
        stat.otherCount || 0,
        stat.otherPercentage || 0,
        stat.totalVisits || 0,
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [6, 12, 24, 24, 8, 6, 12, 10, 12, 10, 18, 14, 12].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visit Stats");
    XLSX.writeFile(wb, `visit_stats_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleComputeAndSave = async () => {
    setStatsLoading(true);
    setStatsError("");
    setStatsSuccess("");
    try {
      const computed = computeVisitStats(entries);
      await saveVisitStats(computed);
      setVisitStats(computed);
      setStatsLoaded(true);
      setStatsSuccess(`Stats computed for ${computed.length} badge(s) and saved.`);
    } catch (err) {
      setStatsError(err.message || "Failed to compute or save stats.");
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Visit Stats</h1>
          <p className="mt-1 text-sm text-slate-500">
            Jatha visit counts and percentages per centre, grouped by badge ID
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={statsLoading || visitStats.length === 0}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            Export Excel
          </button>
          <button
            type="button"
            onClick={handleComputeAndSave}
            disabled={statsLoading || entriesLoading || entries.length === 0}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {statsLoading ? "Computing…" : "Recompute & Save"}
          </button>
        </div>
      </header>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        {statsError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {statsError}
          </div>
        )}
        {statsSuccess && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {statsSuccess}
          </div>
        )}

        {statsLoading && !visitStats.length ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading stats…</p>
        ) : visitStats.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-600">No stats saved yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Click &quot;Recompute &amp; Save&quot; to generate stats from the current Jatha Record.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-3 font-semibold text-slate-700">SR.</th>
                  <th className="px-3 py-3 font-semibold text-slate-700">Badge ID</th>
                  <th className="px-3 py-3 font-semibold text-slate-700">Name</th>
                  <th className="px-3 py-3 font-semibold text-slate-700 whitespace-nowrap">
                    Father&apos;s/Husband Name
                  </th>
                  <th className="px-3 py-3 font-semibold text-slate-700">Gender</th>
                  <th className="px-3 py-3 font-semibold text-slate-700">Age</th>
                  <th className="px-3 py-3 text-center font-semibold text-slate-700">Bhati</th>
                  <th className="px-3 py-3 text-center font-semibold text-slate-700">Beas</th>
                  <th className="px-3 py-3 text-center font-semibold text-slate-700 whitespace-nowrap">
                    Other Major Centres
                  </th>
                  <th className="px-3 py-3 text-center font-semibold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {visitStats.map((stat, i) => (
                  <tr
                    key={stat.badgeId}
                    className="border-b border-slate-100 hover:bg-slate-50/50"
                  >
                    <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{stat.badgeId}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">{stat.prospectName}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                      {detailsByBadgeId.get(stat.badgeId)?.fatherHusband || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {detailsByBadgeId.get(stat.badgeId)?.gender || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {detailsByBadgeId.get(stat.badgeId)?.age || "-"}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-700">
                      {stat.bhatiCount > 0 ? (
                        <>
                          {stat.bhatiCount}{" "}
                          <span className="text-slate-400">({stat.bhatiPercentage}%)</span>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-700">
                      {stat.beasCount > 0 ? (
                        <>
                          {stat.beasCount}{" "}
                          <span className="text-slate-400">({stat.beasPercentage}%)</span>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-700">
                      {stat.otherCount > 0 ? (
                        <>
                          {stat.otherCount}{" "}
                          <span className="text-slate-400">({stat.otherPercentage}%)</span>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-slate-800">
                      {stat.totalVisits}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default VisitStatsPage;
