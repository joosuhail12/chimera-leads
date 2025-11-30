import { SuppressionManager } from '@/components/sequences/suppression-manager';

export default function SuppressionsPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Suppressions</h2>
                    <p className="text-muted-foreground">
                        Manage email addresses and domains excluded from sequences.
                    </p>
                </div>
            </div>
            <SuppressionManager />
        </div>
    );
}
