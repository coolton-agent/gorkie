import { RadioSelect } from 'chat';
import { type ToolPermission, toolPermissionSchema } from '../../types';

const PRESETS: { description: string; label: string; value: ToolPermission }[] =
  [
    {
      description: 'Even reading waits.',
      label: 'Ask for everything',
      value: 'all',
    },
    {
      description: 'Reading runs. Writing and deleting wait.',
      label: 'Ask before writing or deleting',
      value: 'write',
    },
    {
      description: 'Only deleting waits.',
      label: 'Ask only before deleting',
      value: 'delete',
    },
  ];

export const PRESET_LABELS: Record<ToolPermission, string> = {
  all: '`asks for everything`',
  delete: '`asks before deleting`',
  write: '`asks before writing or deleting`',
};

export function decodePreset(value: string | undefined): {
  permission: ToolPermission;
  scope: string | undefined;
} {
  const [head, tail] = (value ?? '').split(' ');
  return tail === undefined
    ? { permission: toolPermissionSchema.parse(head), scope: undefined }
    : { permission: toolPermissionSchema.parse(tail), scope: head };
}

function options(scope?: string) {
  return PRESETS.map((preset) => ({
    text: { type: 'plain_text', text: preset.label },
    description: { type: 'plain_text', text: preset.description },
    value: scope ? `${scope} ${preset.value}` : preset.value,
  }));
}

function initial({
  permission,
  scope,
}: {
  permission: ToolPermission;
  scope?: string;
}) {
  return options(scope).find((option) => option.value.endsWith(permission));
}

export function presetSelect({
  actionId,
  permission,
  scope,
}: {
  actionId: string;
  permission: ToolPermission;
  scope?: string;
}): Record<string, unknown> {
  const selected = initial({ permission, scope });
  return {
    type: 'static_select',
    action_id: actionId,
    placeholder: { type: 'plain_text', text: 'When to ask' },
    options: options(scope),
    ...(selected ? { initial_option: selected } : {}),
  };
}

export function presetRadio({
  id,
  permission,
  scope,
}: {
  id: string;
  permission: ToolPermission;
  scope?: string;
}) {
  return RadioSelect({
    id,
    label: 'When should Gorkie stop and ask?',
    initialOption: scope ? `${scope} ${permission}` : permission,
    options: PRESETS.map((preset) => ({
      label: preset.label,
      description: preset.description,
      value: scope ? `${scope} ${preset.value}` : preset.value,
    })),
  });
}
