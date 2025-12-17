import { useState, useEffect, useRef } from "react";
import { API } from "../api";
import { convertUSDToINR } from "../utils/exchangeRate";

const EXTERIORS = [
  "Field-Tested",
  "Minimal Wear",
  "Battle-Scarred",
  "Well-Worn",
  "Factory New",
];

// CS2 Rarity color mapping based on type
const RARITY_COLORS = {
  "Consumer Grade": "#B0C3D9", // Light gray
  "Industrial Grade": "#5E98D9", // Light blue
  "Mil-Spec": "#4B69FF", // Medium blue
  Restricted: "#8847FF", // Purple
  Classified: "#D32CE6", // Pink
  Covert: "#EB4B4B", // Red
  "Exceedingly Rare": "#FFD700", // Gold/Orange
};

// Extract rarity type from asset_description.type
const getRarityColor = (typeString) => {
  if (!typeString) return null;

  const typeLower = typeString.toLowerCase();

  // Check for each rarity type
  if (typeLower.includes("consumer grade"))
    return RARITY_COLORS["Consumer Grade"];
  if (typeLower.includes("industrial grade"))
    return RARITY_COLORS["Industrial Grade"];
  if (typeLower.includes("mil-spec")) return RARITY_COLORS["Mil-Spec"];
  if (typeLower.includes("restricted")) return RARITY_COLORS["Restricted"];
  if (typeLower.includes("classified")) return RARITY_COLORS["Classified"];
  if (typeLower.includes("covert")) return RARITY_COLORS["Covert"];
  if (
    typeLower.includes("exceedingly rare") ||
    typeLower.includes("contraband")
  )
    return RARITY_COLORS["Exceedingly Rare"];

  return null;
};

export default function AddTrackerModal({ onClose, userId, onSuccess }) {
  const [skinName, setSkinName] = useState("");
  const [interest, setInterest] = useState("sell");
  const [targetDown, setTargetDown] = useState("");
  const [targetUp, setTargetUp] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Format price in INR
  const formatPriceINR = (price) => {
    if (price == null) return null;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Search for CS2 skins using backend proxy to Steam Community Market
  const searchSkins = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    try {
      // Use backend API to proxy Steam Community Market search
      const response = await API.get(`/search-skins`, {
        params: {
          query: query.trim(),
          start: 0,
          count: 50,
        },
      });

      const data = response.data;
      if (data.results && data.results.length > 0) {
        // Helper function to get image URL from Steam API response
        const getImageUrl = (item) => {
          // Try asset_description.icon_url first (Steam API format)
          if (item.asset_description?.icon_url) {
            return `https://steamcommunity-a.akamaihd.net/economy/image/${item.asset_description.icon_url}`;
          }
          // Try app_icon as fallback
          if (item.app_icon) {
            return item.app_icon;
          }
          return null;
        };

        // Process results and filter to only include items with recognized exteriors
        const processedResults = data.results
          .map((item) => {
            const name = item.name || "";
            // Extract base name and exterior
            const exteriorMatch = name.match(/\((.+)\)$/);
            const exterior = exteriorMatch ? exteriorMatch[1] : null;
            const baseName = exteriorMatch
              ? name.substring(0, exteriorMatch.index).trim()
              : name;

            // Extract rarity color from asset_description.type
            const rarityColor = getRarityColor(item.asset_description?.type);

            return {
              fullName: name,
              baseName,
              exterior,
              imageUrl: getImageUrl(item),
              rarityColor,
              sellPriceText: item.sell_price_text || null, // Formatted price string like "$438.23"
            };
          })
          .filter((item) => {
            // Only include items that have a recognized exterior
            return (
              item.exterior &&
              EXTERIORS.some((ext) =>
                item.exterior.toLowerCase().includes(ext.toLowerCase())
              )
            );
          });

        // Create maps of base names to their image URLs and rarity colors
        // Create map of full names to their sell price texts (each exterior has different price)
        const baseImageMap = new Map();
        const baseRarityMap = new Map();
        const fullNamePriceMap = new Map(); // Map by full name to get correct price per exterior
        processedResults.forEach((item) => {
          if (item.imageUrl && !baseImageMap.has(item.baseName)) {
            baseImageMap.set(item.baseName, item.imageUrl);
          }
          if (item.rarityColor && !baseRarityMap.has(item.baseName)) {
            baseRarityMap.set(item.baseName, item.rarityColor);
          }
          // Map price by full name (including exterior) so each variant gets correct price
          if (item.sellPriceText && item.fullName) {
            fullNamePriceMap.set(item.fullName, item.sellPriceText);
          }
        });

        // Group by base name to generate all exterior variants
        const baseNames = new Set(
          processedResults.map((item) => item.baseName)
        );
        const variants = [];

        baseNames.forEach((base) => {
          // Add all exterior variants for each base name found
          EXTERIORS.forEach((exterior) => {
            const fullName = `${base} (${exterior})`;
            // Get price from the map using fullName - this ensures each exterior gets its correct price
            const sellPriceText = fullNamePriceMap.get(fullName) || null;
            variants.push({
              fullName,
              baseName: base,
              exterior,
              imageUrl: baseImageMap.get(base) || null,
              rarityColor: baseRarityMap.get(base) || null,
              sellPriceText, // Use the price from the map based on fullName
            });
          });
        });

        // Remove duplicates and sort alphabetically
        const uniqueVariants = Array.from(
          new Map(variants.map((v) => [v.fullName, v])).values()
        ).sort((a, b) => {
          // Sort by base name first, then by exterior order
          if (a.baseName !== b.baseName) {
            return a.baseName.localeCompare(b.baseName);
          }
          const aIndex = EXTERIORS.indexOf(a.exterior);
          const bIndex = EXTERIORS.indexOf(b.exterior);
          return aIndex - bIndex;
        });

        setSearchResults(uniqueVariants);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    } catch (e) {
      console.error("Error searching skins:", e);
      // If endpoint doesn't exist (404), show helpful message
      if (e.response?.status === 404) {
        console.warn(
          "Backend search endpoint not found. Please implement GET /search-skins endpoint."
        );
      }
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchSkins(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Parse USD price from formatted string (e.g., "$438.23" -> 438.23)
  const parseUSDPrice = (priceText) => {
    if (!priceText) return null;
    // Remove $, commas, and whitespace, then parse as float
    const cleaned = priceText.replace(/[$,]/g, "").trim();
    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
  };

  // Convert USD price to INR using cached exchange rate
  const convertPriceToINR = async (usdPriceText) => {
    // Parse the formatted price string (e.g., "$438.23")
    const usdPrice = parseUSDPrice(usdPriceText);

    if (!usdPrice || usdPrice <= 0) {
      setCurrentPrice(null);
      setLoadingPrice(false);
      return;
    }

    setLoadingPrice(true);
    try {
      // Use utility function that caches exchange rate for the day
      const inrPrice = await convertUSDToINR(usdPrice);
      setCurrentPrice(inrPrice);
    } catch (e) {
      console.error("Error converting price to INR:", e);
      setCurrentPrice(null);
    } finally {
      setLoadingPrice(false);
    }
  };

  const handleSelectSkin = (selectedResult) => {
    const fullName = selectedResult.fullName || selectedResult;
    setSkinName(fullName);
    setSearchQuery(fullName);
    setShowDropdown(false);
    setCurrentPrice(null); // Reset price when selecting new skin
    if (error) setError("");

    // Convert price to INR if sell_price_text is available
    if (typeof selectedResult === "object" && selectedResult.sellPriceText) {
      convertPriceToINR(selectedResult.sellPriceText);
    } else {
      console.debug(
        "No sellPriceText available for selected skin:",
        selectedResult
      );
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSkinName(value);
    setSearchQuery(value);
    setShowDropdown(value.length >= 2);
    if (error) setError("");
    // Clear price when input is cleared
    if (!value.trim()) {
      setCurrentPrice(null);
    }
  };

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
        <div className="relative">
          <input
            ref={inputRef}
            value={skinName}
            onChange={handleInputChange}
            onFocus={() => {
              if (searchQuery.length >= 2 && searchResults.length > 0) {
                setShowDropdown(true);
              }
            }}
            className="w-full mt-1 mb-3 p-2 rounded bg-gray-800 border border-gray-700 text-sm sm:text-base"
            placeholder="Search: AK-47 | Redline"
            autoComplete="off"
          />
          {searching && (
            <div className="absolute right-3 top-3">
              <svg
                className="animate-spin h-4 w-4 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          )}
          {showDropdown && searchResults.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
            >
              {searchResults.slice(0, 20).map((result, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectSkin(result)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-gray-100 border-b border-gray-700 last:border-b-0 transition-colors relative"
                  style={{
                    borderLeftWidth: result.rarityColor ? "4px" : "0px",
                    borderLeftColor: result.rarityColor || "transparent",
                  }}
                >
                  <div className="flex items-center gap-3">
                    {result.imageUrl && (
                      <img
                        src={result.imageUrl}
                        alt={result.fullName}
                        className="w-10 h-10 object-contain flex-shrink-0"
                        onError={(e) => {
                          // Hide image if it fails to load
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className="truncate">{result.fullName}</span>
                      {result.exterior && (
                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                          {result.exterior}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDropdown &&
            searchQuery.length >= 2 &&
            !searching &&
            searchResults.length === 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 text-sm text-gray-400"
              >
                No results found. Try a different search term.
              </div>
            )}
        </div>

        {/* Current Price Display */}
        {skinName && (currentPrice !== null || loadingPrice) && (
          <div className="mb-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-gray-400">
                Current Price:
              </span>
              {loadingPrice ? (
                <div className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span className="text-xs sm:text-sm text-gray-400">
                    Loading...
                  </span>
                </div>
              ) : currentPrice !== null ? (
                <span className="text-sm sm:text-base font-semibold text-green-400">
                  {formatPriceINR(currentPrice)}
                </span>
              ) : null}
            </div>
          </div>
        )}

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
