import { TEMPLATES } from "../data/constants.js";

export async function postActivitySummary(data) {
  const content = await renderTemplate(TEMPLATES.chatSummary, {
    ...data,
    mode: "activity"
  });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: data.actor }),
    content
  });
}

export async function postFinalSummary(data) {
  const content = await renderTemplate(TEMPLATES.chatSummary, {
    ...data,
    mode: "final"
  });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: data.actor }),
    content
  });
}

export async function postRollCard(data) {
  const content = await renderTemplate(TEMPLATES.chatRollCard, data);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: data.actor }),
    content,
    rolls: data.rolls?.map((entry) => entry.roll).filter(Boolean) ?? []
  });
}
