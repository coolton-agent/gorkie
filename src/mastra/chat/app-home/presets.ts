import { type ToolPermission, toolPermissionSchema } from '../../types';

const PRESETS: { description: string; label: string; value: ToolPermission }[] =
  [
    {
      description: 'Every call waits, including reading.',
      label: 'Ask for everything',
      value: 'all',
    },
    {
      description: 'Reading runs freely. Writing and deleting wait.',
      label: 'Ask before writing or deleting',
      value: 'write',
    },
    {
      description: 'Only deleting waits. Everything else runs as you.',
      label: 'Ask only before deleting',
      value: 'delete',
    },
  ];

// A select reports only the chosen option, so anything else the handler needs
// (which server was changed) has to ride inside the option value.
function encode({ preset, scope }: { preset: ToolPermission; scope?: string }) {
  return scope ? `${scope} ${preset}` : preset;
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

export function presetSelect({
  actionId,
  permission,
  scope,
}: {
  actionId: string;
  permission: ToolPermission;
  scope?: string;
}): Record<string, unknown> {
  const option = (preset: (typeof PRESETS)[number]) => ({
    text: { type: 'plain_text', text: preset.label },
    description: { type: 'plain_text', text: preset.description },
    value: encode({ preset: preset.value, scope }),
  });
  const selected = PRESETS.find((preset) => preset.value === permission);
  return {
    type: 'static_select',
    action_id: actionId,
    placeholder: { type: 'plain_text', text: 'When to ask' },
    options: PRESETS.map(option),
    ...(selected ? { initial_option: option(selected) } : {}),
  };
}
