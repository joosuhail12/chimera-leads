/**
 * Testimonial Block Type for Email Builder
 * Customer quotes with author attribution, avatar, and optional rating
 */

import type { TReaderBlock } from "@usewaypoint/email-builder";

export type TestimonialBlockData = {
  props: {
    quote: string;
    authorName: string;
    authorTitle?: string;
    avatarUrl?: string;
    rating?: number; // 0-5
    layout: "centered" | "left" | "card";
  };
  style: {
    padding?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    backgroundColor?: string;
    borderColor?: string;
    borderRadius?: number;
    quoteColor?: string;
    authorColor?: string;
    fontSize?: number;
  };
};

export type TestimonialBlock = TReaderBlock & {
  type: "Testimonial";
  data: TestimonialBlockData;
};

/**
 * Factory function to create a new Testimonial block
 */
export function createTestimonialBlock(): TestimonialBlock {
  return {
    type: "Testimonial",
    data: {
      props: {
        quote: "This product has completely transformed how we work. Highly recommended!",
        authorName: "Jane Doe",
        authorTitle: "CEO, Acme Corp",
        avatarUrl: "",
        rating: 5,
        layout: "centered",
      },
      style: {
        padding: { top: 24, bottom: 24, left: 24, right: 24 },
        backgroundColor: "#F9FAFB",
        borderColor: "#E5E7EB",
        borderRadius: 8,
        quoteColor: "#1F2937",
        authorColor: "#6B7280",
        fontSize: 16,
      },
    },
  };
}

/**
 * Testimonial Block Inspector Component
 */
import React from "react";

type TestimonialInspectorProps = {
  block: TestimonialBlock;
  onChange: (updater: (prev: TestimonialBlock) => TestimonialBlock) => void;
  activeTab: "content" | "style" | "spacing";
};

export function TestimonialInspector({ block, onChange, activeTab }: TestimonialInspectorProps) {
  const { quote, authorName, authorTitle, avatarUrl, rating, layout } = block.data.props;
  const { backgroundColor, borderColor, borderRadius, quoteColor, authorColor, fontSize, padding } = block.data.style;

  if (activeTab === "content") {
    return (
      <div className="space-y-4">
        {/* Layout Style */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Layout Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["centered", "left", "card"] as const).map((layoutType) => (
              <button
                key={layoutType}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    data: {
                      ...prev.data,
                      props: {
                        ...prev.data.props,
                        layout: layoutType,
                      },
                    },
                  }))
                }
                className={`px-3 py-2 text-xs border-2 rounded-md transition-all ${
                  layout === layoutType
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                type="button"
              >
                {layoutType.charAt(0).toUpperCase() + layoutType.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Quote */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quote
          </label>
          <textarea
            value={quote}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  props: {
                    ...prev.data.props,
                    quote: e.target.value,
                  },
                },
              }))
            }
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter testimonial quote..."
          />
        </div>

        {/* Author Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Author Name
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  props: {
                    ...prev.data.props,
                    authorName: e.target.value,
                  },
                },
              }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="e.g., Jane Doe"
          />
        </div>

        {/* Author Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Author Title/Company
          </label>
          <input
            type="text"
            value={authorTitle || ""}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  props: {
                    ...prev.data.props,
                    authorTitle: e.target.value,
                  },
                },
              }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="e.g., CEO, Acme Corp"
          />
        </div>

        {/* Avatar URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Avatar Image URL
          </label>
          <input
            type="url"
            value={avatarUrl || ""}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  props: {
                    ...prev.data.props,
                    avatarUrl: e.target.value,
                  },
                },
              }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="https://example.com/avatar.jpg"
          />
          {avatarUrl && (
            <div className="mt-2">
              <img
                src={avatarUrl}
                alt={authorName}
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Star Rating (optional)
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    data: {
                      ...prev.data,
                      props: {
                        ...prev.data.props,
                        rating: rating === star ? 0 : star,
                      },
                    },
                  }))
                }
                className={`text-2xl transition-all ${
                  rating && star <= rating ? "text-amber-400" : "text-gray-300"
                } hover:scale-110`}
                type="button"
              >
                ★
              </button>
            ))}
            {rating !== undefined && rating > 0 && (
              <button
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    data: {
                      ...prev.data,
                      props: {
                        ...prev.data.props,
                        rating: 0,
                      },
                    },
                  }))
                }
                className="ml-2 text-xs text-gray-500 hover:text-red-600"
                type="button"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "style") {
    return (
      <div className="space-y-4">
        {/* Background Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Background Color
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={backgroundColor || "#F9FAFB"}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    style: {
                      ...prev.data.style,
                      backgroundColor: e.target.value,
                    },
                  },
                }))
              }
              className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
            />
            <input
              type="text"
              value={backgroundColor || "#F9FAFB"}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    style: {
                      ...prev.data.style,
                      backgroundColor: e.target.value,
                    },
                  },
                }))
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
          </div>
        </div>

        {/* Border Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Border Color
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={borderColor || "#E5E7EB"}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    style: {
                      ...prev.data.style,
                      borderColor: e.target.value,
                    },
                  },
                }))
              }
              className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
            />
            <input
              type="text"
              value={borderColor || "#E5E7EB"}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    style: {
                      ...prev.data.style,
                      borderColor: e.target.value,
                    },
                  },
                }))
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
          </div>
        </div>

        {/* Border Radius */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Border Radius: {borderRadius || 8}px
          </label>
          <input
            type="range"
            min="0"
            max="32"
            value={borderRadius || 8}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  style: {
                    ...prev.data.style,
                    borderRadius: parseInt(e.target.value),
                  },
                },
              }))
            }
            className="w-full"
          />
        </div>

        {/* Quote Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quote Text Color
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={quoteColor || "#1F2937"}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    style: {
                      ...prev.data.style,
                      quoteColor: e.target.value,
                    },
                  },
                }))
              }
              className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
            />
            <input
              type="text"
              value={quoteColor || "#1F2937"}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    style: {
                      ...prev.data.style,
                      quoteColor: e.target.value,
                    },
                  },
                }))
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
          </div>
        </div>

        {/* Author Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Author Text Color
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={authorColor || "#6B7280"}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    style: {
                      ...prev.data.style,
                      authorColor: e.target.value,
                    },
                  },
                }))
              }
              className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
            />
            <input
              type="text"
              value={authorColor || "#6B7280"}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    style: {
                      ...prev.data.style,
                      authorColor: e.target.value,
                    },
                  },
                }))
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
          </div>
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Font Size: {fontSize || 16}px
          </label>
          <input
            type="range"
            min="14"
            max="24"
            value={fontSize || 16}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  style: {
                    ...prev.data.style,
                    fontSize: parseInt(e.target.value),
                  },
                },
              }))
            }
            className="w-full"
          />
        </div>
      </div>
    );
  }

  // Spacing tab
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Top: {padding?.top || 24}px
          </label>
          <input
            type="number"
            value={padding?.top || 24}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  style: {
                    ...prev.data.style,
                    padding: {
                      ...prev.data.style.padding,
                      top: parseInt(e.target.value) || 0,
                    },
                  },
                },
              }))
            }
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Bottom: {padding?.bottom || 24}px
          </label>
          <input
            type="number"
            value={padding?.bottom || 24}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  style: {
                    ...prev.data.style,
                    padding: {
                      ...prev.data.style.padding,
                      bottom: parseInt(e.target.value) || 0,
                    },
                  },
                },
              }))
            }
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Left: {padding?.left || 24}px
          </label>
          <input
            type="number"
            value={padding?.left || 24}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  style: {
                    ...prev.data.style,
                    padding: {
                      ...prev.data.style.padding,
                      left: parseInt(e.target.value) || 0,
                    },
                  },
                },
              }))
            }
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Right: {padding?.right || 24}px
          </label>
          <input
            type="number"
            value={padding?.right || 24}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  style: {
                    ...prev.data.style,
                    padding: {
                      ...prev.data.style.padding,
                      right: parseInt(e.target.value) || 0,
                    },
                  },
                },
              }))
            }
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>
    </div>
  );
}
