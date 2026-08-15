import {
  defaultTypingStatus,
  type TypingStatusFn,
} from '@mastra/core/channels';
import { label } from '../lib/label';

type Args = Record<string, unknown>;

function truncate(text: string, max: number): string {
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

const statuses: Record<string, (args: Args) => string> = {
  create_canvas: (args) => {
    const title = str(args, 'title');
    return title
      ? `is creating the canvas "${truncate(title, 20)}"...`
      : 'is creating a canvas...';
  },
  create_scheduled_task: (args) => {
    const name = str(args, 'name') ?? str(args, 'task');
    return name
      ? `is scheduling "${truncate(name, 30)}"...`
      : 'is scheduling a task...';
  },
  delete_file: (args) => {
    const path = str(args, 'path');
    return path
      ? `is deleting ${truncate(fileName(path), 30)}...`
      : 'is deleting a file...';
  },
  delete_scheduled_task: () => 'is deleting a scheduled task...',
  edit_canvas: () => 'is editing a canvas...',
  edit_file: (args) => {
    const path = str(args, 'path');
    return path
      ? `is editing ${truncate(fileName(path), 30)}...`
      : 'is editing a file...';
  },
  execute_command: (args) => {
    const command = str(args, 'command');
    return command
      ? `is running \`${truncate(command, 28)}\`...`
      : 'is running a command...';
  },
  fetch_url: (args) => {
    const url = str(args, 'url');
    try {
      return url
        ? `is reading ${new URL(url).hostname}...`
        : 'is reading a web page...';
    } catch {
      return 'is reading a web page...';
    }
  },
  file_stat: (args) => {
    const path = str(args, 'path');
    return path
      ? `is checking ${truncate(fileName(path), 30)}...`
      : 'is checking a file...';
  },
  generate_image: (args) => {
    const prompt = str(args, 'prompt');
    return prompt
      ? `is generating an image of "${truncate(prompt, 15)}"...`
      : 'is generating an image...';
  },
  get_channel_info: () => 'is checking a channel...',
  get_permalink: () => 'is getting a Slack link...',
  get_process_output: (args) => {
    const pid = str(args, 'pid');
    return pid
      ? `is checking process ${truncate(pid, 15)}...`
      : 'is checking a process...';
  },
  get_slack_file: () => 'is downloading a Slack file...',
  get_user: () => 'is looking up a user...',
  grep: (args) => {
    const pattern = str(args, 'pattern');
    return pattern
      ? `is searching files for "${truncate(pattern, 15)}"...`
      : 'is searching files...';
  },
  kill_process: (args) => {
    const pid = str(args, 'pid');
    return pid
      ? `is stopping process ${truncate(pid, 15)}...`
      : 'is stopping a process...';
  },
  leave_thread: () => 'is leaving the thread...',
  list_canvases: (args) => {
    const query = str(args, 'query');
    return query
      ? `is listing canvases: "${truncate(query, 18)}"...`
      : 'is listing canvases...';
  },
  list_channels: (args) => {
    const query = str(args, 'query');
    return query
      ? `is listing channels: "${truncate(query, 18)}"...`
      : 'is listing channels...';
  },
  list_files: (args) => {
    const path = str(args, 'path');
    return path && path !== '.'
      ? `is listing ${truncate(fileName(path), 30)}...`
      : 'is listing files...';
  },
  list_scheduled_tasks: () => 'is checking scheduled tasks...',
  list_threads: () => 'is listing threads...',
  lookup_canvas_sections: () => 'is inspecting a canvas...',
  pause_scheduled_task: () => 'is pausing a scheduled task...',
  post_message: (args) => {
    const target = args.target as { type?: string } | undefined;
    if (target?.type === 'user') {
      return 'is sending a DM...';
    }
    if (target?.type === 'channel' || target?.type === 'thread') {
      return `is sending a message to the ${target.type}...`;
    }
    return 'is sending a message...';
  },
  react: (args) => {
    const emoji = str(args, 'emoji');
    if (!emoji) {
      return 'is adding a reaction...';
    }
    return args.action === 'remove'
      ? `is removing a :${emoji}: reaction...`
      : `is adding a :${emoji}: reaction...`;
  },
  read_canvas: () => 'is reading a canvas...',
  read_conversation_history: () => 'is reading Slack history...',
  read_file: (args) => {
    const path = str(args, 'path');
    return path
      ? `is reading ${truncate(fileName(path), 30)}...`
      : 'is reading a file...';
  },
  resume_scheduled_task: () => 'is resuming a scheduled task...',
  search_slack: (args) => {
    const query = str(args, 'query');
    return query
      ? `is searching Slack for "${truncate(query, 15)}"...`
      : 'is searching Slack...';
  },
  search_web: (args) => {
    const query = str(args, 'query');
    return query
      ? `is searching the web for "${truncate(query, 12)}"...`
      : 'is searching the web...';
  },
  slack: () => 'is working in Slack...',
  summarize_thread: (args) => {
    const instructions = str(args, 'instructions');
    return instructions
      ? `is summarizing: ${truncate(instructions, 25)}`
      : 'is summarizing the thread...';
  },
  upload_file: () => 'is uploading a file...',
  wait: (args) => {
    const reason = str(args, 'reason');
    return reason ? `is waiting: ${truncate(reason, 30)}` : 'is waiting...';
  },
  write_file: (args) => {
    const path = str(args, 'path');
    return path
      ? `is writing ${truncate(fileName(path), 30)}...`
      : 'is writing a file...';
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

  const args = (chunk.payload.args as Args | undefined) ?? {};
  const status = toolName.startsWith('agent-')
    ? `is spawning a ${label(toolName.slice(6))} agent...`
    : (statuses[toolName]?.(args) ??
      `is using ${label(toolName).toLowerCase()}...`);

  // Slack's assistant.threads.setStatus rejects loading_messages entries of
  // 51+ characters.
  return truncate(status, 50);
};
