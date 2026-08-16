import { Modal, TextInput } from 'chat';
import { getUserSettings, setUserSettings } from '../../lib/settings';
import type { UserSettings } from '../../types';
import { chat } from '../instance';
import { publishHome } from './view';

const EDIT_ACTION_ID = 'app_home_edit_instructions';
const CLEAR_ACTION_ID = 'app_home_clear_instructions';
const MODAL_CALLBACK_ID = 'app_home_instructions_modal';
const PREVIEW_LENGTH = 280;

export function customInstructionsBlocks({
  instructions,
}: UserSettings): Record<string, unknown>[] {
  const preview =
    instructions && instructions.length > PREVIEW_LENGTH
      ? `${instructions.slice(0, PREVIEW_LENGTH)}…`
      : instructions;

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Custom Instructions' },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: preview
          ? `>${preview.replaceAll('\n', '\n>')}`
          : '_No custom instructions set. gorkie uses its default personality._',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: instructions ? 'Edit' : 'Add' },
          action_id: EDIT_ACTION_ID,
        },
        ...(instructions
          ? [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Clear' },
                action_id: CLEAR_ACTION_ID,
                style: 'danger',
                confirm: {
                  title: { type: 'plain_text', text: 'Clear instructions?' },
                  text: {
                    type: 'mrkdwn',
                    text: 'This removes your custom instructions. gorkie goes back to its default personality for you.',
                  },
                  confirm: { type: 'plain_text', text: 'Clear' },
                  deny: { type: 'plain_text', text: 'Cancel' },
                },
              },
            ]
          : []),
      ],
    },
    { type: 'divider' },
  ];
}

export function registerCustomInstructions(): void {
  const bot = chat();

  bot.onAction(EDIT_ACTION_ID, async (event) => {
    const settings = await getUserSettings(event.user.userId);
    await event.openModal(
      Modal({
        callbackId: MODAL_CALLBACK_ID,
        title: 'Custom Instructions',
        submitLabel: 'Save',
        children: [
          TextInput({
            id: 'instructions',
            label: 'How should gorkie act for you?',
            placeholder:
              'e.g. keep replies short, always show code diffs, address me as vro',
            multiline: true,
            initialValue: settings.instructions,
            maxLength: 2000,
          }),
        ],
      })
    );
  });

  bot.onAction(CLEAR_ACTION_ID, async (event) => {
    await setUserSettings({
      userId: event.user.userId,
      patch: { instructions: undefined },
    });
    await publishHome(event.user.userId);
  });

  bot.onModalSubmit(MODAL_CALLBACK_ID, async (event) => {
    const instructions = event.values.instructions?.trim();
    await setUserSettings({
      userId: event.user.userId,
      patch: { instructions: instructions || undefined },
    });
    await publishHome(event.user.userId);
  });
}
