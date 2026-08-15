import {
  defaultTypingStatus,
  type TypingStatusFn,
} from '@mastra/core/channels';
import { label } from '../lib/label';

const toolStatuses: Record<string, string> = {
  create_canvas: 'is creating a canvas...',
  create_scheduled_task: 'is scheduling a task...',
  delete_scheduled_task: 'is deleting a scheduled task...',
  edit_canvas: 'is editing a canvas...',
  fetch_url: 'is reading a web page...',
  get_channel_info: 'is checking a channel...',
  get_permalink: 'is getting a Slack link...',
  get_slack_file: 'is downloading a Slack file...',
  get_user: 'is looking up a user...',
  grep: 'is searching files...',
  leave_thread: 'is leaving the thread...',
  list_canvases: 'is listing canvases...',
  list_channels: 'is listing channels...',
  list_scheduled_tasks: 'is checking scheduled tasks...',
  list_threads: 'is listing threads...',
  lookup_canvas_sections: 'is inspecting a canvas...',
  pause_scheduled_task: 'is pausing a scheduled task...',
  post_message: 'is sending a message...',
  react: 'is adding a reaction...',
  read_canvas: 'is reading a canvas...',
  read_conversation_history: 'is reading Slack history...',
  resume_scheduled_task: 'is resuming a scheduled task...',
  search_slack: 'is searching Slack...',
  search_web: 'is searching the web...',
  slack: 'is working in Slack...',
  summarize_thread: 'is summarizing the thread...',
  upload_file: 'is uploading a file...',
  wait: 'is waiting...',
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
  return (
    toolStatuses[toolName] ?? `is using ${label(toolName).toLowerCase()}...`
  );
};
