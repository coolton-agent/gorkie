import {
  defaultTypingStatus,
  type TypingStatusFn,
} from '@mastra/core/channels';
import { label } from '../lib/label';

type Args = Record<string, unknown>;

function truncate(text: string, max = 50): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function str(args: Args, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function fileName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}

// Fallback per tool when args are missing or a dynamic describer below
// declines to produce a string (e.g. an optional field wasn't passed).
const toolStatuses: Record<string, string> = {
  create_canvas: 'is creating a canvas...',
  create_scheduled_task: 'is scheduling a task...',
  delete_file: 'is deleting a file...',
  delete_scheduled_task: 'is deleting a scheduled task...',
  edit_canvas: 'is editing a canvas...',
  edit_file: 'is editing a file...',
  execute_command: 'is running a command...',
  fetch_url: 'is reading a web page...',
  file_stat: 'is checking a file...',
  generate_image: 'is generating an image...',
  get_channel_info: 'is checking a channel...',
  get_permalink: 'is getting a Slack link...',
  get_process_output: 'is checking a process...',
  get_slack_file: 'is downloading a Slack file...',
  get_user: 'is looking up a user...',
  grep: 'is searching files...',
  kill_process: 'is stopping a process...',
  leave_thread: 'is leaving the thread...',
  list_canvases: 'is listing canvases...',
  list_channels: 'is listing channels...',
  list_files: 'is listing files...',
  list_scheduled_tasks: 'is checking scheduled tasks...',
  list_threads: 'is listing threads...',
  lookup_canvas_sections: 'is inspecting a canvas...',
  pause_scheduled_task: 'is pausing a scheduled task...',
  post_message: 'is sending a message...',
  react: 'is adding a reaction...',
  read_canvas: 'is reading a canvas...',
  read_conversation_history: 'is reading Slack history...',
  read_file: 'is reading a file...',
  resume_scheduled_task: 'is resuming a scheduled task...',
  search_slack: 'is searching Slack...',
  search_web: 'is searching the web...',
  slack: 'is working in Slack...',
  summarize_thread: 'is summarizing the thread...',
  upload_file: 'is uploading a file...',
  wait: 'is waiting...',
  write_file: 'is writing a file...',
};

// Builds a status line from the tool's actual input when it has one
// meaningful, human-readable field. Return undefined to fall back to
// toolStatuses above instead of guessing.
const dynamicStatuses: Record<string, (args: Args) => string | undefined> = {
  create_canvas: (args) => {
    const title = str(args, 'title');
    return title && `is creating the canvas "${truncate(title, 40)}"...`;
  },
  create_scheduled_task: (args) => {
    const name = str(args, 'name') ?? str(args, 'task');
    return name && `is scheduling "${truncate(name, 40)}"...`;
  },
  delete_file: (args) => {
    const path = str(args, 'path');
    return path && `is deleting ${fileName(path)}...`;
  },
  edit_file: (args) => {
    const path = str(args, 'path');
    return path && `is editing ${fileName(path)}...`;
  },
  execute_command: (args) => {
    const command = str(args, 'command');
    return command && `is running \`${truncate(command, 60)}\`...`;
  },
  fetch_url: (args) => {
    const url = str(args, 'url');
    if (!url) {
      return;
    }
    try {
      return `is reading ${new URL(url).hostname}...`;
    } catch {
      // Not a parseable URL; fall back to toolStatuses.
    }
  },
  file_stat: (args) => {
    const path = str(args, 'path');
    return path && `is checking ${fileName(path)}...`;
  },
  generate_image: (args) => {
    const prompt = str(args, 'prompt');
    return prompt && `is generating an image of "${truncate(prompt, 40)}"...`;
  },
  get_process_output: (args) => {
    const pid = str(args, 'pid');
    return pid && `is checking process ${pid}...`;
  },
  grep: (args) => {
    const pattern = str(args, 'pattern');
    return pattern && `is searching files for "${truncate(pattern, 40)}"...`;
  },
  kill_process: (args) => {
    const pid = str(args, 'pid');
    return pid && `is stopping process ${pid}...`;
  },
  list_canvases: (args) => {
    const query = str(args, 'query');
    return query && `is listing canvases matching "${truncate(query, 40)}"...`;
  },
  list_channels: (args) => {
    const query = str(args, 'query');
    return query && `is listing channels matching "${truncate(query, 40)}"...`;
  },
  list_files: (args) => {
    const path = str(args, 'path');
    return path && path !== '.' ? `is listing ${fileName(path)}...` : undefined;
  },
  post_message: (args) => {
    const target = args.target as { type?: string } | undefined;
    if (target?.type === 'user') {
      return 'is sending a DM...';
    }
    if (target?.type === 'channel' || target?.type === 'thread') {
      return `is sending a message to the ${target.type}...`;
    }
  },
  react: (args) => {
    const emoji = str(args, 'emoji');
    if (!emoji) {
      return;
    }
    return args.action === 'remove'
      ? `is removing a :${emoji}: reaction...`
      : `is adding a :${emoji}: reaction...`;
  },
  read_file: (args) => {
    const path = str(args, 'path');
    return path && `is reading ${fileName(path)}...`;
  },
  search_slack: (args) => {
    const query = str(args, 'query');
    return query && `is searching Slack for "${truncate(query, 40)}"...`;
  },
  search_web: (args) => {
    const query = str(args, 'query');
    return query && `is searching the web for "${truncate(query, 40)}"...`;
  },
  summarize_thread: (args) => {
    const instructions = str(args, 'instructions');
    return instructions && `is summarizing: ${truncate(instructions, 45)}...`;
  },
  wait: (args) => {
    const reason = str(args, 'reason');
    return reason && `is waiting: ${truncate(reason, 45)}...`;
  },
  write_file: (args) => {
    const path = str(args, 'path');
    return path && `is writing ${fileName(path)}...`;
  },
};

export const typingStatus: TypingStatusFn = (chunk, context) => {
  if (chunk.type !== 'tool-call') {
    return defaultTypingStatus(chunk, context);
  }

  const { toolName } = chunk.payload;
  if (context.channelTools.has(toolName)) {
    return false;
  }
  if (toolName.startsWith('agent-')) {
    return `is spawning a ${label(toolName.slice(6))} agent...`;
  }

  const args = chunk.payload.args as Args | undefined;
  const dynamic = args && dynamicStatuses[toolName]?.(args);
  return (
    dynamic ||
    toolStatuses[toolName] ||
    `is using ${label(toolName).toLowerCase()}...`
  );
};
