"use client";

import { useState, useEffect } from "react";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  highlightPadding?: number;
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete: () => void;
  storageKey: string;
}

export function OnboardingTour({ steps, onComplete, storageKey }: OnboardingTourProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // Check if tour has been completed
    if (typeof window !== "undefined") {
      const completed = localStorage.getItem(storageKey);
      if (!completed) {
        // Small delay to let the page render
        setTimeout(() => setIsActive(true), 500);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    if (!isActive || currentStep >= steps.length) return;

    const updateTargetPosition = () => {
      const step = steps[currentStep];
      const element = document.querySelector(step.target);

      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    updateTargetPosition();

    // Update position on scroll/resize
    window.addEventListener("scroll", updateTargetPosition, true);
    window.addEventListener("resize", updateTargetPosition);

    return () => {
      window.removeEventListener("scroll", updateTargetPosition, true);
      window.removeEventListener("resize", updateTargetPosition);
    };
  }, [isActive, currentStep, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, "true");
    }
    setIsActive(false);
    onComplete();
  };

  if (!isActive || !targetRect) return null;

  const step = steps[currentStep];
  const placement = step.placement || "bottom";
  const padding = step.highlightPadding || 8;

  // Calculate tooltip position
  const getTooltipPosition = () => {
    const tooltipWidth = 320;
    const tooltipHeight = 200; // Approximate
    const gap = 16;

    let top = 0;
    let left = 0;

    switch (placement) {
      case "bottom":
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case "top":
        top = targetRect.top - tooltipHeight - gap;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case "right":
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + gap;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - gap;
        break;
    }

    // Keep within viewport
    const maxLeft = window.innerWidth - tooltipWidth - 20;
    const maxTop = window.innerHeight - tooltipHeight - 20;

    left = Math.max(20, Math.min(left, maxLeft));
    top = Math.max(20, Math.min(top, maxTop));

    return { top, left };
  };

  const tooltipPosition = getTooltipPosition();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] transition-opacity duration-300"
        style={{ opacity: isActive ? 1 : 0 }}
      />

      {/* Highlight */}
      <div
        className="fixed z-[61] pointer-events-none"
        style={{
          top: targetRect.top - padding,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          boxShadow: "0 0 0 4px rgba(255, 255, 255, 0.8), 0 0 0 9999px rgba(15, 23, 42, 0.6)",
          borderRadius: "8px",
          transition: "all 300ms ease-in-out",
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[62] w-80 rounded-xl bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-100">
              <Sparkles className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="text-xs text-slate-500">
                Step {currentStep + 1} of {steps.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          <p className="text-sm text-slate-700 leading-relaxed">{step.content}</p>
        </div>

        {/* Progress Bar */}
        <div className="px-4 pb-2">
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <button
            onClick={handleSkip}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
            >
              {currentStep < steps.length - 1 ? "Next" : "Get Started"}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Hook to trigger tour restart
export function useOnboardingTour(storageKey: string) {
  const restartTour = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
      window.location.reload();
    }
  };

  return { restartTour };
}
