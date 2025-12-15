import { useState, useEffect } from "react";
import { API } from "../api";

export default function EditTrackerModal({ onClose, userId, tracker }) {
  const [interest, setInterest] = useState(tracker?.interest || "sell");
  const [targetDown, setTargetDown] = useState(
    tracker?.targetDown?.toString() || ""
  );
  const [targetUp, setTargetUp] = useState(tracker?.targetUp?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tracker) {
      setInterest(tracker.interest || "sell");
      setTargetDown(tracker.targetDown?.toString() || "");
      setTargetUp(tracker.targetUp?.toString() || "");
      setError("");
    }
  }, [tracker]);

  const save = async () => {
    if (!tracker?._id) return;
    setError("");
    if (!userId) {
      setError("Please configure your settings first");
      return;
    }
    setSaving(true);
    try {
      await API.put(`/track/${tracker._id}?userId=${userId}`, {
        interest,
        targetDown: targetDown ? Number(targetDown) : null,
        targetUp: targetUp ? Number(targetUp) : null,
      });
      onClose();
    } catch (e) {
      console.error(e);
      const errorMessage =
        e.response?.data?.message ||
        "Failed to update tracker. Please try again.";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (!tracker) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-gray-900 text-gray-100 w-full max-w-sm sm:w-96 p-4 sm:p-6 rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-base sm:text-lg font-semibold mb-3">
          Edit Tracker
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-400 text-xs sm:text-sm flex-1">{error}</p>
              <button
                onClick={() => setError("")}
                className="text-red-400 hover:text-red-300 flex-shrink-0"
                aria-label="Close error"
              >
                <svg
                  className="w-4 h-4"
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
          </div>
        )}

        <div className="mb-3">
          <label className="block text-xs sm:text-sm text-gray-400 mb-1">
            Skin Name
          </label>
          <input
            value={tracker.skinName}
            disabled
            className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-sm sm:text-base text-gray-500 cursor-not-allowed"
          />
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
            Skin name cannot be modified
          </p>
        </div>

        <label className="block text-xs sm:text-sm text-gray-300">
          Interest
        </label>
        <select
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          className="w-full mt-1 mb-3 p-2 rounded bg-gray-800 border border-gray-700 text-sm sm:text-base"
        >
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>

        <label className="block text-xs sm:text-sm text-gray-300">
          Target Down (≤)
        </label>
        <input
          value={targetDown}
          onChange={(e) => setTargetDown(e.target.value)}
          type="number"
          className="w-full mt-1 mb-3 p-2 rounded bg-gray-800 border border-gray-700 text-sm sm:text-base"
          placeholder="e.g. 1800"
        />

        <label className="block text-xs sm:text-sm text-gray-300">
          Target Up (≥)
        </label>
        <input
          value={targetUp}
          onChange={(e) => setTargetUp(e.target.value)}
          type="number"
          className="w-full mt-1 mb-4 p-2 rounded bg-gray-800 border border-gray-700 text-sm sm:text-base"
          placeholder="e.g. 2500"
        />

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 sm:py-1 rounded border border-gray-700 text-sm sm:text-base hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 sm:py-1 rounded text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
