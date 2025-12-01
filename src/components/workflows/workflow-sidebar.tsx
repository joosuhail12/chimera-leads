import { Mail, Clock, GitBranch, FileText } from 'lucide-react';

export function WorkflowSidebar() {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="w-64 border-r bg-slate-50 p-4 flex flex-col gap-4">
            <div className="font-medium text-sm text-slate-500 mb-2">Components</div>

            <div
                className="bg-white p-3 border rounded-lg cursor-move hover:shadow-md transition-shadow flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'email')}
                draggable
            >
                <div className="p-2 bg-blue-100 text-blue-600 rounded">
                    <Mail className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Send Email</span>
            </div>

            <div
                className="bg-white p-3 border rounded-lg cursor-move hover:shadow-md transition-shadow flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'delay')}
                draggable
            >
                <div className="p-2 bg-orange-100 text-orange-600 rounded">
                    <Clock className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Delay</span>
            </div>

            <div
                className="bg-white p-3 border rounded-lg cursor-move hover:shadow-md transition-shadow flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'condition')}
                draggable
            >
                <div className="p-2 bg-purple-100 text-purple-600 rounded">
                    <GitBranch className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Condition</span>
            </div>

            <div
                className="bg-white p-3 border rounded-lg cursor-move hover:shadow-md transition-shadow flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'task')}
                draggable
            >
                <div className="p-2 bg-green-100 text-green-600 rounded">
                    <FileText className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Create Task</span>
            </div>
        </aside>
    );
}
