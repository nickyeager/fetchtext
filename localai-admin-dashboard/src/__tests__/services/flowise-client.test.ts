import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlowiseClient } from '@/lib/flowise-client';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('FlowiseClient', () => {
  let flowiseClient: FlowiseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    flowiseClient = new FlowiseClient('http://localhost:3000/api/v1', 'test-api-key');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getChatflows', () => {
    it('should fetch all chatflows from Flowise', async () => {
      const mockChatflows = [
        {
          id: 'chatflow-1',
          name: 'Document Analysis Chatflow',
          deployed: true,
          createdDate: '2024-01-01T00:00:00.000Z',
          updatedDate: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 'chatflow-2',
          name: 'Template Generation Chatflow',
          deployed: false,
          createdDate: '2024-01-01T00:00:00.000Z',
          updatedDate: '2024-01-01T00:00:00.000Z'
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChatflows,
      } as Response);

      const chatflows = await flowiseClient.getChatflows();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/chatflows',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(chatflows).toEqual(mockChatflows);
      expect(chatflows).toHaveLength(2);
      expect(chatflows[0].deployed).toBe(true);
      expect(chatflows[1].deployed).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      } as Response);

      await expect(flowiseClient.getChatflows()).rejects.toThrow('Flowise API Error: Forbidden');
    });
  });

  describe('createChatflow', () => {
    it('should create a new chatflow in Flowise', async () => {
      const chatflowData = {
        name: 'Test Chatflow',
        flowData: {
          nodes: [
            {
              id: 'llm-1',
              type: 'chatOpenAI',
              position: { x: 100, y: 100 },
              data: {
                inputs: {
                  modelName: 'gpt-3.5-turbo',
                  temperature: 0.7
                }
              }
            }
          ],
          edges: []
        },
        deployed: false
      };

      const mockResponse = {
        id: 'new-chatflow-id',
        name: 'Test Chatflow',
        deployed: false,
        createdDate: '2024-01-01T00:00:00.000Z'
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const chatflowId = await flowiseClient.createChatflow(chatflowData);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/chatflows',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(chatflowData),
        })
      );

      expect(chatflowId).toBe('new-chatflow-id');
    });

    it('should validate chatflow data before creation', async () => {
      const invalidChatflowData = {
        name: '', // Empty name should be invalid
        flowData: { nodes: [], edges: [] }
      };

      await expect(
        flowiseClient.createChatflow(invalidChatflowData as any)
      ).rejects.toThrow('Invalid chatflow data: name is required');
    });
  });

  describe('executeChatflow', () => {
    it('should execute a chatflow with question and history', async () => {
      const chatflowId = 'chatflow-123';
      const question = 'Analyze this document and provide a summary';
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'How can I help you?' }
      ];

      const mockResponse = {
        question: question,
        text: 'Based on the document analysis, here is the summary...',
        chatId: 'chat-session-456',
        chatMessageId: 'message-789',
        sourceDocuments: [
          {
            pageContent: 'Document excerpt...',
            metadata: { source: 'document.pdf', page: 1 }
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const response = await flowiseClient.executeChatflow(chatflowId, question, history);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/prediction/${chatflowId}`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            question,
            history,
          }),
        })
      );

      expect(response.text).toBe('Based on the document analysis, here is the summary...');
      expect(response.chatId).toBe('chat-session-456');
      expect(response.sourceDocuments).toHaveLength(1);
    });

    it('should execute chatflow without history', async () => {
      const chatflowId = 'chatflow-123';
      const question = 'Process this document';

      const mockResponse = {
        question: question,
        text: 'Document processed successfully.',
        chatId: 'chat-session-123'
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const response = await flowiseClient.executeChatflow(chatflowId, question);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/prediction/${chatflowId}`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            question,
            history: [],
          }),
        })
      );

      expect(response.text).toBe('Document processed successfully.');
    });
  });

  describe('getChatflowHistory', () => {
    it('should fetch chat history for a specific chatflow', async () => {
      const chatflowId = 'chatflow-123';
      const mockHistory = [
        {
          id: 'msg-1',
          chatflowId: chatflowId,
          role: 'user',
          content: 'Analyze this document',
          createdDate: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 'msg-2',
          chatflowId: chatflowId,
          role: 'assistant',
          content: 'Here is the analysis...',
          createdDate: '2024-01-01T00:01:00.000Z'
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      } as Response);

      const history = await flowiseClient.getChatflowHistory(chatflowId);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/chatmessage/${chatflowId}`,
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(history).toEqual(mockHistory);
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });
  });

  describe('getAvailableNodes', () => {
    it('should fetch available node types from Flowise', async () => {
      const mockNodes = [
        {
          name: 'chatOpenAI',
          label: 'ChatOpenAI',
          description: 'OpenAI Chat Model',
          category: 'Chat Models',
          inputs: [
            { label: 'Model Name', name: 'modelName', type: 'string' },
            { label: 'Temperature', name: 'temperature', type: 'number' }
          ]
        },
        {
          name: 'vectorStoreRetriever',
          label: 'Vector Store Retriever',
          description: 'Retrieve documents from vector store',
          category: 'Retrievers',
          inputs: [
            { label: 'Vector Store', name: 'vectorStore', type: 'VectorStore' },
            { label: 'Search Type', name: 'searchType', type: 'string' }
          ]
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNodes,
      } as Response);

      const nodes = await flowiseClient.getAvailableNodes();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/nodes',
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(nodes).toEqual(mockNodes);
      expect(nodes).toHaveLength(2);
      expect(nodes[0].category).toBe('Chat Models');
      expect(nodes[1].category).toBe('Retrievers');
    });
  });

  describe('getNodeDetails', () => {
    it('should fetch detailed information for a specific node type', async () => {
      const nodeType = 'chatOpenAI';
      const mockNodeDetails = {
        name: 'chatOpenAI',
        label: 'ChatOpenAI',
        description: 'Wrapper around OpenAI large language models',
        category: 'Chat Models',
        inputs: [
          {
            label: 'Model Name',
            name: 'modelName',
            type: 'string',
            default: 'gpt-3.5-turbo',
            options: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
          },
          {
            label: 'Temperature',
            name: 'temperature',
            type: 'number',
            default: 0.7,
            step: 0.1,
            min: 0,
            max: 2
          }
        ],
        outputs: [
          {
            label: 'Chat Model',
            name: 'output',
            type: 'BaseChatModel'
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNodeDetails,
      } as Response);

      const nodeDetails = await flowiseClient.getNodeDetails(nodeType);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/nodes/${nodeType}`,
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(nodeDetails).toEqual(mockNodeDetails);
      expect(nodeDetails.inputs).toHaveLength(2);
      expect(nodeDetails.outputs).toHaveLength(1);
    });
  });

  describe('updateChatflow', () => {
    it('should update an existing chatflow', async () => {
      const chatflowId = 'chatflow-123';
      const updateData = {
        name: 'Updated Chatflow Name',
        flowData: {
          nodes: [
            {
              id: 'llm-1',
              type: 'chatOpenAI',
              position: { x: 100, y: 100 },
              data: {
                inputs: {
                  modelName: 'gpt-4',
                  temperature: 0.5
                }
              }
            }
          ],
          edges: []
        }
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await flowiseClient.updateChatflow(chatflowId, updateData);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/chatflows/${chatflowId}`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(updateData),
        })
      );
    });
  });

  describe('deleteChatflow', () => {
    it('should delete a chatflow', async () => {
      const chatflowId = 'chatflow-123';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await flowiseClient.deleteChatflow(chatflowId);

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/chatflows/${chatflowId}`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should handle deletion of non-existent chatflow', async () => {
      const chatflowId = 'non-existent-chatflow';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Chatflow not found' }),
      } as Response);

      await expect(flowiseClient.deleteChatflow(chatflowId)).rejects.toThrow(
        'Flowise API Error: Chatflow not found'
      );
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network timeout'));

      await expect(flowiseClient.getChatflows()).rejects.toThrow('Network timeout');
    });

    it('should handle invalid JSON responses', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
      } as Response);

      await expect(flowiseClient.getChatflows()).rejects.toThrow('Invalid JSON');
    });

    it('should handle server errors with detailed messages', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ 
          message: 'Internal server error',
          details: 'Database connection failed'
        }),
      } as Response);

      await expect(flowiseClient.getChatflows()).rejects.toThrow('Flowise API Error: Internal server error');
    });
  });

  describe('authentication', () => {
    it('should work without API key for public endpoints', async () => {
      const publicClient = new FlowiseClient('http://localhost:3000/api/v1');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      await publicClient.getChatflows();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/chatflows',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });

    it('should include authorization header when API key is provided', async () => {
      const mockChatflows = [];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChatflows,
      } as Response);

      await flowiseClient.getChatflows();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/chatflows',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
        })
      );
    });
  });
});
