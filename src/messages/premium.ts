import {
  APIInteractionResponse,
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";

export function premiumRequiredResponse(skuId: string): APIInteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content:
        "This feature requires a premium subscription. Upgrade to unlock premium features!",
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Premium,
              sku_id: skuId,
            },
          ],
        },
      ],
      flags: MessageFlags.Ephemeral,
    },
  };
}
