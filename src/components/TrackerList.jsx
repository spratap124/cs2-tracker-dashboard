import { useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { API } from "../api";
import EditTrackerModal from "./EditTrackerModal";

const APPID = 730;

// Helper function to encode skin name for Steam URL
const encodeSkinName = (skinName) => {
  return encodeURIComponent(skinName);
};

// Helper function to construct Steam market listing URL
const getSteamListingUrl = (skinName) => {
  const encodedName = encodeSkinName(skinName);
  return `https://steamcommunity.com/market/listings/${APPID}/${encodedName}`;
};

// Helper function to get Steam market image URL
// If icon_url is available from API, use it directly
// Otherwise, construct URL using backend endpoint or Steam CDN
const getSteamImageUrl = (skinName, iconUrl) => {
  if (iconUrl) {
    // If we have the icon_url hash, use Steam's CDN directly
    return `https://steamcommunity-a.akamaihd.net/economy/image/${iconUrl}`;
  }
  // If backend provides imageUrl, it will be used in the component
  // Otherwise, you may need a backend endpoint to fetch from listing URL:
  // const listingUrl = getSteamListingUrl(skinName);
  // return `${API.defaults.baseURL}/steam-image?url=${encodeURIComponent(listingUrl)}`;
  return null;
};

const TrackerList = forwardRef(function TrackerList({ userId }, ref) {
  const [trackers, setTrackers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState({});
  const [viewMode, setViewMode] = useState("tile"); // 'tile' or 'list'
  const [sortBy, setSortBy] = useState("date-newest"); // Sort option
  const [editingTracker, setEditingTracker] = useState(null);
  const [trackerToDelete, setTrackerToDelete] = useState(null);

  const load = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await API.get(`/track?userId=${userId}`);
      setTrackers(res.data);

      // Fetch images for trackers that don't have imageUrl
      const imagePromises = res.data
        .filter((t) => !t.imageUrl && !t.iconUrl)
        .map(async (t) => {
          try {
            // Try to fetch image from backend endpoint if available
            // This endpoint should fetch the image from Steam listing URL
            const listingUrl = getSteamListingUrl(t.skinName);
            const imageRes = await API.get(
              `/steam-image?url=${encodeURIComponent(listingUrl)}`
            );
            if (imageRes.data?.imageUrl) {
              return { id: t._id, imageUrl: imageRes.data.imageUrl };
            }
          } catch (e) {
            // Backend endpoint might not exist, that's okay
            console.debug(`Could not fetch image for ${t.skinName}`);
          }
          return null;
        });

      const imageResults = await Promise.all(imagePromises);
      const imageMap = {};
      imageResults.forEach((result) => {
        if (result) {
          imageMap[result.id] = result.imageUrl;
        }
      });
      setImageUrls(imageMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (tracker) => {
    setTrackerToDelete(tracker);
  };

  const handleDeleteConfirm = async () => {
    if (!trackerToDelete?._id) return;
    try {
      await API.delete(`/track/${trackerToDelete._id}?userId=${userId}`);
      setTrackerToDelete(null);
      load();
    } catch (e) {
      console.error(e);
      setTrackerToDelete(null);
      // Could add error state here if needed
    }
  };

  const handleEditClose = () => {
    setEditingTracker(null);
    load(); // Refresh the list after editing
  };

  useEffect(() => {
    load();
  }, [userId]);

  useImperativeHandle(ref, () => ({
    refresh: load,
  }));

  const formatPrice = (price) => {
    if (price == null) return "—";
    return typeof price === "number" ? price.toLocaleString() : price;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getPriceStatus = (lastPrice, targetDown, targetUp) => {
    if (lastPrice == null) return "neutral";
    if (targetDown != null && lastPrice <= targetDown) return "down";
    if (targetUp != null && lastPrice >= targetUp) return "up";
    return "neutral";
  };

  const sortTrackers = (trackersToSort) => {
    const sorted = [...trackersToSort];
    switch (sortBy) {
      case "name-asc":
        return sorted.sort((a, b) =>
          (a.skinName || "").localeCompare(b.skinName || "")
        );
      case "name-desc":
        return sorted.sort((a, b) =>
          (b.skinName || "").localeCompare(a.skinName || "")
        );
      case "price-asc":
        return sorted.sort((a, b) => {
          const priceA = a.lastKnownPrice ?? Infinity;
          const priceB = b.lastKnownPrice ?? Infinity;
          return priceA - priceB;
        });
      case "price-desc":
        return sorted.sort((a, b) => {
          const priceA = a.lastKnownPrice ?? -Infinity;
          const priceB = b.lastKnownPrice ?? -Infinity;
          return priceB - priceA;
        });
      case "date-newest":
        return sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateB - dateA;
        });
      case "date-oldest":
        return sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateA - dateB;
        });
      case "target-down-asc":
        return sorted.sort((a, b) => {
          const targetA = a.targetDown ?? Infinity;
          const targetB = b.targetDown ?? Infinity;
          return targetA - targetB;
        });
      case "target-up-asc":
        return sorted.sort((a, b) => {
          const targetA = a.targetUp ?? Infinity;
          const targetB = b.targetUp ?? Infinity;
          return targetA - targetB;
        });
      default:
        return sorted;
    }
  };

  // calculate the total sell price (only for trackers with interest === "sell")
  // Steam takes 15% fee (5% transaction + 10% game item), so seller receives 85%
  const STEAM_FEE_PERCENTAGE = 0.15; // 15% total fee
  const totalSellPriceGross = trackers
    .filter((t) => t.interest === "sell" && t.lastKnownPrice != null)
    .reduce((acc, t) => acc + (t.lastKnownPrice ?? 0), 0);
  const totalSellPrice = totalSellPriceGross * (1 - STEAM_FEE_PERCENTAGE); // Net after fees

  // calculate the total buy price (only for trackers with interest === "buy")
  const totalBuyPrice = trackers
    .filter((t) => t.interest === "buy" && t.lastKnownPrice != null)
    .reduce((acc, t) => acc + (t.lastKnownPrice ?? 0), 0);

  // render the total sell price
  const renderTotalSellPrice = () => {
    if (totalSellPriceGross === 0) return null;
    return (
      <div className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700">
        <p className="text-xs sm:text-sm text-gray-400 mb-1">
          Total Sell Value (After Steam Fees)
        </p>
        <p className="text-lg sm:text-xl font-bold text-red-400">
          {formatPrice(totalSellPrice)}
        </p>
        <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
          Gross: {formatPrice(totalSellPriceGross)} • Fees:{" "}
          {formatPrice(totalSellPriceGross * STEAM_FEE_PERCENTAGE)}
        </p>
      </div>
    );
  };

  // render the total buy price
  const renderTotalBuyPrice = () => {
    if (totalBuyPrice === 0) return null;
    return (
      <div className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700">
        <p className="text-xs sm:text-sm text-gray-400 mb-1">Total Buy Value</p>
        <p className="text-lg sm:text-xl font-bold text-blue-400">
          {formatPrice(totalBuyPrice)}
        </p>
      </div>
    );
  };

  const sortedTrackers = sortTrackers(trackers);

  const renderTileView = () => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {sortedTrackers.map((t) => {
          const priceStatus = getPriceStatus(
            t.lastKnownPrice,
            t.targetDown,
            t.targetUp
          );
          const imageSrc =
            t.imageUrl ||
            getSteamImageUrl(t.skinName, t.iconUrl) ||
            imageUrls[t._id];

          return (
            <div
              key={t._id}
              className="bg-gray-800 p-3 sm:p-4 rounded-xl shadow-lg border border-gray-700 hover:border-gray-600 transition-all flex flex-col"
            >
              {/* Image */}
              <div className="flex justify-center mb-2 sm:mb-3">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={t.skinName}
                    className="min-w-[120px] min-h-[120px] w-[120px] h-[120px] sm:min-w-[150px] sm:min-h-[150px] sm:w-[150px] sm:h-[150px] object-contain rounded-lg bg-gray-700 p-2 border border-gray-600"
                    onError={(e) => {
                      e.target.style.display = "none";
                      const placeholder = e.target.nextElementSibling;
                      if (placeholder) placeholder.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="min-w-[120px] min-h-[120px] w-[120px] h-[120px] sm:min-w-[150px] sm:min-h-[150px] sm:w-[150px] sm:h-[150px] rounded-lg bg-gray-700 flex items-center justify-center border border-gray-600"
                  style={{ display: imageSrc ? "none" : "flex" }}
                >
                  <span className="text-gray-500 text-xs text-center px-2">
                    No Image
                  </span>
                </div>
              </div>

              {/* Skin Name & Interest */}
              <div className="mb-2 sm:mb-3 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-semibold text-white line-clamp-2">
                    <a
                      href={getSteamListingUrl(t.skinName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-400 transition-colors"
                    >
                      {t.skinName}
                    </a>
                  </h3>
                  {t.interest && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                        t.interest === "sell"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {t.interest === "sell" ? "Sell" : "Buy"}
                    </span>
                  )}
                </div>
                {t.createdAt && (
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    {formatDate(t.createdAt)}
                  </p>
                )}
              </div>

              {/* Price Information */}
              <div className="space-y-2 mb-2 sm:mb-3">
                <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700">
                  <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5">
                    Current
                  </p>
                  <p
                    className={`text-sm sm:text-base font-bold ${
                      (priceStatus === "up" && t.interest === "sell") ||
                      (priceStatus === "down" && t.interest === "buy")
                        ? "text-green-400"
                        : (priceStatus === "up" && t.interest === "buy") ||
                          (priceStatus === "down" && t.interest === "sell")
                        ? "text-red-400"
                        : "text-gray-300"
                    }`}
                  >
                    {formatPrice(t.lastKnownPrice)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700">
                    <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5">
                      Down
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-green-400">
                      ≤ {formatPrice(t.targetDown)}
                    </p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700">
                    <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5">
                      Up
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-yellow-300">
                      ≥ {formatPrice(t.targetUp)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Alert Status & Actions */}
              <div className="flex items-center justify-between mt-auto">
                {(t.downAlertSent || t.upAlertSent) && (
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                    {t.downAlertSent && (
                      <span className="flex items-center gap-1 text-green-400">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                      </span>
                    )}
                    {t.upAlertSent && (
                      <span className="flex items-center gap-1 text-yellow-400">
                        <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                  <button
                    onClick={() => setEditingTracker(t)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center"
                    title="Edit"
                  >
                    <svg
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteClick(t)}
                    className="bg-red-600 hover:bg-red-700 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center"
                    title="Delete"
                  >
                    <svg
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="grid gap-3 sm:gap-4">
        {sortedTrackers.map((t) => {
          const priceStatus = getPriceStatus(
            t.lastKnownPrice,
            t.targetDown,
            t.targetUp
          );
          const imageSrc =
            t.imageUrl ||
            getSteamImageUrl(t.skinName, t.iconUrl) ||
            imageUrls[t._id];

          return (
            <div
              key={t._id}
              className="bg-gray-800 p-3 sm:p-5 rounded-xl shadow-lg border border-gray-700 hover:border-gray-600 transition-all"
            >
              <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                {/* Image */}
                <div className="flex-shrink-0 w-full sm:w-auto flex justify-center sm:justify-start">
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={t.skinName}
                      className="min-w-[100px] min-h-[100px] w-[100px] h-[100px] sm:min-w-[150px] sm:min-h-[150px] sm:w-[150px] sm:h-[150px] object-contain rounded-lg bg-gray-700 p-2 border border-gray-600"
                      onError={(e) => {
                        e.target.style.display = "none";
                        const placeholder = e.target.nextElementSibling;
                        if (placeholder) placeholder.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className="min-w-[100px] min-h-[100px] w-[100px] h-[100px] sm:min-w-[150px] sm:min-h-[150px] sm:w-[150px] sm:h-[150px] rounded-lg bg-gray-700 flex items-center justify-center border border-gray-600"
                    style={{ display: imageSrc ? "none" : "flex" }}
                  >
                    <span className="text-gray-500 text-xs text-center px-2">
                      No Image
                    </span>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-start justify-between gap-2 sm:gap-4 mb-2 sm:mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm sm:text-lg font-semibold text-white break-words">
                          <a
                            href={getSteamListingUrl(t.skinName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-400 transition-colors"
                          >
                            {t.skinName}
                          </a>
                        </h3>
                        {t.interest && (
                          <span
                            className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium flex-shrink-0 ${
                              t.interest === "sell"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            }`}
                          >
                            {t.interest === "sell" ? "Sell" : "Buy"}
                          </span>
                        )}
                      </div>
                      {t.createdAt && (
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          Added {formatDate(t.createdAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditingTracker(t)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center"
                        title="Edit"
                      >
                        <svg
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(t)}
                        className="bg-red-600 hover:bg-red-700 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center"
                        title="Delete"
                      >
                        <svg
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Price Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-2 sm:mb-3">
                    <div className="bg-gray-900/50 rounded-lg p-2 sm:p-3 border border-gray-700">
                      <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1">
                        Current Price
                      </p>
                      <p
                        className={`text-sm sm:text-lg font-bold ${
                          (priceStatus === "up" && t.interest === "sell") ||
                          (priceStatus === "down" && t.interest === "buy")
                            ? "text-green-400"
                            : (priceStatus === "up" && t.interest === "buy") ||
                              (priceStatus === "down" && t.interest === "sell")
                            ? "text-red-400"
                            : "text-gray-300"
                        }`}
                      >
                        {formatPrice(t.lastKnownPrice)}
                      </p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2 sm:p-3 border border-gray-700">
                      <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1">
                        Target Down
                      </p>
                      <p className="text-sm sm:text-lg font-bold text-green-400">
                        ≤ {formatPrice(t.targetDown)}
                      </p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2 sm:p-3 border border-gray-700">
                      <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5 sm:mb-1">
                        Target Up
                      </p>
                      <p className="text-sm sm:text-lg font-bold text-yellow-300">
                        ≥ {formatPrice(t.targetUp)}
                      </p>
                    </div>
                  </div>

                  {/* Alert Status */}
                  {(t.downAlertSent || t.upAlertSent) && (
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
                      <span className="text-gray-500">Alerts:</span>
                      {t.downAlertSent && (
                        <span className="flex items-center gap-1 text-green-400">
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full"></span>
                          <span className="hidden sm:inline">
                            Down alert sent
                          </span>
                          <span className="sm:hidden">Down</span>
                          {t.lastDownAlertPrice != null && (
                            <span className="text-gray-500">
                              @ {formatPrice(t.lastDownAlertPrice)}
                            </span>
                          )}
                        </span>
                      )}
                      {t.upAlertSent && (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full"></span>
                          <span className="hidden sm:inline">
                            Up alert sent
                          </span>
                          <span className="sm:hidden">Up</span>
                          {t.lastUpAlertPrice != null && (
                            <span className="text-gray-500">
                              @ {formatPrice(t.lastUpAlertPrice)}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="mt-3 sm:mt-4">
      {/* View Toggle & Sort */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-3 sm:mb-4 gap-3 sm:gap-4">
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1 border border-gray-700 w-full sm:w-auto justify-center sm:justify-start">
          <button
            onClick={() => setViewMode("tile")}
            className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-initial ${
              viewMode === "tile"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <span className="flex items-center gap-1 sm:gap-1.5 justify-center">
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              <span className="hidden sm:inline">Tile</span>
            </span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-initial ${
              viewMode === "list"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <span className="flex items-center gap-1 sm:gap-1.5 justify-center">
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <span className="hidden sm:inline">List</span>
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs sm:text-sm text-gray-400 flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
              />
            </svg>
            <span className="hidden sm:inline">Sort by:</span>
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1 sm:flex-initial"
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="price-asc">Price (Low to High)</option>
            <option value="price-desc">Price (High to Low)</option>
            <option value="date-newest">Date Added (Newest)</option>
            <option value="date-oldest">Date Added (Oldest)</option>
            <option value="target-down-asc">Target Down (Low to High)</option>
            <option value="target-up-asc">Target Up (Low to High)</option>
          </select>
        </div>
      </div>

      {/* Total Price Summary */}
      {!loading &&
        trackers.length > 0 &&
        (totalBuyPrice > 0 || totalSellPrice > 0) && (
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {renderTotalBuyPrice()}
            {renderTotalSellPrice()}
          </div>
        )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      )}

      {!loading && viewMode === "tile" && renderTileView()}
      {!loading && viewMode === "list" && renderListView()}

      {trackers.length === 0 && !loading && (
        <div className="text-center py-8 sm:py-12">
          <p className="text-gray-400 text-sm sm:text-lg">
            No trackers yet — add one with the button above.
          </p>
        </div>
      )}

      {editingTracker && (
        <EditTrackerModal
          tracker={editingTracker}
          userId={userId}
          onClose={handleEditClose}
        />
      )}

      {trackerToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-gray-900 text-gray-100 w-full max-w-sm sm:w-96 p-4 sm:p-6 rounded-xl shadow-lg">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-base sm:text-lg font-semibold mb-2">
                  Delete Tracker?
                </h2>
                <p className="text-xs sm:text-sm text-gray-400">
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-white">
                    {trackerToDelete.skinName}
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                onClick={() => setTrackerToDelete(null)}
                className="px-3 py-2 sm:py-1.5 rounded border border-gray-700 text-sm sm:text-base hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 sm:py-1.5 rounded text-sm sm:text-base transition-colors flex items-center justify-center gap-2"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default TrackerList;
