/**
 * Two-Column Block Type for Email Builder
 * Side-by-side layouts with configurable ratios and mobile stacking
 * Note: This extends the Container pattern with child columns
 */

import type { TReaderBlock } from "@usewaypoint/email-builder";

export type TwoColumnBlockData = {
  props: {
    ratio: "50-50" | "60-40" | "40-60" | "70-30";
    gap: number;
    mobileStackOrder: "left-first" | "right-first";
    verticalAlign: "top" | "center" | "bottom";
  };
  style: {
    padding?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    backgroundColor?: string;
  };
};

export type TwoColumnBlock = TReaderBlock & {
  type: "Container"; // Uses Container type with special childrenIds
  data: TwoColumnBlockData & {
    props: TwoColumnBlockData["props"] & {
      childrenIds: string[]; // [leftColumnId, rightColumnId]
      isTwoColumn: true; // Flag to identify as two-column
    };
  };
};

/**
 * Factory function to create a new Two-Column block
 * Creates a Container with two nested Container children
 */
export function createTwoColumnBlock(): {
  rootId: string;
  nodes: Record<string, TReaderBlock>;
} {
  const rootId = `two-col-${Date.now()}`;
  const leftId = `left-col-${Date.now()}`;
  const rightId = `right-col-${Date.now()}-1`;

  return {
    rootId,
    nodes: {
      [rootId]: {
        type: "Container",
        data: {
          props: {
            ratio: "50-50" as const,
            gap: 16,
            mobileStackOrder: "left-first" as const,
            verticalAlign: "top" as const,
            childrenIds: [leftId, rightId],
            isTwoColumn: true,
          },
          style: {
            padding: { top: 16, bottom: 16, left: 16, right: 16 },
            backgroundColor: "#FFFFFF",
          },
        },
      },
      [leftId]: {
        type: "Container",
        data: {
          props: {
            childrenIds: [],
            isColumn: true,
            columnSide: "left",
          },
          style: {
            padding: { top: 8, bottom: 8, left: 8, right: 8 },
            backgroundColor: "#F3F4F6",
            borderRadius: 4,
          },
        },
      },
      [rightId]: {
        type: "Container",
        data: {
          props: {
            childrenIds: [],
            isColumn: true,
            columnSide: "right",
          },
          style: {
            padding: { top: 8, bottom: 8, left: 8, right: 8 },
            backgroundColor: "#F3F4F6",
            borderRadius: 4,
          },
        },
      },
    },
  };
}

/**
 * Two-Column Block Inspector Component
 */
import React from "react";

type TwoColumnInspectorProps = {
  block: TwoColumnBlock;
  onChange: (updater: (prev: TwoColumnBlock) => TwoColumnBlock) => void;
  activeTab: "content" | "style" | "spacing";
};

export function TwoColumnInspector({ block, onChange, activeTab }: TwoColumnInspectorProps) {
  const { ratio, gap, mobileStackOrder, verticalAlign } = block.data.props;
  const { backgroundColor, padding } = block.data.style;

  const ratioOptions = [
    { value: "50-50", label: "50% / 50%", icon: "▐▌" },
    { value: "60-40", label: "60% / 40%", icon: "▐▍" },
    { value: "40-60", label: "40% / 60%", icon: "▍▌" },
    { value: "70-30", label: "70% / 30%", icon: "▐▎" },
  ] as const;

  if (activeTab === "content") {
    return (
      <div className="space-y-4">
        {/* Column Ratio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Column Ratio
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ratioOptions.map((option) => (
              <button
                key={option.value}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    data: {
                      ...prev.data,
                      props: {
                        ...prev.data.props,
                        ratio: option.value,
                      },
                    },
                  }))
                }
                className={`px-3 py-2 text-sm border-2 rounded-md transition-all ${
                  ratio === option.value
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                type="button"
              >
                <div className="text-lg mb-1">{option.icon}</div>
                <div className="text-xs">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Column Gap */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Column Gap: {gap}px
          </label>
          <input
            type="range"
            min="0"
            max="48"
            step="4"
            value={gap}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  props: {
                    ...prev.data.props,
                    gap: parseInt(e.target.value),
                  },
                },
              }))
            }
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>No gap</span>
            <span>Large gap</span>
          </div>
        </div>

        {/* Vertical Alignment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vertical Alignment
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["top", "center", "bottom"] as const).map((align) => (
              <button
                key={align}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    data: {
                      ...prev.data,
                      props: {
                        ...prev.data.props,
                        verticalAlign: align,
                      },
                    },
                  }))
                }
                className={`px-3 py-2 text-xs border-2 rounded-md transition-all ${
                  verticalAlign === align
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                type="button"
              >
                {align === "top" && "⬆"}
                {align === "center" && "↔"}
                {align === "bottom" && "⬇"}
                <div>{align.charAt(0).toUpperCase() + align.slice(1)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Stack Order */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Stack Order
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() =>
                onChange((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    props: {
                      ...prev.data.props,
                      mobileStackOrder: "left-first",
                    },
                  },
                }))
              }
              className={`px-3 py-2 text-sm border-2 rounded-md transition-all ${
                mobileStackOrder === "left-first"
                  ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
              type="button"
            >
              <div className="text-lg mb-1">⬆️</div>
              <div className="text-xs">Left First</div>
            </button>
            <button
              onClick={() =>
                onChange((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    props: {
                      ...prev.data.props,
                      mobileStackOrder: "right-first",
                    },
                  },
                }))
              }
              className={`px-3 py-2 text-sm border-2 rounded-md transition-all ${
                mobileStackOrder === "right-first"
                  ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
              type="button"
            >
              <div className="text-lg mb-1">⬇️</div>
              <div className="text-xs">Right First</div>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            On mobile devices, columns stack vertically. Choose which column appears first.
          </p>
        </div>

        {/* Info Box */}
        <div className="rounded-md bg-blue-50 p-3">
          <p className="text-xs text-blue-800">
            <strong>Tip:</strong> Add blocks to each column by selecting them in the Layers panel.
            The two-column layout will automatically arrange them side-by-side.
          </p>
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
              value={backgroundColor || "#FFFFFF"}
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
              value={backgroundColor || "#FFFFFF"}
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

        {/* Info */}
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs text-gray-600">
            To style individual columns, select them from the Layers panel. Each column can have
            its own background color, padding, and border styling.
          </p>
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
            Left: {padding?.left || 16}px
          </label>
          <input
            type="number"
            value={padding?.left || 16}
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
            Right: {padding?.right || 16}px
          </label>
          <input
            type="number"
            value={padding?.right || 16}
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
