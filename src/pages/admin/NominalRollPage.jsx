import { useNominalRollData } from "../../hooks/useNominalRollData";
import NominalRollSheet from "../../components/NominalRollSheet";

function NominalRollPage() {
  const { loading, error, entries } = useNominalRollData(true);

  return (
    <div className="flex flex-col space-y-4 p-4">
      <header className="flex flex-col gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Nominal Roll</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sheet format view based on nominal roll sewa jatha template
          </p>
        </div>
      </header>

      <div className="overflow-visible rounded-lg bg-white p-4 shadow-sm flex flex-col flex-1">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Loading nominal roll…
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-600">
              No entries on the nominal list yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              When users submit calling forms with &quot;Nominal List
              Select&quot; set to &quot;Yes&quot;, they will appear here.
            </p>
          </div>
        ) : (
          <NominalRollSheet entries={entries} title="Nominal Roll Sewa Jatha" />
        )}
      </div>
    </div>
  );
}

export default NominalRollPage;
