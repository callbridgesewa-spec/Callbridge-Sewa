import { useVisitDataPage } from "../hooks/useVisitDataPage";
import { ActionMenu } from "../components/ActionMenu";

function VisitDataPage() {
  const { loading, error, entries, viewEntry, setViewEntry } =
    useVisitDataPage(false);

  return (
    <div className="flex flex-col space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Visit Data</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your assigned prospects marked &quot;Yes&quot; for Visit Select in
          submitted calling forms
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
            Loading visit data…
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-600">
              No visit data yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Submit calling forms with &quot;Visit Select&quot; set to
              &quot;Yes&quot; for your assigned prospects to see them here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-left text-sm">
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
                    Address
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
                    key={prospect.id || i}
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
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                      {prospect.address || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.$createdAt
                        ? new Date(log.$createdAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <ActionMenu
                        prospectId={prospect.id || log.$id}
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
    </div>
  );
}

export default VisitDataPage;
