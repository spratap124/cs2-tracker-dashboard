import { useState, useEffect } from "react";
import { API } from "../api";

export default function UserSettings({ onClose, userId, onUserIdChange }) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [recoveryUserId, setRecoveryUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await API.get(`/user/${userId}`);
      if (res.data?.discordWebhook) {
        setWebhookUrl(res.data.discordWebhook);
      }
    } catch (e) {
      console.error("Failed to load user settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const recoverAccount = async () => {
    const userIdInput = recoveryUserId.trim();
    const webhookInput = webhookUrl.trim();

    // Check if either user ID or webhook URL is provided
    if (!userIdInput && !webhookInput) {
      setError("Please provide either a User ID or Discord webhook URL");
      return;
    }

    // If webhook is provided, validate it
    if (webhookInput) {
      if (
        !webhookInput.startsWith("https://discord.com/api/webhooks/") &&
        !webhookInput.startsWith("https://discordapp.com/api/webhooks/")
      ) {
        setError("Invalid Discord webhook URL format");
        return;
      }
    }

    setError("");
    setSaving(true);
    setIsRecovering(true);
    try {
      let recoverRes;

      // Try to recover user by user ID if provided, otherwise by webhook
      if (userIdInput) {
        recoverRes = await API.post("/user/recover", {
          userId: userIdInput,
        });
      } else {
        recoverRes = await API.post("/user/recover", {
          discordWebhook: webhookInput,
        });
      }

      if (recoverRes.data?.userId) {
        const recoveredUserId = recoverRes.data.userId;
        onUserIdChange(recoveredUserId);
        // Close modal after successful recovery - App.jsx will reload trackers
        onClose();
      } else {
        setError("No account found. Create a new account instead.");
      }
    } catch (e) {
      console.error(e);
      if (e.response?.status === 404) {
        setError("No account found. Create a new account instead.");
      } else {
        setError("Failed to recover account. Please try again.");
      }
    } finally {
      setSaving(false);
      setIsRecovering(false);
    }
  };

  const save = async () => {
    if (!webhookUrl.trim()) {
      setError("Discord webhook URL is required");
      return;
    }

    // Basic validation for Discord webhook URL
    if (
      !webhookUrl.startsWith("https://discord.com/api/webhooks/") &&
      !webhookUrl.startsWith("https://discordapp.com/api/webhooks/")
    ) {
      setError("Invalid Discord webhook URL format");
      return;
    }

    setError("");
    setSaving(true);
    try {
      let currentUserId = userId;

      // If no userId, try to recover first, then create if not found
      if (!currentUserId) {
        try {
          // First try to recover existing account
          const recoverRes = await API.post("/user/recover", {
            discordWebhook: webhookUrl.trim(),
          });
          if (recoverRes.data?.userId) {
            currentUserId = recoverRes.data.userId;
            onUserIdChange(currentUserId);
          } else {
            // If recovery fails, create new user
            const createRes = await API.post("/user", {
              discordWebhook: webhookUrl.trim(),
            });
            currentUserId = createRes.data.userId;
            onUserIdChange(currentUserId);
          }
        } catch (recoverError) {
          // If recovery endpoint returns 404, create new user
          if (recoverError.response?.status === 404) {
            const createRes = await API.post("/user", {
              discordWebhook: webhookUrl.trim(),
            });
            currentUserId = createRes.data.userId;
            onUserIdChange(currentUserId);
          } else {
            throw recoverError;
          }
        }
      } else {
        // Update existing user
        await API.put(`/user/${currentUserId}`, {
          discordWebhook: webhookUrl.trim(),
        });
      }
      onClose();
    } catch (e) {
      console.error(e);
      setError("Failed to save webhook. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-gray-900 text-gray-100 w-full max-w-sm sm:w-96 p-4 sm:p-6 rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-base sm:text-lg font-semibold mb-3">
          User Settings
        </h2>

        {loading ? (
          <p className="text-xs sm:text-sm text-gray-400">Loading...</p>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-xs sm:text-sm text-gray-300 mb-2">
                Discord Webhook URL
              </label>
              <input
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  setError("");
                }}
                className="w-full mt-1 mb-2 p-2 rounded bg-gray-800 border border-gray-700 text-sm sm:text-base"
                placeholder="https://discord.com/api/webhooks/..."
                type="url"
              />
              <p className="text-[10px] sm:text-xs text-gray-500">
                This webhook will be used to send price alerts. You only need to
                set this once.
              </p>
              {error && (
                <p className="text-[10px] sm:text-xs text-red-400 mt-2">
                  {error}
                </p>
              )}
            </div>

            {userId && (
              <div className="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
                <p className="text-[10px] sm:text-xs text-gray-400 mb-1">
                  User ID
                </p>
                <p className="text-xs sm:text-sm font-mono text-gray-300 break-all">
                  {userId}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-2">
                  Save this ID or your webhook URL to recover your account
                  later.
                </p>
              </div>
            )}

            {!userId && (
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded">
                <p className="text-[10px] sm:text-xs text-blue-300 mb-2">
                  Lost your account? Enter your User ID or Discord webhook to
                  recover it.
                </p>
                <div className="mb-3">
                  <label className="block text-xs sm:text-sm text-gray-300 mb-1">
                    User ID (optional)
                  </label>
                  <input
                    value={recoveryUserId}
                    onChange={(e) => {
                      setRecoveryUserId(e.target.value);
                      setError("");
                    }}
                    className="w-full mt-1 p-2 rounded bg-gray-800 border border-gray-700 text-sm sm:text-base"
                    placeholder="Enter your User ID"
                    type="text"
                  />
                </div>
                <p className="text-[10px] sm:text-xs text-gray-400 mb-2 text-center">
                  OR
                </p>
                <p className="text-[10px] sm:text-xs text-gray-400 mb-2">
                  Use the Discord webhook URL field above
                </p>
                <button
                  onClick={recoverAccount}
                  disabled={
                    saving || (!webhookUrl.trim() && !recoveryUserId.trim())
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRecovering ? "Recovering..." : "Recover Account"}
                </button>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-2 sm:py-1 rounded border border-gray-700 hover:bg-gray-800 transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 sm:py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
              >
                {saving ? "Saving..." : userId ? "Update" : "Create Account"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
