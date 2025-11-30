/**
 * Callout/Alert Block Type for Email Builder
 * Supports info, success, warning, error, and tip callouts
 */

import type { TReaderBlock } from "@usewaypoint/email-builder";

export type CalloutBlockData = {
  props: {
    text: string;
    calloutType: "info" | "success" | "warning" | "error" | "tip";
    showIcon: boolean;
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
    borderWidth?: number;
    textColor?: string;
    fontSize?: number;
  };
};

export type CalloutBlock = TReaderBlock & {
  type: "Callout";
  data: CalloutBlockData;
};

/**
 * Callout type presets with colors
 */
const CALLOUT_PRESETS: Record<
  CalloutBlockData["props"]["calloutType"],
  { bg: string; border: string; text: string; icon: string }
> = {
  info: {
    bg: "#EFF6FF",
    border: "#3B82F6",
    text: "#1E40AF",
    icon: "ℹ️",
  },
  success: {
    bg: "#F0FDF4",
    border: "#10B981",
    text: "#065F46",
    icon: "✓",
  },
  warning: {
    bg: "#FFFBEB",
    border: "#F59E0B",
    text: "#92400E",
    icon: "⚠",
  },
  error: {
    bg: "#FEF2F2",
    border: "#EF4444",
    text: "#991B1B",
    icon: "✕",
  },
  tip: {
    bg: "#F5F3FF",
    border: "#8B5CF6",
    text: "#5B21B6",
    icon: "💡",
  },
};

/**
 * Factory function to create a new Callout block
 */
export function createCalloutBlock(): CalloutBlock {
  return {
    type: "Callout",
    data: {
      props: {
        text: "This is an important message for your readers.",
        calloutType: "info",
        showIcon: true,
      },
      style: {
        padding: { top: 16, bottom: 16, left: 16, right: 16 },
        backgroundColor: CALLOUT_PRESETS.info.bg,
        borderColor: CALLOUT_PRESETS.info.border,
        borderWidth: 3,
        textColor: CALLOUT_PRESETS.info.text,
        fontSize: 14,
      },
    },
  };
}

/**
 * Callout Block Inspector Component
 */
import React from "react";

type CalloutInspectorProps = {
  block: CalloutBlock;
  onChange: (updater: (prev: CalloutBlock) => CalloutBlock) => void;
  activeTab: "content" | "style" | "spacing";
};

export function CalloutInspector({ block, onChange, activeTab }: CalloutInspectorProps) {
  const { text, calloutType, showIcon } = block.data.props;
  const { backgroundColor, borderColor, borderWidth, textColor, fontSize, padding } = block.data.style;

  const applyPreset = (type: CalloutBlockData["props"]["calloutType"]) => {
    const preset = CALLOUT_PRESETS[type];
    onChange((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        props: {
          ...prev.data.props,
          calloutType: type,
        },
        style: {
          ...prev.data.style,
          backgroundColor: preset.bg,
          borderColor: preset.border,
          textColor: preset.text,
        },
      },
    }));
  };

  if (activeTab === "content") {
    return (
      <div className="space-y-4">
        {/* Callout Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Callout Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["info", "success", "warning", "error", "tip"] as const).map((type) => (
              <button
                key={type}
                onClick={() => applyPreset(type)}
                className={`px-3 py-2 text-sm border-2 rounded-md transition-all ${
                  calloutType === type
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                type="button"
              >
                {CALLOUT_PRESETS[type].icon} {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Show Icon */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Show Icon
          </label>
          <button
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  props: {
                    ...prev.data.props,
                    showIcon: !showIcon,
                  },
                },
              }))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showIcon ? "bg-blue-600" : "bg-gray-300"
            }`}
            type="button"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showIcon ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Callout Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message
          </label>
          <textarea
            value={text}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  props: {
                    ...prev.data.props,
                    text: e.target.value,
                  },
                },
              }))
            }
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter your callout message..."
          />
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
              value={backgroundColor || "#EFF6FF"}
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
              value={backgroundColor || "#EFF6FF"}
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
              value={borderColor || "#3B82F6"}
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
              value={borderColor || "#3B82F6"}
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

        {/* Border Width */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Border Width: {borderWidth || 3}px
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={borderWidth || 3}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  style: {
                    ...prev.data.style,
                    borderWidth: parseInt(e.target.value),
                  },
                },
              }))
            }
            className="w-full"
          />
        </div>

        {/* Text Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Text Color
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={textColor || "#1E40AF"}
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
              className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
            />
            <input
              type="text"
              value={textColor || "#1E40AF"}
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
          </div>
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Font Size: {fontSize || 14}px
          </label>
          <input
            type="range"
            min="12"
            max="20"
            value={fontSize || 14}
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
