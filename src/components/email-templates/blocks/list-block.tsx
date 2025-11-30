/**
 * List Block Type for Email Builder
 * Supports bullet lists, numbered lists, checkmarks, and custom icons
 */

import type { TReaderBlock } from "@usewaypoint/email-builder";

export type ListBlockData = {
  props: {
    items: string[];
    listStyle: "bullet" | "number" | "check" | "arrow";
    ordered: boolean;
  };
  style: {
    padding?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    iconColor?: string;
    textColor?: string;
    fontSize?: number;
    itemSpacing?: number;
    textAlign?: "left" | "center" | "right";
  };
};

export type ListBlock = TReaderBlock & {
  type: "List";
  data: ListBlockData;
};

/**
 * Factory function to create a new List block
 */
export function createListBlock(): ListBlock {
  return {
    type: "List",
    data: {
      props: {
        items: ["First item", "Second item", "Third item"],
        listStyle: "check",
        ordered: false,
      },
      style: {
        padding: { top: 16, bottom: 16, left: 24, right: 24 },
        textColor: "#1F2937",
        iconColor: "#10B981",
        fontSize: 16,
        itemSpacing: 8,
        textAlign: "left",
      },
    },
  };
}

/**
 * List Block Inspector Component
 */
import React from "react";

type ListInspectorProps = {
  block: ListBlock;
  onChange: (updater: (prev: ListBlock) => ListBlock) => void;
  activeTab: "content" | "style" | "spacing";
};

export function ListInspector({ block, onChange, activeTab }: ListInspectorProps) {
  const { items, listStyle } = block.data.props;
  const { iconColor, textColor, fontSize, itemSpacing, textAlign, padding } = block.data.style;

  if (activeTab === "content") {
    return (
      <div className="space-y-4">
        {/* List Style */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            List Style
          </label>
          <select
            value={listStyle}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  props: {
                    ...prev.data.props,
                    listStyle: e.target.value as ListBlockData["props"]["listStyle"],
                  },
                },
              }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="bullet">● Bullet</option>
            <option value="number">1. Number</option>
            <option value="check">✓ Checkmark</option>
            <option value="arrow">→ Arrow</option>
          </select>
        </div>

        {/* List Items */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            List Items
          </label>
          {items.map((item: string, index: number) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[index] = e.target.value;
                  onChange((prev) => ({
                    ...prev,
                    data: {
                      ...prev.data,
                      props: {
                        ...prev.data.props,
                        items: newItems,
                      },
                    },
                  }));
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder={`Item ${index + 1}`}
              />
              <button
                onClick={() => {
                  const newItems = items.filter((_: string, i: number) => i !== index);
                  onChange((prev) => ({
                    ...prev,
                    data: {
                      ...prev.data,
                      props: {
                        ...prev.data.props,
                        items: newItems,
                      },
                    },
                  }));
                }}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors text-sm"
                type="button"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  props: {
                    ...prev.data.props,
                    items: [...items, "New item"],
                  },
                },
              }));
            }}
            className="w-full px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
            type="button"
          >
            + Add Item
          </button>
        </div>
      </div>
    );
  }

  if (activeTab === "style") {
    return (
      <div className="space-y-4">
        {/* Text Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Text Color
          </label>
          <input
            type="color"
            value={textColor || "#1F2937"}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  style: {
                    ...prev.data.style,
                    textColor: e.target.value,
                  },
                },
              }))
            }
            className="w-full h-10 border border-gray-300 rounded-md cursor-pointer"
          />
        </div>

        {/* Icon Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Icon/Bullet Color
          </label>
          <input
            type="color"
            value={iconColor || "#10B981"}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  style: {
                    ...prev.data.style,
                    iconColor: e.target.value,
                  },
                },
              }))
            }
            className="w-full h-10 border border-gray-300 rounded-md cursor-pointer"
          />
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Font Size: {fontSize}px
          </label>
          <input
            type="range"
            min="12"
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

        {/* Item Spacing */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Item Spacing: {itemSpacing}px
          </label>
          <input
            type="range"
            min="0"
            max="24"
            value={itemSpacing || 8}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  style: {
                    ...prev.data.style,
                    itemSpacing: parseInt(e.target.value),
                  },
                },
              }))
            }
            className="w-full"
          />
        </div>

        {/* Text Alignment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Alignment
          </label>
          <div className="flex gap-2">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    data: {
                      ...prev.data,
                      style: {
                        ...prev.data.style,
                        textAlign: align,
                      },
                    },
                  }))
                }
                className={`flex-1 px-3 py-2 text-sm border rounded-md transition-colors ${
                  textAlign === align
                    ? "bg-blue-100 border-blue-500 text-blue-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                type="button"
              >
                {align.charAt(0).toUpperCase() + align.slice(1)}
              </button>
            ))}
          </div>
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
            Top: {padding?.top || 16}px
          </label>
          <input
            type="number"
            value={padding?.top || 16}
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
            Bottom: {padding?.bottom || 16}px
          </label>
          <input
            type="number"
            value={padding?.bottom || 16}
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
