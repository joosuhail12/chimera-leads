import { AutoEnrollmentRules } from '@/components/sequences/auto-enrollment-rules';

export default function AutomationPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Automation Rules</h2>
                    <p className="text-muted-foreground">
                        Configure rules to automatically enroll leads into sequences.
                    </p>
                </div>
            </div>
            <AutoEnrollmentRules />
        </div>
    );
}
