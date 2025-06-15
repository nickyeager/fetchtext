import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Plus, 
  Globe, 
  Database, 
  MessageSquare, 
  Brain, 
  FileText, 
  Calendar,
  Mail,
  Settings,
  Zap,
  GitBranch,
  Filter,
  Timer,
  Code
} from 'lucide-react';

export interface NodeTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  type: 'trigger' | 'action' | 'condition' | 'transform' | 'output';
  inputs: string[];
  outputs: string[];
  configSchema?: any;
}

// Predefined node templates
const nodeTemplates: NodeTemplate[] = [
  // Triggers
  {
    id: 'webhook-trigger',
    name: 'Webhook Trigger',
    category: 'Triggers',
    description: 'Trigger workflow from HTTP requests',
    icon: <Globe className="w-4 h-4" />,
    color: 'bg-blue-500',
    type: 'trigger',
    inputs: [],
    outputs: ['webhook_data'],
  },
  {
    id: 'schedule-trigger',
    name: 'Schedule Trigger',
    category: 'Triggers',
    description: 'Trigger workflow on a schedule',
    icon: <Timer className="w-4 h-4" />,
    color: 'bg-blue-500',
    type: 'trigger',
    inputs: [],
    outputs: ['trigger_time'],
  },
  {
    id: 'manual-trigger',
    name: 'Manual Trigger',
    category: 'Triggers',
    description: 'Manually trigger workflow',
    icon: <Play className="w-4 h-4" />,
    color: 'bg-blue-500',
    type: 'trigger',
    inputs: [],
    outputs: ['manual_data'],
  },

  // Actions
  {
    id: 'http-request',
    name: 'HTTP Request',
    category: 'HTTP',
    description: 'Make HTTP requests to APIs',
    icon: <Globe className="w-4 h-4" />,
    color: 'bg-green-500',
    type: 'action',
    inputs: ['input'],
    outputs: ['response'],
  },
  {
    id: 'database-query',
    name: 'Database Query',
    category: 'Database',
    description: 'Query PostgreSQL database',
    icon: <Database className="w-4 h-4" />,
    color: 'bg-green-500',
    type: 'action',
    inputs: ['query_params'],
    outputs: ['query_results'],
  },
  {
    id: 'slack-message',
    name: 'Send Slack Message',
    category: 'Communication',
    description: 'Send messages to Slack channels',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'bg-green-500',
    type: 'action',
    inputs: ['message_data'],
    outputs: ['message_result'],
  },
  {
    id: 'email-send',
    name: 'Send Email',
    category: 'Communication',
    description: 'Send email notifications',
    icon: <Mail className="w-4 h-4" />,
    color: 'bg-green-500',
    type: 'action',
    inputs: ['email_data'],
    outputs: ['email_result'],
  },

  // AI/Processing
  {
    id: 'ai-chat',
    name: 'AI Chat',
    category: 'AI',
    description: 'Chat with AI models',
    icon: <Brain className="w-4 h-4" />,
    color: 'bg-purple-500',
    type: 'action',
    inputs: ['prompt'],
    outputs: ['ai_response'],
  },
  {
    id: 'text-processing',
    name: 'Text Processing',
    category: 'Processing',
    description: 'Process and transform text',
    icon: <FileText className="w-4 h-4" />,
    color: 'bg-purple-500',
    type: 'transform',
    inputs: ['text_input'],
    outputs: ['processed_text'],
  },
  {
    id: 'data-transform',
    name: 'Data Transform',
    category: 'Processing',
    description: 'Transform data structures',
    icon: <Code className="w-4 h-4" />,
    color: 'bg-purple-500',
    type: 'transform',
    inputs: ['raw_data'],
    outputs: ['transformed_data'],
  },

  // Conditions
  {
    id: 'condition-check',
    name: 'Condition',
    category: 'Logic',
    description: 'Check conditions and branch workflow',
    icon: <GitBranch className="w-4 h-4" />,
    color: 'bg-yellow-500',
    type: 'condition',
    inputs: ['condition_input'],
    outputs: ['true_path', 'false_path'],
  },
  {
    id: 'filter-data',
    name: 'Filter Data',
    category: 'Logic',
    description: 'Filter data based on criteria',
    icon: <Filter className="w-4 h-4" />,
    color: 'bg-yellow-500',
    type: 'condition',
    inputs: ['data_input'],
    outputs: ['filtered_data'],
  },

  // Outputs
  {
    id: 'webhook-response',
    name: 'Webhook Response',
    category: 'Output',
    description: 'Send response to webhook caller',
    icon: <Zap className="w-4 h-4" />,
    color: 'bg-red-500',
    type: 'output',
    inputs: ['response_data'],
    outputs: [],
  },
  {
    id: 'file-output',
    name: 'File Output',
    category: 'Output',
    description: 'Save data to file',
    icon: <FileText className="w-4 h-4" />,
    color: 'bg-red-500',
    type: 'output',
    inputs: ['file_data'],
    outputs: [],
  },
];

interface NodePaletteProps {
  onNodeSelect?: (template: NodeTemplate) => void;
  onNodeDragStart?: (template: NodeTemplate) => void;
  readonly?: boolean;
}

export function NodePalette({ onNodeSelect, onNodeDragStart, readonly = false }: NodePaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(nodeTemplates.map(node => node.category)))];

  // Filter nodes based on search and category
  const filteredNodes = nodeTemplates.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         node.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || node.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group nodes by category for display
  const groupedNodes = filteredNodes.reduce((acc, node) => {
    if (!acc[node.category]) {
      acc[node.category] = [];
    }
    acc[node.category].push(node);
    return acc;
  }, {} as Record<string, NodeTemplate[]>);

  const handleNodeClick = (template: NodeTemplate) => {
    if (readonly) return;
    onNodeSelect?.(template);
  };

  const handleDragStart = (e: React.DragEvent, template: NodeTemplate) => {
    if (readonly) return;
    e.dataTransfer.setData('application/json', JSON.stringify(template));
    onNodeDragStart?.(template);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Node Palette</CardTitle>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-8"
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-1">
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {Object.keys(groupedNodes).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">No nodes found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedNodes).map(([category, nodes]) => (
                <div key={category}>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {nodes.map(node => (
                      <NodePaletteItem
                        key={node.id}
                        node={node}
                        readonly={readonly}
                        onClick={() => handleNodeClick(node)}
                        onDragStart={(e) => handleDragStart(e, node)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface NodePaletteItemProps {
  node: NodeTemplate;
  readonly: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function NodePaletteItem({ node, readonly, onClick, onDragStart }: NodePaletteItemProps) {
  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
        readonly ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/50'
      }`}
      draggable={!readonly}
      onClick={onClick}
      onDragStart={onDragStart}
    >
      <div className={`w-8 h-8 rounded flex items-center justify-center text-white ${node.color}`}>
        {node.icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h5 className="font-medium text-sm truncate">{node.name}</h5>
          <Badge variant="outline" className="text-xs">
            {node.type}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {node.description}
        </p>
      </div>

      {!readonly && (
        <Button
          variant="ghost"
          size="sm"
          className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <Plus className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

export { nodeTemplates };
