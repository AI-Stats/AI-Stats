import type {
  LanguageModelV4FunctionTool,
  LanguageModelV4ProviderTool,
  LanguageModelV4ToolChoice,
} from '@ai-sdk/provider';

/**
 * Converts standard AI SDK function tools to Phaseo's OpenAI-compatible
 * Chat Completions tool format.
 */
export function prepareTools(
  tools: Array<LanguageModelV4FunctionTool | LanguageModelV4ProviderTool>
): any[] {
  return tools.map((tool) => {
    if (tool.type === 'provider') {
      throw new Error(
        `Provider tool "${tool.id}" is not supported by Phaseo Chat Completions. ` +
          'Use a standard AI SDK function tool, or call the owning provider directly.'
      );
    }

    return {
      type: 'function',
      function: {
        name: tool.name,
        ...(tool.description ? { description: tool.description } : {}),
        parameters: tool.inputSchema,
      },
    };
  });
}

export function convertToolChoice(toolChoice: LanguageModelV4ToolChoice): any {
  switch (toolChoice.type) {
    case 'auto':
      return 'auto';
    case 'none':
      return 'none';
    case 'required':
      return 'required';
    case 'tool':
      return {
        type: 'function',
        function: { name: toolChoice.toolName },
      };
  }
}
