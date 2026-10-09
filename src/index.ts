/**
 * Lia - Assistant IA
 * Chat, analyse d'images, aide au code et planification.
 */
import { Env, ChatMessage } from "./types";

const TEXT_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
const VISION_MODEL_ID = "@cf/meta/llama-3.2-11b-vision-instruct";
const MAX_IMAGE_LENGTH = 7_000_000;

const SYSTEM_PROMPT = `
Tu es Lia, une assistante IA amicale et utile.
Réponds en français sauf si l'utilisateur demande une autre langue.
Tu peux analyser les images jointes, expliquer ce qu'elles montrent,
aider à écrire et corriger du code, et créer des plannings organisés.
Pour les plannings, propose des étapes claires et des horaires si nécessaire.
Pour le code, explique les solutions et signale les points qui restent à tester.
N'affirme jamais avoir exécuté du code si ce n'est pas le cas.
Sois claire, patiente et adaptée aux besoins de l'utilisateur.
`;

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      return handleChatRequest(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      messages?: ChatMessage[];
      image?: unknown;
    };

    const messages = Array.isArray(body.messages)
      ? [...body.messages]
      : [];

    const image = body.image;

    if (image !== undefined && typeof image !== "string") {
      return Response.json(
        { error: "Format d'image invalide." },
        { status: 400 },
      );
    }

    if (typeof image === "string") {
      if (image.length > MAX_IMAGE_LENGTH) {
        return Response.json(
          { error: "Image trop volumineuse. Essaie une image plus petite." },
          { status: 413 },
        );
      }

      if (
        !/^data:image\/(?:png|jpeg|webp);base64,/i.test(image)
      ) {
        return Response.json(
          { error: "Utilise une image PNG, JPEG ou WebP." },
          { status: 400 },
        );
      }
    }

    if (!messages.some((message) => message.role === "system")) {
      messages.unshift({
        role: "system",
        content: SYSTEM_PROMPT,
      });
    }

    let stream: ReadableStream;

if (typeof image === "string") {
  stream = await env.AI.run<typeof VISION_MODEL_ID>(
    VISION_MODEL_ID,
    {
      messages,
      image,
      max_tokens: 1024,
      stream: true,
    },
  );
} else {
  stream = await env.AI.run<typeof TEXT_MODEL_ID>(
    TEXT_MODEL_ID,
    {
      messages,
      max_tokens: 1024,
      stream: true,
    },
  );
}

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Lia chat error:", error);

    return Response.json(
      { error: "Lia n'a pas pu traiter cette demande." },
      { status: 500 },
    );
  }
}
