import { useJathaData } from "../hooks/useJathaData";
import { ActionMenu } from "../components/ActionMenu";
import { ProspectInfo } from "../components/ProspectInfo";

function JathaRecordPage() {
  const { loading, error, entries, viewEntry, setViewEntry } =
    useJathaData(false);

  return (
    <div className="flex flex-col space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Jatha Record</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your assigned prospects with Nominal List or Visit Select
          &quot;Yes&quot; — with attendance
        </p>
      </header>

      <div className="overflow-visible rounded-lg bg-white p-4 shadow-sm flex flex-col flex-1">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Loading jatha record…
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-600">
              No jatha record entries yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Submit calling forms with &quot;Nominal List Select&quot; or
              &quot;Visit Select&quot; set to &quot;Yes&quot; for your assigned
              prospects to see them here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Name
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Badge ID
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Phone
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Nominal
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Visit
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Attendance
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Date
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map(({ prospect, log }, i) => (
                  <tr
                    key={log.$id || i}
                    className="border-b border-slate-100 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {prospect.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {prospect.badgeId || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {prospect.phoneNumber || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.nominalListSelect || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.visitSelect || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.attendance || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.$createdAt
                        ? new Date(log.$createdAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <ActionMenu
                        onView={() => setViewEntry({ prospect, log })}
                        showEditForm={false}
                        showDeleteProspect={false}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* view call log / prospect modal */}
      {viewEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setViewEntry(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                Calling Form – {viewEntry.prospect.name || "-"}
              </h2>
              <button
                type="button"
                onClick={() => setViewEntry(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
              <ProspectInfo
                prospect={viewEntry.prospect}
                doc={viewEntry.prospect.raw}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                    Calling Data
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">Select: </span>
                    <span className="font-medium">
                      {viewEntry.log.select || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">Call Back: </span>
                    <span className="font-medium">
                      {viewEntry.log.callBack || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">
                      Not Interest:
                    </span>
                    <span className="font-medium">
                      {viewEntry.log.notInterest || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">
                      Department of Sewa:
                    </span>
                    <span className="font-medium">
                      {viewEntry.log.departmentOfSewa || "-"}
                    </span>
                  </p>
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                    Transfer Data
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">
                      Nominal List Select:
                    </span>
                    <span className="font-medium">
                      {viewEntry.log.nominalListSelect || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">
                      Visit Select:
                    </span>
                    <span className="font-medium">
                      {viewEntry.log.visitSelect || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">Free Sewa: </span>
                    <span className="font-medium">
                      {viewEntry.log.freeSewa || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">Attendance: </span>
                    <span className="font-medium">
                      {viewEntry.log.attendance || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">
                      Jatha Record:
                    </span>
                    <span className="font-medium">
                      {viewEntry.log.jathaRecord || "-"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                  Need to Work
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                  {viewEntry.log.needToWork || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JathaRecordPage;
