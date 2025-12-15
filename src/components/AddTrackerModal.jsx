import { useState } from "react";
import { API } from "../api";

export default function AddTrackerModal({ onClose, userId, onSuccess }) {
  const [skinName, setSkinName] = useState("");
  const [interest, setInterest] = useState("sell");
  const [targetDown, setTargetDown] = useState("");
  const [targetUp, setTargetUp] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (!skinName.trim()) {
      setError("Skin name is required");
      return;
    }
    if (!userId) {
      setError("Please configure your settings first");
      return;
    }
    setSaving(true);
    try {
      await API.post("/track", {
        userId,
        skinName,
        interest,
        targetDown: targetDown ? Number(targetDown) : null,
        targetUp: targetUp ? Number(targetUp) : null,
      });
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (e) {
      console.error(e);
      const errorMessage =
        e.response?.data?.message || "Failed to add tracker. Please try again.";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-gray-900 text-gray-100 w-full max-w-sm sm:w-96 p-4 sm:p-6 rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-base sm:text-lg font-semibold mb-3">
          Add New Tracker
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

        <label className="block text-xs sm:text-sm text-gray-300">
          Skin Name
        </label>
        <input
          value={skinName}
          onChange={(e) => {
            setSkinName(e.target.value);
            if (error) setError("");
          }}
          className="w-full mt-1 mb-3 p-2 rounded bg-gray-800 border border-gray-700 text-sm sm:text-base"
          placeholder="AK-47 | Redline (Field-Tested)"
        />

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
            className="bg-green-600 hover:bg-green-700 px-4 py-2 sm:py-1 rounded text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
