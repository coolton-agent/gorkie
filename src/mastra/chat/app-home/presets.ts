import { RadioSelect } from 'chat';
import { type ToolPermission, toolPermissionSchema } from '../../types';

const PRESETS = {
  all: {
    description: 'Even reading waits.',
    label: 'Ask for everything',
    status: '`asks for everything`',
  },
  delete: {
    description: 'Only deleting waits.',
    label: 'Ask only before deleting',
    status: '`asks before deleting`',
  },
  write: {
    description: 'Reading runs. Writing and deleting wait.',
    label: 'Ask before writing or deleting',
    status: '`asks before writing or deleting`',
  },
} satisfies Record<
  ToolPermission,
  { description: string; label: string; status: string }
>;

// GitHub's curated surface has nothing destructive left, so `delete` gates
// nothing there and saying "asks before deleting" would promise a safety net
// that does not exist. MCP servers keep the original wording, where the
// `delete_`/`remove_` name check does gate something.
const NEVER_ASK = {
  description: 'Nothing waits, including writes.',
  label: 'Never ask',
  status: '`never asks`',
};

function preset(permission: ToolPermission, nothingDeletes: boolean) {
  return permission === 'delete' && nothingDeletes
    ? NEVER_ASK
    : PRESETS[permission];
}

export function presetStatus(
  permission: ToolPermission,
  nothingDeletes = false
): string {
  return preset(permission, nothingDeletes).status;
}

export function decodePreset(value: string | undefined): {
  permission: ToolPermission;
  scope: string | undefined;
} {
  const [head, tail] = (value ?? '').split(' ');
  return tail === undefined
    ? { permission: toolPermissionSchema.parse(head), scope: undefined }
    : { permission: toolPermissionSchema.parse(tail), scope: head };
}

export function presetRadio({
  id,
  nothingDeletes = false,
  permission,
  scope,
}: {
  id: string;
  nothingDeletes?: boolean;
  permission: ToolPermission;
  scope?: string;
}) {
  return RadioSelect({
    id,
    label: 'When should Gorkie stop and ask?',
    initialOption: scope ? `${scope} ${permission}` : permission,
    options: Object.keys(PRESETS).map((value) => {
      const entry = preset(value as ToolPermission, nothingDeletes);
      return {
        label: entry.label,
        description: entry.description,
        value: scope ? `${scope} ${value}` : value,
      };
    }),
  });
}
