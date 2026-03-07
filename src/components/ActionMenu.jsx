export function ActionMenu({
  prospectId,
  onView,
  onEdit,
  onDelete,
  showViewForm = true,
  showEditForm = true,
  showDeleteProspect = true,
  isSaving = false,
}) {
  return (
    <div className="action-menu flex flex-col gap-2 sm:flex-row sm:gap-2 flex-shrink-0">
      {showViewForm && (
        <button
          type="button"
          onClick={onView}
          className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded whitespace-nowrap"
        >
          View
        </button>
      )}
      {showEditForm && (
        <button
          type="button"
          onClick={onEdit}
          className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded whitespace-nowrap"
        >
          Edit
        </button>
      )}
      {showDeleteProspect && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isSaving}
          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 rounded whitespace-nowrap"
        >
          Delete
        </button>
      )}
    </div>
  );
}
