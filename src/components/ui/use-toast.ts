// Simplified use-toast hook for immediate usage
import { useState, useEffect } from "react"

type ToastProps = {
    title?: string
    description?: string
    variant?: "default" | "destructive"
}

export function useToast() {
    const [toasts, setToasts] = useState<ToastProps[]>([])

    const toast = ({ title, description, variant }: ToastProps) => {
        console.log(`Toast: ${title} - ${description} (${variant})`)
        // In a real app, this would add to a state that renders Toast components
        // For now, we just log it to avoid complex setup without the full context
    }

    return {
        toast,
        toasts,
        dismiss: (id?: string) => { },
    }
}
