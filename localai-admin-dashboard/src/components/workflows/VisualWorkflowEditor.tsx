import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Copy,
  ZoomIn,
  ZoomOut,
  Download,
  Upload
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

// Simple node interface for the visual editor
interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  data: any;
  inputs: string[];
  outputs: string[];
}

interface WorkflowConnection {
  id: string;
  from: string; // node id
  fromOutput: string;
  to: string; // node id
  toInput: string;
}

interface VisualWorkflowEditorProps {
  workflow?: {
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
  };
  onWorkflowChange?: (workflow: { nodes: WorkflowNode[]; connections: WorkflowConnection[] }) => void;
  readonly?: boolean;
}

export function VisualWorkflowEditor({ 
  workflow = { nodes: [], connections: [] }, 
  onWorkflowChange,
  readonly = false 
}: VisualWorkflowEditorProps) {
  const [nodes, setNodes] = useState<WorkflowNode[]>(workflow.nodes);
  const [connections, setConnections] = useState<WorkflowConnection[]>(workflow.connections);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Node types available in the palette
  const nodeTypes = [
    { type: 'trigger', label: 'Trigger', icon: '🚀', color: 'bg-blue-500' },
    { type: 'action', label: 'Action', icon: '⚡', color: 'bg-green-500' },
    { type: 'condition', label: 'Condition', icon: '❓', color: 'bg-yellow-500' },
    { type: 'transform', label: 'Transform', icon: '🔄', color: 'bg-purple-500' },
    { type: 'output', label: 'Output', icon: '📤', color: 'bg-red-500' },
  ];

  // Update parent when workflow changes
  useEffect(() => {
    if (onWorkflowChange) {
      onWorkflowChange({ nodes, connections });
    }
  }, [nodes, connections, onWorkflowChange]);

  const addNode = useCallback((type: string) => {
    if (readonly) return;

    const nodeType = nodeTypes.find(nt => nt.type === type);
    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type,
      label: nodeType?.label || type,
      position: { 
        x: Math.random() * 300 + 100,
        y: Math.random() * 300 + 100
      },
      data: {},
      inputs: type === 'trigger' ? [] : ['input'],
      outputs: type === 'output' ? [] : ['output'],
    };

    setNodes(prev => [...prev, newNode]);
  }, [readonly, nodeTypes]);

  const deleteNode = useCallback((nodeId: string) => {
    if (readonly) return;

    setNodes(prev => prev.filter(node => node.id !== nodeId));
    setConnections(prev => prev.filter(
      conn => conn.from !== nodeId && conn.to !== nodeId
    ));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [readonly, selectedNode]);

  const duplicateNode = useCallback((nodeId: string) => {
    if (readonly) return;

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const newNode: WorkflowNode = {
      ...node,
      id: `node_${Date.now()}`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50,
      },
    };

    setNodes(prev => [...prev, newNode]);
  }, [readonly, nodes]);

  const handleNodeDrag = useCallback((nodeId: string, position: { x: number; y: number }) => {
    if (readonly) return;

    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, position } : node
    ));
  }, [readonly]);

  const handleNodeClick = useCallback((node: WorkflowNode) => {
    setSelectedNode(node);
  }, []);

  const updateNodeData = useCallback((nodeId: string, data: any) => {
    if (readonly) return;

    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
    ));
  }, [readonly]);

  const handleZoom = (direction: 'in' | 'out') => {
    setZoom(prev => {
      const newZoom = direction === 'in' ? prev * 1.2 : prev / 1.2;
      return Math.max(0.3, Math.min(3, newZoom));
    });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Workflow Editor</h3>
          {readonly && (
            <Badge variant="secondary">Read Only</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleZoom('out')}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetView}>
            {Math.round(zoom * 100)}%
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleZoom('in')}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          
          {!readonly && (
            <>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Node Palette */}
        {!readonly && (
          <div className="w-64 border-r bg-muted/30 p-4">
            <h4 className="font-semibold mb-4">Node Palette</h4>
            <div className="space-y-2">
              {nodeTypes.map((nodeType) => (
                <Button
                  key={nodeType.type}
                  variant="ghost"
                  className="w-full justify-start gap-2"
                  onClick={() => addNode(nodeType.type)}
                >
                  <span className="text-lg">{nodeType.icon}</span>
                  {nodeType.label}
                </Button>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mt-6">
              <h5 className="font-medium mb-2">Quick Actions</h5>
              <div className="space-y-1">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <Plus className="w-4 h-4 mr-2" />
                  Add HTTP Request
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <Plus className="w-4 h-4 mr-2" />
                  Add AI Node
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Database Query
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden bg-grid-pattern">
          <div
            ref={canvasRef}
            className="w-full h-full relative"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: '0 0',
            }}
          >
            {/* Render connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {connections.map((connection) => {
                const fromNode = nodes.find(n => n.id === connection.from);
                const toNode = nodes.find(n => n.id === connection.to);
                if (!fromNode || !toNode) return null;

                const fromX = fromNode.position.x + 120; // node width
                const fromY = fromNode.position.y + 40; // node height / 2
                const toX = toNode.position.x;
                const toY = toNode.position.y + 40;

                return (
                  <line
                    key={connection.id}
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke="#666"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="#666"
                  />
                </marker>
              </defs>
            </svg>

            {/* Render nodes */}
            {nodes.map((node) => (
              <WorkflowNodeComponent
                key={node.id}
                node={node}
                selected={selectedNode?.id === node.id}
                readonly={readonly}
                onDrag={(position) => handleNodeDrag(node.id, position)}
                onClick={() => handleNodeClick(node)}
                onDelete={() => deleteNode(node.id)}
                onDuplicate={() => duplicateNode(node.id)}
                onUpdateData={(data) => updateNodeData(node.id, data)}
              />
            ))}

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">🔗</div>
                  <h3 className="text-xl font-semibold mb-2">Start Building Your Workflow</h3>
                  <p className="text-muted-foreground mb-4">
                    {readonly 
                      ? "This workflow doesn't have any nodes yet."
                      : "Drag nodes from the palette to create your workflow"
                    }
                  </p>
                  {!readonly && (
                    <Button onClick={() => addNode('trigger')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Node
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Properties Panel */}
        {selectedNode && (
          <div className="w-80 border-l bg-background p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">Node Properties</h4>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedNode(null)}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="node-label">Label</Label>
                <Input
                  id="node-label"
                  value={selectedNode.label}
                  onChange={(e) => {
                    if (!readonly) {
                      setNodes(prev => prev.map(node => 
                        node.id === selectedNode.id 
                          ? { ...node, label: e.target.value }
                          : node
                      ));
                      setSelectedNode({ ...selectedNode, label: e.target.value });
                    }
                  }}
                  disabled={readonly}
                />
              </div>

              <div>
                <Label>Type</Label>
                <Badge variant="outline" className="block w-fit mt-1">
                  {selectedNode.type}
                </Badge>
              </div>

              <div>
                <Label>Configuration</Label>
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <pre className="text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedNode.data, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Node-specific configuration would go here */}
              <div className="pt-4 border-t">
                <h5 className="font-medium mb-2">Actions</h5>
                <div className="flex gap-2">
                  {!readonly && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateNode(selectedNode.id)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteNode(selectedNode.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Individual workflow node component
interface WorkflowNodeComponentProps {
  node: WorkflowNode;
  selected: boolean;
  readonly: boolean;
  onDrag: (position: { x: number; y: number }) => void;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdateData: (data: any) => void;
}

function WorkflowNodeComponent({
  node,
  selected,
  readonly,
  onDrag,
  onClick,
  onDelete,
  onDuplicate,
  onUpdateData: _onUpdateData, // Mark as intentionally unused for now
}: WorkflowNodeComponentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'trigger': return 'border-blue-500 bg-blue-50';
      case 'action': return 'border-green-500 bg-green-50';
      case 'condition': return 'border-yellow-500 bg-yellow-50';
      case 'transform': return 'border-purple-500 bg-purple-50';
      case 'output': return 'border-red-500 bg-red-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'trigger': return '🚀';
      case 'action': return '⚡';
      case 'condition': return '❓';
      case 'transform': return '🔄';
      case 'output': return '📤';
      default: return '📄';
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (readonly) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || readonly) return;
    
    onDrag({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`absolute w-32 h-20 rounded-lg border-2 cursor-pointer transition-all ${
        getNodeColor(node.type)
      } ${selected ? 'ring-2 ring-blue-400' : ''} ${
        isDragging ? 'opacity-80' : ''
      }`}
      style={{
        left: node.position.x,
        top: node.position.y,
        cursor: readonly ? 'default' : isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={onClick}
    >
      <div className="p-2 h-full flex flex-col justify-between">
        <div className="flex items-center gap-1">
          <span className="text-sm">{getNodeIcon(node.type)}</span>
          <span className="text-xs font-medium truncate">{node.label}</span>
        </div>
        
        <div className="flex justify-between items-end">
          <div className="flex gap-1">
            {node.inputs.map((input, idx) => (
              <div
                key={idx}
                className="w-2 h-2 rounded-full bg-gray-400"
                title={input}
              />
            ))}
          </div>
          <div className="flex gap-1">
            {node.outputs.map((output, idx) => (
              <div
                key={idx}
                className="w-2 h-2 rounded-full bg-blue-400"
                title={output}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Context menu */}
      {!readonly && selected && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-white border shadow-sm"
            >
              <Settings className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
