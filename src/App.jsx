import { useState, useEffect, useRef } from "react";
import TrackerList from "./components/TrackerList";
import AddTrackerModal from "./components/AddTrackerModal";
import UserSettings from "./components/UserSettings";
import { API } from "./api";

const USER_ID_KEY = "cs2_tracker_user_id";

export default function App() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userId, setUserId] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const trackerListRef = useRef(null);

  useEffect(() => {
    // Load user ID from localStorage
    const storedUserId = localStorage.getItem(USER_ID_KEY);
    if (storedUserId) {
      setUserId(storedUserId);
      // Check if user has webhook configured
      checkUserSetup(storedUserId);
    } else {
      setNeedsSetup(true);
    }
  }, []);

  const checkUserSetup = async (uid) => {
    try {
      const res = await API.get(`/user/${uid}`);
      if (!res.data?.discordWebhook) {
        setNeedsSetup(true);
      }
    } catch (e) {
      // User might not exist yet, show setup
      setNeedsSetup(true);
    }
  };

  const handleUserIdChange = (newUserId) => {
    setUserId(newUserId);
    localStorage.setItem(USER_ID_KEY, newUserId);
    setNeedsSetup(false);
  };

  const handleOpenSettings = () => {
    setSettingsOpen(true);
  };

  const handleLogout = () => {
    if (
      window.confirm(
        "Are you sure you want to logout? You can recover your account later using your Discord webhook."
      )
    ) {
      localStorage.removeItem(USER_ID_KEY);
      setUserId(null);
      setNeedsSetup(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-3 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold">
            CS2 Skin Price Tracker
          </h1>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {userId && (
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-2 rounded-md shadow transition-colors text-sm sm:text-base"
                title="Logout"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
            <button
              onClick={handleOpenSettings}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-md shadow transition-colors"
              title="User Settings"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 inline-block"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            <button
              onClick={() => setOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-md shadow transition-colors text-sm sm:text-base flex-1 sm:flex-initial"
            >
              + Add Tracker
            </button>
          </div>
        </header>

        {needsSetup && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
            <p className="text-yellow-300 text-xs sm:text-sm">
              Please configure your Discord webhook to receive price alerts.
              Click the settings icon above to get started.
            </p>
          </div>
        )}

        <main>
          {userId ? (
            <TrackerList ref={trackerListRef} userId={userId} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">
                Please configure your settings to get started.
              </p>
            </div>
          )}
        </main>
      </div>

      {open && (
        <AddTrackerModal
          onClose={() => setOpen(false)}
          userId={userId}
          onSuccess={() => {
            if (trackerListRef.current) {
              trackerListRef.current.refresh();
            }
          }}
        />
      )}
      {settingsOpen && (
        <UserSettings
          onClose={() => setSettingsOpen(false)}
          userId={userId}
          onUserIdChange={handleUserIdChange}
        />
      )}
    </div>
  );
}
