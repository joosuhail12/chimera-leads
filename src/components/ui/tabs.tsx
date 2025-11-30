"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type TabsContextType = {
    activeTab: string;
    setActiveTab: (value: string) => void;
};

const TabsContext = createContext<TabsContextType | null>(null);

export function Tabs({
    defaultValue,
    value,
    onValueChange,
    children,
    className = "",
}: {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
    className?: string;
}) {
    const [internalActiveTab, setInternalActiveTab] = useState(defaultValue ?? value ?? "");

    // Support both controlled and uncontrolled modes
    const activeTab = value !== undefined ? value : internalActiveTab;
    const setActiveTab = (newValue: string) => {
        if (onValueChange) {
            onValueChange(newValue);
        }
        if (value === undefined) {
            setInternalActiveTab(newValue);
        }
    };

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
}

export function TabsList({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex border-b border-gray-200 dark:border-gray-800 ${className}`}>
            {children}
        </div>
    );
}

export function TabsTrigger({
    value,
    children,
    className = "",
}: {
    value: string;
    children: ReactNode;
    className?: string;
}) {
    const context = useContext(TabsContext);
    if (!context) throw new Error("TabsTrigger must be used within Tabs");

    const isActive = context.activeTab === value;

    return (
        <button
            onClick={() => context.setActiveTab(value)}
            className={`
        relative px-4 py-2 text-sm font-medium transition-colors
        ${isActive
                    ? "text-sky-600 dark:text-sky-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }
        ${className}
      `}
        >
            {children}
            {isActive && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full bg-sky-600 dark:bg-sky-400" />
            )}
        </button>
    );
}

export function TabsContent({
    value,
    children,
    className = "",
}: {
    value: string;
    children: ReactNode;
    className?: string;
}) {
    const context = useContext(TabsContext);
    if (!context) throw new Error("TabsContent must be used within Tabs");

    if (context.activeTab !== value) return null;

    return <div className={`mt-4 ${className}`}>{children}</div>;
}
