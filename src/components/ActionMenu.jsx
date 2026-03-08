export function ActionMenu({
  onView,
  onEdit,
  onDelete,
  showViewForm = true,
  showEditForm = true,
  showDeleteProspect = true,
  isSaving = false,
}) {
  // using an inline flex layout ensures the buttons sit side‑by‑side
  // and don’t wrap or stack, which previously caused the row to spike
  // when space was tight.  Add light borders so the controls feel like
  // a cohesive group without relying on an ellipsis menu.
  const baseBtn =
    "inline-flex items-center px-2 py-1 text-xs font-medium rounded border border-slate-200 focus:outline-none";

  return (
    <div className="action-menu inline-flex items-center gap-2 flex-shrink-0">
      {showViewForm && (
        <button
          type="button"
          onClick={onView}
          className={`${baseBtn} text-slate-700 hover:bg-slate-100`}
        >
          View
        </button>
      )}
      {showEditForm && (
        <button
          type="button"
          onClick={onEdit}
          className={`${baseBtn} text-slate-700 hover:bg-slate-100`}
        >
          Edit
        </button>
      )}
      {showDeleteProspect && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isSaving}
          className={`${baseBtn} text-red-600 hover:bg-red-50 disabled:opacity-50`}
        >
          Delete
        </button>
      )}
    </div>
  );
}
