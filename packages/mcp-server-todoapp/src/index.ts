#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

// インメモリデータストア
interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const todos: Todo[] = [];
let nextTodoId = 1;

// trpc の初期化
interface Context {
  auth?: {
    userId?: string;
  };
}

const t = initTRPC.context<Context>().create();
const router = t.router;
const publicProcedure = t.procedure;

// 入力スキーマの定義
const createTodoSchema = z.string();
const updateTodoSchema = z.object({
  id: z.number(),
  completed: z.boolean(),
});
const deleteTodoSchema = z.number();

// trpc ルーター定義
const todoRouter = router({
  createTodo: publicProcedure
    .input(createTodoSchema)
    .mutation(({ input }) => {
      const todo: Todo = {
        id: nextTodoId++,
        text: input,
        completed: false,
      };
      todos.push(todo);
      return todo;
    }),
  listTodos: publicProcedure.query(() => {
    return todos;
  }),
  updateTodo: publicProcedure
    .input(updateTodoSchema)
    .mutation(({ input }) => {
      const todo = todos.find((t) => t.id === input.id);
      if (!todo) {
        throw new Error(`Todo with id ${input.id} not found`);
      }
      todo.completed = input.completed;
      return todo;
    }),
  deleteTodo: publicProcedure
    .input(deleteTodoSchema)
    .mutation(({ input }) => {
      const index = todos.findIndex((t) => t.id === input);
      if (index === -1) {
        throw new Error(`Todo with id ${input} not found`);
      }
      todos.splice(index, 1);
      return { success: true };
    }),
});

// MCP サーバーの初期化
const server = new Server(
  {
    name: 'TodoApp MCP Server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ListToolsRequestSchema のハンドラー
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_todo',
        description: 'Create a new todo item',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Todo item text' },
          },
          required: ['text'],
        },
      },
      {
        name: 'list_todos',
        description: 'List all todo items',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'update_todo',
        description: 'Update a todo item (e.g., mark as complete)',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Todo item ID' },
            completed: { type: 'boolean', description: 'Completion status' },
          },
          required: ['id', 'completed'],
        },
      },
      {
        name: 'delete_todo',
        description: 'Delete a todo item',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Todo item ID' },
          },
          required: ['id'],
        },
      },
    ],
  };
});

// CallToolRequestSchema のハンドラー
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case 'create_todo': {
      const text = request.params.arguments?.text;
      if (typeof text !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'Text must be a string');
      }
      const todo = await todoRouter.createCaller({}).createTodo(text);
      return {
        content: [{ type: 'text', text: JSON.stringify(todo, null, 2) }],
      };
    }
    case 'list_todos': {
      const todos = await todoRouter.createCaller({}).listTodos();
      return {
        content: [{ type: 'text', text: JSON.stringify(todos, null, 2) }],
      };
    }
    case 'update_todo': {
      const args = request.params.arguments;
      if (
        typeof args?.id !== 'number' ||
        typeof args?.completed !== 'boolean'
      ) {
        throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for update_todo');
      }
      const todo = await todoRouter.createCaller({}).updateTodo({
        id: args.id,
        completed: args.completed,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(todo, null, 2) }],
      };
    }
    case 'delete_todo': {
      const id = request.params.arguments?.id;
      if (typeof id !== 'number') {
        throw new McpError(ErrorCode.InvalidParams, 'ID must be a number');
      }
      await todoRouter.createCaller({}).deleteTodo(id);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
      };
    }
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }
});


async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('TodoApp MCP server running on stdio');
}

main().catch(console.error);
