import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';

export const ConditionNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className={`px-4 py-2 shadow-md rounded-md bg-white border-2 min-w-[150px] ${selected ? 'border-purple-500' : 'border-gray-200'}`}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />

            <div className="flex items-center mb-2">
                <div className="rounded-full w-8 h-8 flex items-center justify-center bg-purple-100 text-purple-600 mr-2">
                    <GitBranch className="h-4 w-4" />
                </div>
                <div>
                    <div className="text-sm font-bold">Condition</div>
                    <div className="text-xs text-gray-500">
                        {data.conditionType || 'If Opened'}
                    </div>
                </div>
            </div>

            <div className="flex justify-between text-xs font-semibold mt-2">
                <div className="text-green-600">Yes</div>
                <div className="text-red-600">No</div>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                id="yes"
                className="w-3 h-3 bg-green-500 left-[30%]"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="no"
                className="w-3 h-3 bg-red-500 left-[70%]"
            />
        </div>
    );
});

ConditionNode.displayName = 'ConditionNode';
