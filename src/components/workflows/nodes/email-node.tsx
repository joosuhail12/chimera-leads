import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Mail } from 'lucide-react';

export const EmailNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className={`px-4 py-2 shadow-md rounded-md bg-white border-2 min-w-[150px] ${selected ? 'border-blue-500' : 'border-gray-200'}`}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />

            <div className="flex items-center">
                <div className="rounded-full w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 mr-2">
                    <Mail className="h-4 w-4" />
                </div>
                <div>
                    <div className="text-sm font-bold">{data.label}</div>
                    <div className="text-xs text-gray-500">{data.subject ? 'Has subject' : 'No subject'}</div>
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
        </div>
    );
});

EmailNode.displayName = 'EmailNode';
