import { ABTestDashboard } from '@/components/sequences/ab-test-dashboard';

export default function ABTestsPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">A/B Tests</h2>
                    <p className="text-muted-foreground">
                        Monitor active experiments and declare winners to optimize your sequences.
                    </p>
                </div>
            </div>
            <ABTestDashboard />
        </div>
    );
}
