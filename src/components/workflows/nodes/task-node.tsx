import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FileText } from 'lucide-react';

export const TaskNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className={`px-4 py-2 shadow-md rounded-md bg-white border-2 min-w-[150px] ${selected ? 'border-green-500' : 'border-gray-200'}`}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />

            <div className="flex items-center">
                <div className="rounded-full w-8 h-8 flex items-center justify-center bg-green-100 text-green-600 mr-2">
                    <FileText className="h-4 w-4" />
                </div>
                <div>
                    <div className="text-sm font-bold">Task</div>
                    <div className="text-xs text-gray-500">Manual Action</div>
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
        </div>
    );
});

TaskNode.displayName = 'TaskNode';
